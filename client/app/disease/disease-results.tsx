import React, { useState, useEffect } from "react";
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
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { predict_disease } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// =============================================================
// TYPES
// =============================================================

interface Leaf {
  leaf_id: number;
  disease: string;
  confidence: number;
  severity?: string;
  bbox: number[];
  leaf_image: string;
}

interface RecommendationEntry {
  disease: string;
  severity: string | null;
  treatments: string[];
  description: string;
}

interface DiseaseResult {
  status: string;
  annotated_image?: string;
  total_leaves?: number;
  leaves?: Leaf[];
  disease_summary?: Record<string, number>;
  recommendations?: Record<string, RecommendationEntry>;
}

interface RawDiseaseResult {
  status: string;
  annotated_image?: string;
  total_leaves?: number;
  leaves?: Leaf[];
  disease_summary?: Record<string, number>;
  recommendations?: Record<string, any>;
}

// =============================================================
// CONSTANTS & HELPERS
// =============================================================

const SEVERITY_CLASSES = new Set(["bacterial_spot", "cercospora"]);

const SEVERITY_CONFIG: Record<
  string,
  { color: string; bg: string; label: string; dot: string }
> = {
  low:      { color: "#059669", bg: "#ecfdf5", label: "Low",      dot: "#10b981" },
  moderate: { color: "#d97706", bg: "#fffbeb", label: "Moderate", dot: "#f59e0b" },
  high:     { color: "#dc2626", bg: "#fef2f2", label: "High",     dot: "#dc2626" },
  severe:   { color: "#7f1d1d", bg: "#fff1f2", label: "Severe",   dot: "#b91c1c" },
};

const DISEASE_COLORS: Record<string, string> = {
  bacterial_spot: "#ef4444",
  cercospora:     "#8b5cf6",
  healthy:        "#10b981",
  leaf_curl:      "#f59e0b",
  powdery_mildew: "#6366f1",
  uncertain:      "#9ca3af",
};

function getSeverityConfig(sev?: string | null) {
  if (!sev) return null;
  return (
    SEVERITY_CONFIG[sev.toLowerCase()] ?? {
      color: "#6b7280",
      bg: "#f9fafb",
      label: sev,
      dot: "#9ca3af",
    }
  );
}

function getDiseaseColor(disease: string) {
  const key = disease?.toLowerCase().replace(/ /g, "_");
  return DISEASE_COLORS[key] ?? "#6366f1";
}

function formatDiseaseName(name: string) {
  return (
    name?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "—"
  );
}

function hasSeverity(leaf: Leaf): boolean {
  return (
    SEVERITY_CLASSES.has(leaf.disease?.toLowerCase()) &&
    typeof leaf.severity === "string" &&
    leaf.severity.trim().length > 0
  );
}

// =============================================================
// LEAF CARD
// =============================================================

function LeafCard({ leaf }: { leaf: Leaf }) {
  const diseaseColor = getDiseaseColor(leaf.disease);
  const showSeverity = hasSeverity(leaf);
  const sev = showSeverity ? getSeverityConfig(leaf.severity) : null;

  return (
    <View style={leafCardStyles.card}>
      <Image
        source={{ uri: leaf.leaf_image }}
        style={leafCardStyles.thumbnail}
        resizeMode="cover"
      />
      <View style={[leafCardStyles.idBadge, { backgroundColor: diseaseColor }]}>
        <Text style={leafCardStyles.idText}>#{leaf.leaf_id}</Text>
      </View>
      <View style={leafCardStyles.info}>
        <Text
          style={[leafCardStyles.diseaseName, { color: diseaseColor }]}
          numberOfLines={1}
        >
          {formatDiseaseName(leaf.disease)}
        </Text>
        {showSeverity && sev ? (
          <View style={leafCardStyles.sevRow}>
            <Text style={leafCardStyles.sevLabel}>Severity</Text>
            <View style={[leafCardStyles.sevPill, { backgroundColor: sev.bg }]}>
              <View style={[leafCardStyles.sevDot, { backgroundColor: sev.dot }]} />
              <Text style={[leafCardStyles.sevText, { color: sev.color }]}>
                {sev.label}
              </Text>
            </View>
          </View>
        ) : (
          <View style={leafCardStyles.noSeveritySpacer} />
        )}
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
  info: { padding: 12 },
  diseaseName: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  sevRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sevLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
  },
  sevPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  sevDot: { width: 6, height: 6, borderRadius: 3 },
  sevText: { fontSize: 11, fontWeight: "600" },
  noSeveritySpacer: { height: 24 },
});

// =============================================================
// RECOMMENDATION CARD
// =============================================================

function RecCard({ entry }: { entry: RecommendationEntry }) {
  const color = getDiseaseColor(entry.disease);
  const sev = getSeverityConfig(entry.severity);

  return (
    <View style={[recCardStyles.card, { borderLeftColor: color }]}>
      {/* Header: disease name + optional severity badge */}
      <View style={recCardStyles.header}>
        <View style={[recCardStyles.dot, { backgroundColor: color }]} />
        <Text style={[recCardStyles.title, { color }]}>
          {formatDiseaseName(entry.disease)}
        </Text>
        {sev && (
          <View style={[recCardStyles.sevBadge, { backgroundColor: sev.bg }]}>
            <View style={[recCardStyles.sevDot, { backgroundColor: sev.dot }]} />
            <Text style={[recCardStyles.sevText, { color: sev.color }]}>
              {sev.label}
            </Text>
          </View>
        )}
      </View>

      {/* Description */}
      {!!entry.description && (
        <Text style={recCardStyles.description}>{entry.description}</Text>
      )}

      {/* Treatments */}
      {entry.treatments.map((rec, i) => (
        <View key={i} style={recCardStyles.item}>
          <Text style={[recCardStyles.bullet, { color }]}>›</Text>
          <Text style={recCardStyles.text}>{rec}</Text>
        </View>
      ))}
    </View>
  );
}

const recCardStyles = StyleSheet.create({
  card: {
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  title: { fontSize: 15, fontWeight: "700", letterSpacing: 0.1 },
  sevBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 4,
    marginLeft: 2,
  },
  sevDot: { width: 6, height: 6, borderRadius: 3 },
  sevText: { fontSize: 11, fontWeight: "600" },
  description: {
    fontSize: 13,
    color: "#78716c",
    fontStyle: "italic",
    marginBottom: 10,
    lineHeight: 19,
  },
  item: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  bullet: { fontSize: 18, fontWeight: "700", lineHeight: 22 },
  text: { flex: 1, fontSize: 14, color: "#44403c", lineHeight: 21 },
});

// =============================================================
// MAIN SCREEN
// =============================================================

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
            Alert.alert(
              "Authentication Required",
              "Please log in to save scan history"
            );
          }
        }

        const rawResult: RawDiseaseResult = await predict_disease(
          imageUri as string,
          userEmail,
          shouldSave
        );

        if (rawResult.status === "no_leaf_detected") {
          setError(
            "No plant leaf detected. Please try again with a clearer image of the affected area."
          );
          setLoading(false);
          return;
        }

        // Transform recommendations from Record<string, string[]> to Record<string, RecommendationEntry>
        const transformedRecommendations: Record<string, RecommendationEntry> = {};
        if (rawResult.recommendations) {
          Object.entries(rawResult.recommendations).forEach(([key, value]) => {
            if (value && typeof value === 'object') {
              transformedRecommendations[key] = {
                disease: value.disease || key,
                severity: value.severity || null,
                treatments: Array.isArray(value.treatments) ? value.treatments : (Array.isArray(value) ? value : []),
                description: value.description || '',
              };
            }
          });
        }

        const transformedResult: DiseaseResult = {
          ...rawResult,
          recommendations: transformedRecommendations,
        };

        setResult(transformedResult);
      } catch (err: any) {
        setError(err.message || "Failed to analyze image. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    analyzeImage();
  }, [imageUri, saveToDb]);

  // ── Loading ────────────────────────────────────────────────
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
            {[
              "Detecting leaves",
              "Classifying diseases",
              "Fetching treatments",
            ].map((step, i) => (
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

  // ── Error ──────────────────────────────────────────────────
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
          <TouchableOpacity
            style={styles.homeLink}
            onPress={() => router.push("/")}
          >
            <Text style={styles.homeLinkText}>← Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!result) return null;

  const leaves          = result.leaves ?? [];
  const diseaseSummary  = result.disease_summary ?? {};
  const recommendations = result.recommendations ?? {};
  const recEntries      = Object.values(recommendations); // RecommendationEntry[]
  const hasRecs         = recEntries.length > 0;

  const dominantDisease = Object.entries(diseaseSummary).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0];

  const isAllHealthy =
    dominantDisease === "healthy" ||
    (Object.keys(diseaseSummary).length === 1 && diseaseSummary["healthy"]);

  const handleShare = async () => {
    const summaryLines = Object.entries(diseaseSummary)
      .map(([d, c]) => `  • ${formatDiseaseName(d)}: ${c} leaf${c > 1 ? "s" : ""}`)
      .join("\n");

    const recLines = recEntries
      .map((entry) => {
        const header = entry.severity
          ? `${formatDiseaseName(entry.disease)} (${entry.severity})`
          : formatDiseaseName(entry.disease);
        const treatments = entry.treatments.map((t) => `  • ${t}`).join("\n");
        return `${header}:\n${treatments}`;
      })
      .join("\n\n");

    await Share.share({
      message:
        `🌿 Plant Disease Scan Results\n\n` +
        `Total Leaves Scanned: ${result.total_leaves}\n\n` +
        `Disease Breakdown:\n${summaryLines}\n\n` +
        (recLines ? `Treatment Recommendations:\n${recLines}` : ""),
    }).catch(console.error);
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* HEADER */}
      <View
        style={[
          styles.header,
          { backgroundColor: isAllHealthy ? "#064e3b" : "#1c1917" },
        ]}
      >
        <Text style={styles.headerEyebrow}>SCAN COMPLETE</Text>
        <Text style={styles.headerTitle}>
          {isAllHealthy
            ? "Plant is Healthy ✓"
            : `${formatDiseaseName(dominantDisease ?? "")} Detected`}
        </Text>
        <Text style={styles.headerSubtitle}>
          {result.total_leaves} leaf
          {(result.total_leaves ?? 0) > 1 ? "s" : ""} analysed
        </Text>
        {saveToDb === "true" && (
          <View style={styles.savedBadge}>
            <Text style={styles.savedBadgeText}>✓ Saved to History</Text>
          </View>
        )}
      </View>

      {/* ANNOTATED IMAGE */}
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

      {/* DISEASE SUMMARY PILLS */}
      {Object.keys(diseaseSummary).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disease Breakdown</Text>
          <View style={styles.pillRow}>
            {Object.entries(diseaseSummary).map(([disease, count]) => {
              const color = getDiseaseColor(disease);
              return (
                <View
                  key={disease}
                  style={[styles.diseasePill, { borderColor: color }]}
                >
                  <View style={[styles.pillDot, { backgroundColor: color }]} />
                  <Text style={[styles.pillDisease, { color }]}>
                    {formatDiseaseName(disease)}
                  </Text>
                  <View
                    style={[styles.pillCountBadge, { backgroundColor: color }]}
                  >
                    <Text style={styles.pillCount}>{count}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* LEAF CARDS */}
      {leaves.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leaf-by-Leaf Results</Text>
          <View style={styles.leafGrid}>
            {leaves.map((leaf) => (
              <LeafCard key={leaf.leaf_id} leaf={leaf} />
            ))}
          </View>
        </View>
      )}

      {/* RECOMMENDATIONS — uses new RecommendationEntry shape */}
      {hasRecs && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Treatment Recommendations</Text>
          {recEntries.map((entry, idx) => (
            <RecCard key={idx} entry={entry} />
          ))}
        </View>
      )}

      {/* ACTIONS */}
      <View style={styles.actionSection}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Share Results</Text>
        </TouchableOpacity>
        <View style={styles.secondaryActions}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Scan Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/")}
          >
            <Text style={styles.secondaryBtnText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// =============================================================
// STYLES
// =============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },

  // Loading
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
  loadingSteps: { width: "100%", gap: 10 },
  loadingStep: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepDot: { width: 8, height: 8, borderRadius: 4 },
  stepText: { fontSize: 14, color: "#57534e", fontWeight: "500" },

  // Error
  errorCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
  },
  errorEmoji: { fontSize: 56, marginBottom: 16 },
  errorTitle: { fontSize: 22, fontWeight: "700", color: "#dc2626", marginBottom: 8 },
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
  retryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  homeLink: { padding: 8 },
  homeLinkText: { fontSize: 14, color: "#78716c", fontWeight: "500" },

  // Header
  header: { paddingTop: 56, paddingBottom: 28, paddingHorizontal: 24 },
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
  headerSubtitle: { fontSize: 15, color: "#a8a29e", marginBottom: 12 },
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
  savedBadgeText: { fontSize: 12, fontWeight: "600", color: "#6ee7b7" },

  // Annotated image
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
  annotatedImage: { width: "100%", height: 280, backgroundColor: "#f3f4f6" },
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

  // Section
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1c1917",
    letterSpacing: -0.3,
    marginBottom: 12,
  },

  // Disease pills
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillDisease: { fontSize: 13, fontWeight: "600", letterSpacing: 0.1 },
  pillCountBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  pillCount: { fontSize: 11, fontWeight: "800", color: "#fff" },

  // Leaf grid
  leafGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

  // Actions
  actionSection: { padding: 16, paddingBottom: 40, gap: 10 },
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
  shareBtnText: { fontSize: 16, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },
  secondaryActions: { flexDirection: "row", gap: 10 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e7e5e4",
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "600", color: "#44403c" },
});