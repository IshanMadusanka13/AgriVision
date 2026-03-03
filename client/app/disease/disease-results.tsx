import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Share,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { predict_disease } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─────────────────────────────────────────────
// TYPES — mirrors BE response exactly
// ─────────────────────────────────────────────

interface Leaf {
  leaf_id: number;
  disease: string;
  confidence: number;
  severity: string;
  bbox: number[];
  leaf_image: string; // base64 data:image/png;base64,...
}

interface DiseaseResult {
  status: string;
  annotated_image?: string;
  total_leaves?: number;
  leaves?: Leaf[];
  disease_summary?: Record<string, number>;
  recommendations?: Record<string, string[]>;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string; dot: string }> = {
  high:     { color: "#dc2626", bg: "#fef2f2", label: "High",     dot: "#dc2626" },
  moderate: { color: "#d97706", bg: "#fffbeb", label: "Moderate", dot: "#f59e0b" },
  low:      { color: "#059669", bg: "#ecfdf5", label: "Low",      dot: "#10b981" },
  none:     { color: "#2563eb", bg: "#eff6ff", label: "None",     dot: "#3b82f6" },
};

const DISEASE_COLORS: Record<string, string> = {
  bacterial_spot:  "#ef4444",
  cercospora:      "#8b5cf6",
  healthy:         "#10b981",
  leaf_curl:       "#f59e0b",
  powdery_mildew:  "#6366f1",
};

function getSeverityConfig(sev: string) {
  return SEVERITY_CONFIG[sev?.toLowerCase()] ?? { color: "#6b7280", bg: "#f9fafb", label: sev ?? "—", dot: "#9ca3af" };
}

function getDiseaseColor(disease: string) {
  const key = disease?.toLowerCase().replace(/ /g, "_");
  return DISEASE_COLORS[key] ?? "#6366f1";
}

function formatDiseaseName(name: string) {
  return name?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "—";
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

function LeafCard({ leaf, index }: { leaf: Leaf; index: number }) {
  const sev = getSeverityConfig(leaf.severity);
  const diseaseColor = getDiseaseColor(leaf.disease);

  return (
    <View style={leafCardStyles.card}>
      {/* Leaf thumbnail */}
      <Image
        source={{ uri: leaf.leaf_image }}
        style={leafCardStyles.thumbnail}
        resizeMode="cover"
      />

      {/* Leaf ID badge */}
      <View style={[leafCardStyles.idBadge, { backgroundColor: diseaseColor }]}>
        <Text style={leafCardStyles.idText}>#{leaf.leaf_id}</Text>
      </View>

      {/* Info */}
      <View style={leafCardStyles.info}>
        <Text style={[leafCardStyles.diseaseName, { color: diseaseColor }]} numberOfLines={1}>
          {formatDiseaseName(leaf.disease)}
        </Text>

        {/* Confidence bar */}
        <View style={leafCardStyles.confRow}>
          <Text style={leafCardStyles.confLabel}>Confidence</Text>
          <Text style={[leafCardStyles.confValue, { color: diseaseColor }]}>
            {leaf.confidence}%
          </Text>
        </View>
        <View style={leafCardStyles.confBarBg}>
          <View
            style={[
              leafCardStyles.confBarFill,
              { width: `${leaf.confidence}%` as any, backgroundColor: diseaseColor },
            ]}
          />
        </View>

        {/* Severity pill */}
        <View style={[leafCardStyles.sevPill, { backgroundColor: sev.bg }]}>
          <View style={[leafCardStyles.sevDot, { backgroundColor: sev.dot }]} />
          <Text style={[leafCardStyles.sevText, { color: sev.color }]}>{sev.label}</Text>
        </View>
      </View>
    </View>
  );
}

const leafCardStyles = StyleSheet.create({
  card: {
    width: (SCREEN_WIDTH - 48) / 2,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  thumbnail: {
    width: "100%",
    height: 130,
    backgroundColor: "#f3f4f6",
  },
  idBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  idText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  info: {
    padding: 12,
  },
  diseaseName: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  confRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  confLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
  },
  confValue: {
    fontSize: 11,
    fontWeight: "700",
  },
  confBarBg: {
    height: 5,
    backgroundColor: "#f3f4f6",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  confBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  sevPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  sevDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sevText: {
    fontSize: 11,
    fontWeight: "600",
  },
});

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────

export default function DiseaseResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { imageUri, saveToDb } = params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiseaseResult | null>(null);

  useEffect(() => {
    const analyzeImage = async () => {
      if (!imageUri) {
        setError("No image provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        let userEmail = null;
        const shouldSave = saveToDb === "true";

        if (shouldSave) {
          userEmail = await AsyncStorage.getItem("userEmail");
          if (!userEmail) {
            Alert.alert("Authentication Required", "Please log in to save scan history");
          }
        }

        const analysisResult = await predict_disease(
          imageUri as string,
          userEmail,
          shouldSave
        );

        if (analysisResult.status === "no_leaf_detected") {
          setError("No plant leaf detected. Please try again with a clearer image of the affected area.");
          setLoading(false);
          return;
        }

        setResult(analysisResult);
      } catch (err: any) {
        setError(err.message || "Failed to analyze image. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    analyzeImage();
  }, [imageUri, saveToDb]);

  // ── Loading ──────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingTitle}>Analyzing Plant</Text>
          <Text style={styles.loadingSubtext}>
            Running YOLO detection + EfficientNet classification…
          </Text>
          <View style={styles.loadingSteps}>
            {["Detecting leaves", "Classifying diseases", "Fetching treatments"].map((step, i) => (
              <View key={i} style={styles.loadingStep}>
                <View style={[styles.stepDot, { backgroundColor: "#10b981" }]} />
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── Error ────────────────────────────────────
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <View style={styles.errorCard}>
          <Text style={styles.errorEmoji}>🌿</Text>
          <Text style={styles.errorTitle}>Scan Failed</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeLink} onPress={() => router.push("/")}>
            <Text style={styles.homeLinkText}>← Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!result) return null;

  const leaves = result.leaves ?? [];
  const diseaseSummary = result.disease_summary ?? {};
  const recommendations = result.recommendations ?? {};
  const hasRecommendations = Object.keys(recommendations).length > 0;

  // Dominant disease (highest count)
  const dominantDisease = Object.entries(diseaseSummary).sort((a, b) => b[1] - a[1])[0]?.[0];
  const isAllHealthy = dominantDisease === "healthy" || (Object.keys(diseaseSummary).length === 1 && diseaseSummary["healthy"]);

  // Share handler
  const handleShare = async () => {
    const summaryLines = Object.entries(diseaseSummary)
      .map(([d, c]) => `  • ${formatDiseaseName(d)}: ${c} leaf${c > 1 ? "s" : ""}`)
      .join("\n");
    const recLines = Object.entries(recommendations)
      .map(([d, recs]) => `${formatDiseaseName(d)}:\n${recs.map((r) => `  • ${r}`).join("\n")}`)
      .join("\n\n");

    await Share.share({
      message:
        `🌿 Plant Disease Scan Results\n\n` +
        `Total Leaves Scanned: ${result.total_leaves}\n\n` +
        `Disease Breakdown:\n${summaryLines}\n\n` +
        (recLines ? `Treatment Recommendations:\n${recLines}` : ""),
    }).catch(console.error);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── HEADER ── */}
      <View style={[styles.header, { backgroundColor: isAllHealthy ? "#064e3b" : "#1c1917" }]}>
        <Text style={styles.headerEyebrow}>SCAN COMPLETE</Text>
        <Text style={styles.headerTitle}>
          {isAllHealthy ? "Plant is Healthy ✓" : `${formatDiseaseName(dominantDisease ?? "")} Detected`}
        </Text>
        <Text style={styles.headerSubtitle}>
          {result.total_leaves} leaf{(result.total_leaves ?? 0) > 1 ? "s" : ""} analysed
        </Text>
        {saveToDb === "true" && (
          <View style={styles.savedBadge}>
            <Text style={styles.savedBadgeText}>✓ Saved to History</Text>
          </View>
        )}
      </View>

      {/* ── ANNOTATED IMAGE ── */}
      {result.annotated_image && (
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: result.annotated_image }}
            style={styles.annotatedImage}
            resizeMode="contain"
          />
          <View style={styles.imageCaption}>
            <Text style={styles.imageCaptionText}>↑ Leaf detection overlay</Text>
          </View>
        </View>
      )}

      {/* ── DISEASE SUMMARY PILLS ── */}
      {Object.keys(diseaseSummary).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disease Breakdown</Text>
          <View style={styles.pillRow}>
            {Object.entries(diseaseSummary).map(([disease, count]) => {
              const color = getDiseaseColor(disease);
              return (
                <View key={disease} style={[styles.diseasePill, { borderColor: color }]}>
                  <View style={[styles.pillDot, { backgroundColor: color }]} />
                  <Text style={[styles.pillDisease, { color }]}>
                    {formatDiseaseName(disease)}
                  </Text>
                  <View style={[styles.pillCountBadge, { backgroundColor: color }]}>
                    <Text style={styles.pillCount}>{count}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── INDIVIDUAL LEAF CARDS ── */}
      {leaves.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Leaf-by-Leaf Results
          </Text>
          <View style={styles.leafGrid}>
            {leaves.map((leaf, i) => (
              <LeafCard key={leaf.leaf_id} leaf={leaf} index={i} />
            ))}
          </View>
        </View>
      )}

      {/* ── RECOMMENDATIONS ── */}
      {hasRecommendations && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Treatment Recommendations</Text>
          {Object.entries(recommendations).map(([disease, recs]) => {
            const color = getDiseaseColor(disease);
            return (
              <View key={disease} style={[styles.recCard, { borderLeftColor: color }]}>
                <View style={styles.recCardHeader}>
                  <View style={[styles.recDot, { backgroundColor: color }]} />
                  <Text style={[styles.recCardTitle, { color }]}>
                    {formatDiseaseName(disease)}
                  </Text>
                </View>
                {recs.map((rec, i) => (
                  <View key={i} style={styles.recItem}>
                    <Text style={[styles.recBullet, { color }]}>›</Text>
                    <Text style={styles.recText}>{rec}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* ── ACTIONS ── */}
      <View style={styles.actionSection}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Share Results</Text>
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Scan Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/")}>
            <Text style={styles.secondaryBtnText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f0",
  },

  // ── Loading ──────────────────────────────────
  centerContainer: {
    flex: 1,
    backgroundColor: "#f5f5f0",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1c1917",
    marginTop: 20,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  loadingSubtext: {
    fontSize: 13,
    color: "#78716c",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  loadingSteps: {
    width: "100%",
    gap: 10,
  },
  loadingStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepText: {
    fontSize: 14,
    color: "#57534e",
    fontWeight: "500",
  },

  // ── Error ────────────────────────────────────
  errorCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
  },
  errorEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#dc2626",
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: "#78716c",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  retryBtn: {
    backgroundColor: "#10b981",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 14,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  homeLink: { padding: 8 },
  homeLinkText: {
    fontSize: 14,
    color: "#78716c",
    fontWeight: "500",
  },

  // ── Header ───────────────────────────────────
  header: {
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#6ee7b7",
    letterSpacing: 2.5,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.8,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "#a8a29e",
    marginBottom: 12,
  },
  savedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#064e3b",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#6ee7b7",
    marginTop: 4,
  },
  savedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6ee7b7",
  },

  // ── Annotated image ──────────────────────────
  imageWrapper: {
    margin: 16,
    marginTop: -1,
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  annotatedImage: {
    width: "100%",
    height: 280,
    backgroundColor: "#f3f4f6",
  },
  imageCaption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fafaf9",
    borderTopWidth: 1,
    borderTopColor: "#f0efed",
  },
  imageCaptionText: {
    fontSize: 12,
    color: "#a8a29e",
    fontWeight: "500",
    letterSpacing: 0.3,
  },

  // ── Section ──────────────────────────────────
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1c1917",
    letterSpacing: -0.3,
    marginBottom: 12,
  },

  // ── Disease pills ────────────────────────────
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  diseasePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pillDisease: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
  pillCountBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  pillCount: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },

  // ── Leaf grid ────────────────────────────────
  leafGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  // ── Recommendations ──────────────────────────
  recCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  recCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  recDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  recCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  recItem: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  recBullet: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 22,
  },
  recText: {
    flex: 1,
    fontSize: 14,
    color: "#44403c",
    lineHeight: 21,
  },

  // ── Action buttons ───────────────────────────
  actionSection: {
    padding: 16,
    paddingBottom: 40,
    gap: 10,
  },
  shareBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  secondaryActions: {
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e7e5e4",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#44403c",
  },
});