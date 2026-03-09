import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { get_user_detections } from "@/services/api";

// =============================================================
// TYPES
// =============================================================

interface StoredLeaf {
  leaf_id: number;
  disease: string;
  confidence: number;
  severity?: string;
  bbox: number[];
}

interface RecommendationEntry {
  disease: string;
  severity: string | null;
  treatments: string[];
  description: string;
}

interface HistoryRecord {
  id: string;
  annotated_image_url?: string;
  total_detections: number;
  detections: StoredLeaf[];
  disease_summary: Record<string, number>;
  conclusion: string;
  recommendations: Record<string, RecommendationEntry>;
  status: string;
  created_at: string;
}

// =============================================================
// CONSTANTS
// =============================================================

const DISEASE_COLORS: Record<string, string> = {
  bacterial_spot: "#ef4444",
  cercospora:     "#8b5cf6",
  healthy:        "#10b981",
  leaf_curl:      "#f59e0b",
  uncertain:      "#78716c",
};

const SEVERITY_ORDER: Record<string, number> = {
  severe: 4, high: 3, moderate: 2, low: 1,
};

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  severe:   { color: "#7f1d1d", bg: "#fff1f2", dot: "#b91c1c" },
  high:     { color: "#dc2626", bg: "#fef2f2", dot: "#ef4444" },
  moderate: { color: "#d97706", bg: "#fffbeb", dot: "#f59e0b" },
  low:      { color: "#059669", bg: "#ecfdf5", dot: "#10b981" },
};

// =============================================================
// HELPERS
// =============================================================

function getDiseaseColor(name: string) {
  return DISEASE_COLORS[name?.toLowerCase().replace(/ /g, "_")] ?? "#6366f1";
}

function formatDiseaseName(name: string) {
  return name?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "—";
}

function formatRelativeDate(iso: string): string {
  const d    = new Date(iso);
  const now  = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  if (diff === 0) return `Today · ${time}`;
  if (diff === 1) return `Yesterday · ${time}`;
  if (diff < 7)  return `${diff} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getWorstSeverity(detections: StoredLeaf[]): string | null {
  let best: string | null = null;
  let bestScore = 0;
  for (const d of detections) {
    const score = SEVERITY_ORDER[d.severity?.toLowerCase() ?? ""] ?? 0;
    if (score > bestScore) { bestScore = score; best = d.severity!; }
  }
  return best;
}

function getCardMeta(record: HistoryRecord): { label: string; color: string; bg: string } {
  if (record.status === "no_leaf_detected")
    return { label: "No Leaf", color: "#6b7280", bg: "#f3f4f6" };

  const keys    = Object.keys(record.disease_summary);
  const allGood = keys.every((k) => k === "healthy" || k === "uncertain");
  if (allGood) return { label: "Healthy", color: "#059669", bg: "#ecfdf5" };
  return { label: "Disease Found", color: "#dc2626", bg: "#fef2f2" };
}

// =============================================================
// CARD COMPONENT
// =============================================================

function HistoryCard({ record, onPress }: { record: HistoryRecord; onPress: () => void }) {
  const meta   = getCardMeta(record);
  const worst  = getWorstSeverity(record.detections);
  const sevCfg = worst ? SEVERITY_CONFIG[worst.toLowerCase()] : null;

  const topDiseases = Object.entries(record.disease_summary)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <TouchableOpacity style={hCard.wrap} onPress={onPress} activeOpacity={0.82}>

      {/* Thumbnail */}
      <View style={hCard.thumbWrap}>
        {record.annotated_image_url ? (
          <Image
            source={{ uri: record.annotated_image_url }}
            style={hCard.thumb}
            resizeMode="cover"
          />
        ) : (
          <View style={hCard.thumbFallback}>
            <Text style={hCard.thumbFallbackIcon}>🌿</Text>
          </View>
        )}
        {/* Status chip overlaid on thumb */}
        <View style={[hCard.statusChip, { backgroundColor: meta.bg }]}>
          <Text style={[hCard.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      {/* Body */}
      <View style={hCard.body}>
        {/* Date */}
        <Text style={hCard.date}>{formatRelativeDate(record.created_at)}</Text>

        {/* Disease pills */}
        <View style={hCard.pillRow}>
          {topDiseases.map(([disease, count]) => {
            const col = getDiseaseColor(disease);
            return (
              <View key={disease} style={[hCard.pill, { backgroundColor: col + "15", borderColor: col + "50" }]}>
                <View style={[hCard.pillDot, { backgroundColor: col }]} />
                <Text style={[hCard.pillLabel, { color: col }]} numberOfLines={1}>
                  {formatDiseaseName(disease)}
                </Text>
                <Text style={[hCard.pillCount, { color: col }]}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* Footer: leaf count + worst severity */}
        <View style={hCard.footer}>
          <Text style={hCard.leafCount}>
            🍃 {record.total_detections} leaf{record.total_detections !== 1 ? "s" : ""}
          </Text>
          {sevCfg && worst && (
            <View style={[hCard.sevChip, { backgroundColor: sevCfg.bg }]}>
              <View style={[hCard.sevDot, { backgroundColor: sevCfg.dot }]} />
              <Text style={[hCard.sevText, { color: sevCfg.color }]}>{worst}</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={hCard.arrow}>›</Text>
    </TouchableOpacity>
  );
}

const hCard = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
    height: 100,                // ← fixed card height
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  thumbWrap: { width: 96, position: "relative" },
  thumb: {
    width: 96,
    height: 100,                // ← match card height exactly
    backgroundColor: "#f3f4f6",
  },
  thumbFallback: {
    width: 96,
    height: 100,                // ← match card height exactly
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbFallbackIcon: { fontSize: 30 },
  statusChip: {
    position: "absolute",
    bottom: 6,
    left: 4,
    right: 4,
    borderRadius: 6,
    paddingVertical: 3,
    alignItems: "center",
  },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  body: { flex: 1, padding: 12, gap: 7 },
  date: { fontSize: 11, color: "#a8a29e", fontWeight: "500" },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  pillDot: { width: 5, height: 5, borderRadius: 3 },
  pillLabel: { fontSize: 11, fontWeight: "600" },
  pillCount: { fontSize: 10, fontWeight: "800" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  leafCount: { fontSize: 11, color: "#9ca3af" },
  sevChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  sevDot: { width: 5, height: 5, borderRadius: 3 },
  sevText: { fontSize: 10, fontWeight: "700" },
  arrow: { fontSize: 24, color: "#e7e5e4", alignSelf: "center", paddingRight: 12, fontWeight: "300" },
});

// =============================================================
// SCREEN
// =============================================================

const PAGE_SIZE = 10;

export default function HistoryScreen() {
  const router = useRouter();

  const [records,     setRecords]     = useState<HistoryRecord[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const offsetRef = useRef(0);

  const fetchPage = useCallback(async (reset: boolean) => {
    try {
      const email = await AsyncStorage.getItem("userEmail");
      if (!email) {
        Alert.alert("Sign In Required", "Please log in to view your scan history.");
        setLoading(false);
        return;
      }

      const offset = reset ? 0 : offsetRef.current;

      // API returns { status, total, detections } — extract the array
      const response = await get_user_detections(email, PAGE_SIZE, offset);
      const page: HistoryRecord[] = response?.detections ?? response ?? [];

      if (reset) {
        setRecords(page);
        offsetRef.current = page.length;
      } else {
        setRecords((prev) => [...prev, ...page]);
        offsetRef.current += page.length;
      }

      setHasMore(page.length === PAGE_SIZE);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchPage(true); }, []);

  const onRefresh = () => { setRefreshing(true); fetchPage(true); };

  const onEndReached = () => {
    if (!loadingMore && hasMore) { setLoadingMore(true); fetchPage(false); }
  };

  // ── Loading ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={s.centerText}>Loading history…</Text>
      </View>
    );
  }

  return (
    <View style={s.screen}>

      {/* Header */}
      <LinearGradient
        colors={["#052e16", "#064e3b", "#065f46"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={s.header}
      >
        <Text style={s.eyebrow}>SCAN HISTORY</Text>
        <Text style={s.headerTitle}>Your Scans</Text>
        <Text style={s.headerSub}>
          {records.length > 0
            ? `${records.length}${hasMore ? "+" : ""} record${records.length !== 1 ? "s" : ""}`
            : "No scans yet"}
        </Text>
      </LinearGradient>

      <ScrollView
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />
        }
        onScroll={({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 80) {
            onEndReached();
          }
        }}
        scrollEventThrottle={300}
      >

        {/* Empty state */}
        {records.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🌿</Text>
            <Text style={s.emptyTitle}>No Scans Yet</Text>
            <Text style={s.emptySub}>
              Start scanning your plants to build a history of disease detections.
            </Text>
            <TouchableOpacity style={s.scanBtn} onPress={() => router.push("/")}>
              <Text style={s.scanBtnText}>Scan a Plant</Text>
            </TouchableOpacity>
          </View>
        )}

        {records.map((rec) => (
          <HistoryCard
            key={rec.id}
            record={rec}
            onPress={() =>
              router.push({ pathname: "/disease/disease-details", params: { detectionId: rec.id } })
            }
          />
        ))}

        {loadingMore && (
          <View style={s.loadMore}>
            <ActivityIndicator size="small" color="#10b981" />
          </View>
        )}

        {!hasMore && records.length > 0 && (
          <Text style={s.endLabel}>— End of history —</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f5f0" },
  center: { flex: 1, backgroundColor: "#f5f5f0", alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { fontSize: 15, color: "#78716c" },

  header: { paddingTop: 62, paddingBottom: 28, paddingHorizontal: 24 },
  eyebrow: { fontSize: 11, fontWeight: "800", color: "#6ee7b7", letterSpacing: 2.5, marginBottom: 6 },
  headerTitle: { fontSize: 34, fontWeight: "800", color: "#fff", letterSpacing: -1, marginBottom: 4 },
  headerSub: { fontSize: 14, color: "#a7f3d0" },

  list: { flex: 1 },
  listContent: { padding: 16, paddingTop: 20 },

  empty: { alignItems: "center", paddingTop: 56, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: "#1c1917", marginBottom: 8 },
  emptySub: { fontSize: 14, color: "#78716c", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  scanBtn: { backgroundColor: "#10b981", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  scanBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  loadMore: { alignItems: "center", paddingVertical: 20 },
  endLabel: { textAlign: "center", color: "#d1d5db", fontSize: 12, paddingVertical: 16 },
});