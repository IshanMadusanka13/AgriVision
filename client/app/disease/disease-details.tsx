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
  Dimensions,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { get_detection_by_id } from "@/services/api";

const { width: SW } = Dimensions.get("window");

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
  cercospora: "#8b5cf6",
  healthy: "#10b981",
  leaf_curl: "#f59e0b",
  uncertain: "#78716c",
};

const SEV_CFG: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  severe: { color: "#7f1d1d", bg: "#fff1f2", border: "#fecdd3", dot: "#b91c1c" },
  high: { color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", dot: "#ef4444" },
  moderate: { color: "#d97706", bg: "#fffbeb", border: "#fcd34d", dot: "#f59e0b" },
  low: { color: "#059669", bg: "#ecfdf5", border: "#6ee7b7", dot: "#10b981" },
};

const SEV_ORDER: Record<string, number> = { severe: 4, high: 3, moderate: 2, low: 1 };

// =============================================================
// HELPERS
// =============================================================

function diseaseColor(name: string) {
  return DISEASE_COLORS[name?.toLowerCase().replace(/ /g, "_")] ?? "#6366f1";
}

function prettyDisease(name: string) {
  return name?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? "—";
}

function prettyDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function sevCfg(sev?: string | null) {
  return sev ? SEV_CFG[sev.toLowerCase()] ?? null : null;
}

function worstSeverity(detections: StoredLeaf[]): string | null {
  let best: string | null = null;
  let score = 0;
  for (const d of detections) {
    const s = SEV_ORDER[d.severity?.toLowerCase() ?? ""] ?? 0;
    if (s > score) { score = s; best = d.severity!; }
  }
  return best;
}

function dominantDisease(summary: Record<string, number>): string | null {
  return Object.entries(summary).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// =============================================================
// MINI COMPONENTS
// =============================================================

function SevPill({ severity }: { severity: string }) {
  const c = sevCfg(severity);
  if (!c) return null;
  return (
    <View style={[mp.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[mp.dot, { backgroundColor: c.dot }]} />
      <Text style={[mp.text, { color: c.color }]}>{severity}</Text>
    </View>
  );
}
const mp = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: "700" },
});

function RecCard({ entry }: { entry: RecommendationEntry }) {
  const col = diseaseColor(entry.disease);
  const sc = sevCfg(entry.severity);
  return (
    <View style={[rc.wrap, { borderLeftColor: col }]}>
      <View style={rc.header}>
        <View style={[rc.dot, { backgroundColor: col }]} />
        <Text style={[rc.name, { color: col }]}>{prettyDisease(entry.disease)}</Text>
        {sc && entry.severity && (
          <View style={[rc.sevBadge, { backgroundColor: sc.bg }]}>
            <View style={[rc.sevDot, { backgroundColor: sc.dot }]} />
            <Text style={[rc.sevText, { color: sc.color }]}>{entry.severity}</Text>
          </View>
        )}
      </View>
      {!!entry.description && <Text style={rc.desc}>{entry.description}</Text>}
      {entry.treatments.map((t, i) => (
        <View key={i} style={rc.row}>
          <Text style={[rc.bullet, { color: col }]}>›</Text>
          <Text style={rc.txt}>{t}</Text>
        </View>
      ))}
    </View>
  );
}
const rc = StyleSheet.create({
  wrap: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 10, borderLeftWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  dot: { width: 9, height: 9, borderRadius: 5 },
  name: { fontSize: 15, fontWeight: "700" },
  sevBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4 },
  sevDot: { width: 6, height: 6, borderRadius: 3 },
  sevText: { fontSize: 11, fontWeight: "600" },
  desc: { fontSize: 13, color: "#78716c", fontStyle: "italic", marginBottom: 10, lineHeight: 19 },
  row: { flexDirection: "row", gap: 8, marginBottom: 6, paddingLeft: 4 },
  bullet: { fontSize: 18, fontWeight: "700", lineHeight: 22 },
  txt: { flex: 1, fontSize: 14, color: "#44403c", lineHeight: 21 },
});

function LeafCrop({
  imageUrl,
  bbox,
  containerWidth,
}: {
  imageUrl: string;
  bbox: number[];
  containerWidth: number;
}) {
  const [x1, y1, x2, y2] = bbox;
  const bboxW = x2 - x1;
  const bboxH = y2 - y1;

  const CROP_H = 120;

  const [imgSize, setImgSize] = React.useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    Image.getSize(
      imageUrl,
      (w, h) => setImgSize({ w, h }),
      () => setImgSize(null)
    );
  }, [imageUrl]);

  if (!imgSize) {
    return (
      <View style={[crop.placeholder, { width: containerWidth, height: CROP_H }]}>
        <ActivityIndicator size="small" color="#10b981" />
      </View>
    );
  }

  // Scale based on height so all crops are exactly CROP_H tall
  const scale   = CROP_H / bboxH;
  const scaledW = imgSize.w * scale;
  const scaledH = imgSize.h * scale;
  const offsetX = -(x1 * scale);
  const offsetY = -(y1 * scale);

  return (
    <View style={[crop.frame, { width: containerWidth, height: CROP_H }]}>
      <Image
        source={{ uri: imageUrl }}
        style={{
          position: "absolute",
          width: scaledW,
          height: scaledH,
          left: offsetX,
          top: offsetY,
        }}
        resizeMode="cover"
      />
    </View>
  );
}

const crop = StyleSheet.create({
  frame: {
    overflow: "hidden",
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  placeholder: {
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
});

// =============================================================
// SCREEN
// =============================================================

export default function DiseaseDetailsScreen() {
  const router = useRouter();
  const { detectionId } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rec, setRec] = useState<HistoryRecord | null>(null);

  useEffect(() => {
    if (!detectionId) { setError("No detection ID"); setLoading(false); return; }
    get_detection_by_id(detectionId as string)
      .then(setRec)
      .catch((e: any) => setError(e.message ?? "Failed to load"))
      .finally(() => setLoading(false));
  }, [detectionId]);

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={st.centerSub}>Loading scan…</Text>
      </View>
    );
  }

  if (error || !rec) {
    return (
      <View style={st.center}>
        <Text style={st.errEmoji}>⚠️</Text>
        <Text style={st.errTitle}>Failed to Load</Text>
        <Text style={st.errSub}>{error ?? "Detection not found."}</Text>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
          <Text style={st.backBtnTxt}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Derived
  const dominant = dominantDisease(rec.disease_summary);
  const worst = worstSeverity(rec.detections);
  const worstCfg = sevCfg(worst);
  const recEntries = Object.values(rec.recommendations);
  const allHealthy = Object.keys(rec.disease_summary).every(
    (k) => k === "healthy" || k === "uncertain"
  );

  const handleShare = async () => {
    const summary = Object.entries(rec.disease_summary)
      .map(([d, c]) => `  • ${prettyDisease(d)}: ${c}`)
      .join("\n");
    const recs = recEntries
      .map((e) => {
        const h = e.severity ? `${prettyDisease(e.disease)} (${e.severity})` : prettyDisease(e.disease);
        return `${h}:\n${e.treatments.map((t) => `  • ${t}`).join("\n")}`;
      })
      .join("\n\n");

    await Share.share({
      message:
        `🌿 Plant Scan — ${prettyDate(rec.created_at)}\n\n` +
        `Leaves scanned: ${rec.total_detections}\n\n` +
        `Disease breakdown:\n${summary}\n\n` +
        (recs ? `Treatments:\n${recs}` : ""),
    }).catch(console.error);
  };

  return (
    <ScrollView style={st.container} showsVerticalScrollIndicator={false}>

      {/* ── HEADER ── */}
      <LinearGradient
        colors={allHealthy ? ["#052e16", "#065f46"] : ["#1c1917", "#292524"]}
        style={st.header}
      >
        <TouchableOpacity style={st.backPill} onPress={() => router.back()}>
          <Text style={st.backPillTxt}>← History</Text>
        </TouchableOpacity>

        <Text style={st.eyebrow}>SCAN RECORD</Text>
        <Text style={st.hTitle}>
          {allHealthy ? "Healthy Plant ✓" : `${prettyDisease(dominant ?? "")} Detected`}
        </Text>
        <Text style={st.hDate}>{prettyDate(rec.created_at)}</Text>

        {/* Stats strip */}
        <View style={st.statsStrip}>
          {[
            { val: rec.total_detections, lbl: "Leaves" },
            { val: Object.keys(rec.disease_summary).length, lbl: "Diseases" },
            { val: recEntries.length, lbl: "Treatments" },
          ].map((item, i, arr) => (
            <React.Fragment key={i}>
              <View style={st.statItem}>
                <Text style={st.statVal}>{item.val}</Text>
                <Text style={st.statLbl}>{item.lbl}</Text>
              </View>
              {i < arr.length - 1 && <View style={st.statDivider} />}
            </React.Fragment>
          ))}
        </View>
      </LinearGradient>

      {/* ── ANNOTATED IMAGE ── */}
      {rec.annotated_image_url && (
        <View style={st.imgWrap}>
          <Image
            source={{ uri: rec.annotated_image_url }}
            style={st.img}
            resizeMode="contain"
          />
          <View style={st.imgCaption}>
            <Text style={st.imgCaptionTxt}>↑ Detection overlay</Text>
          </View>
        </View>
      )}

      {/* ── OVERVIEW ── */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>Overview</Text>
        <View style={st.overviewCard}>

          <View style={st.ovRow}>
            <Text style={st.ovLabel}>Primary Disease</Text>
            <Text style={[st.ovVal, { color: diseaseColor(dominant ?? "") }]}>
              {prettyDisease(dominant ?? "—")}
            </Text>
          </View>

          {worst && worstCfg && (
            <View style={[st.ovRow, st.ovBorder]}>
              <Text style={st.ovLabel}>Worst Severity</Text>
              <SevPill severity={worst} />
            </View>
          )}

          <View style={[st.ovRow, st.ovBorder]}>
            <Text style={st.ovLabel}>Result</Text>
            <View style={[st.resultChip, { backgroundColor: allHealthy ? "#ecfdf5" : "#fef2f2" }]}>
              <Text style={[st.resultChipTxt, { color: allHealthy ? "#059669" : "#dc2626" }]}>
                {allHealthy ? "No Disease" : "Disease Detected"}
              </Text>
            </View>
          </View>

          <View style={[st.ovRow, st.ovBorder]}>
            <Text style={st.ovLabel}>Scanned</Text>
            <Text style={st.ovVal}>{rec.total_detections} leaf{rec.total_detections !== 1 ? "s" : ""}</Text>
          </View>

        </View>
      </View>

      {/* ── DISEASE BREAKDOWN ── */}
      {Object.keys(rec.disease_summary).length > 0 && (
        <View style={st.section}>
          <Text style={st.sectionTitle}>Disease Breakdown</Text>
          <View style={st.pillRow}>
            {Object.entries(rec.disease_summary).map(([d, cnt]) => {
              const col = diseaseColor(d);
              return (
                <View key={d} style={[st.dPill, { borderColor: col }]}>
                  <View style={[st.dPillDot, { backgroundColor: col }]} />
                  <Text style={[st.dPillTxt, { color: col }]}>{prettyDisease(d)}</Text>
                  <View style={[st.dPillBadge, { backgroundColor: col }]}>
                    <Text style={st.dPillCount}>{cnt}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── ALL DETECTIONS ── */}
      {rec.detections.length > 0 && rec.annotated_image_url && (
        <View style={st.section}>
          <Text style={st.sectionTitle}>Leaf-by-Leaf ({rec.detections.length})</Text>
          <View style={st.leafGrid}>
            {rec.detections.map((leaf, idx) => {
              const col = diseaseColor(leaf.disease);
              const CROP_W = (SW - 48) / 2;
              const CROP_H = 120;

              return (
                <View key={idx} style={[st.leafCard, { borderLeftColor: col }]}>
                  <LeafCrop
                    imageUrl={rec.annotated_image_url!}
                    bbox={leaf.bbox}
                    containerWidth={CROP_W}
                  />
                  <View style={st.leafInfo}>
                    <View style={[st.leafId, { backgroundColor: col }]}>
                      <Text style={st.leafIdTxt}>#{leaf.leaf_id ?? idx + 1}</Text>
                    </View>
                    <Text style={[st.leafDisease, { color: col }]} numberOfLines={1}>
                      {prettyDisease(leaf.disease)}
                    </Text>
                    {leaf.severity && <SevPill severity={leaf.severity} />}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── RECOMMENDATIONS ── */}
      {recEntries.length > 0 && (
        <View style={st.section}>
          <Text style={st.sectionTitle}>Treatment Recommendations</Text>
          {recEntries.map((entry, i) => <RecCard key={i} entry={entry} />)}
        </View>
      )}

      {/* ── ACTIONS ── */}
      <View style={st.actions}>
        <TouchableOpacity style={st.shareBtn} onPress={handleShare}>
          <Text style={st.shareBtnTxt}>Share Results</Text>
        </TouchableOpacity>
        <View style={st.secRow}>
          <TouchableOpacity style={st.secBtn} onPress={() => router.back()}>
            <Text style={st.secBtnTxt}>← History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.secBtn} onPress={() => router.push("/")}>
            <Text style={st.secBtnTxt}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>

    </ScrollView>
  );
}

// =============================================================
// STYLES
// =============================================================

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f0" },

  center: { flex: 1, backgroundColor: "#f5f5f0", alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  centerSub: { fontSize: 15, color: "#78716c" },
  errEmoji: { fontSize: 52 },
  errTitle: { fontSize: 22, fontWeight: "700", color: "#dc2626" },
  errSub: { fontSize: 14, color: "#78716c", textAlign: "center", lineHeight: 22 },
  backBtn: { marginTop: 8, backgroundColor: "#fff", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#e7e5e4" },
  backBtnTxt: { fontSize: 15, fontWeight: "600", color: "#44403c" },

  // Header
  header: { paddingTop: 58, paddingBottom: 28, paddingHorizontal: 24 },
  backPill: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 16 },
  backPillTxt: { fontSize: 13, fontWeight: "600", color: "#fff" },
  eyebrow: { fontSize: 11, fontWeight: "800", color: "#6ee7b7", letterSpacing: 2.5, marginBottom: 6 },
  hTitle: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: -0.6, marginBottom: 4 },
  hDate: { fontSize: 13, color: "#a8a29e", marginBottom: 20 },

  statsStrip: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: 16, alignItems: "center" },
  statItem: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  statLbl: { fontSize: 11, color: "#a8a29e", marginTop: 2 },
  statDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.15)" },

  // Image
  imgWrap: { margin: 16, backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  img: { width: "100%", height: 260, backgroundColor: "#f3f4f6" },
  imgCaption: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f0efed" },
  imgCaptionTxt: { fontSize: 12, color: "#a8a29e", fontWeight: "500" },

  // Section
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#1c1917", letterSpacing: -0.3, marginBottom: 12 },

  // Overview
  overviewCard: { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  ovRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14 },
  ovBorder: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  ovLabel: { fontSize: 14, color: "#78716c", fontWeight: "500" },
  ovVal: { fontSize: 15, fontWeight: "700", color: "#1c1917" },
  resultChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  resultChipTxt: { fontSize: 13, fontWeight: "700" },

  // Disease pills
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  dPillDot: { width: 7, height: 7, borderRadius: 4 },
  dPillTxt: { fontSize: 13, fontWeight: "600" },
  dPillBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: "center" },
  dPillCount: { fontSize: 11, fontWeight: "800", color: "#fff" },

  // Leaf rows
  leafRow: { backgroundColor: "#fff", borderRadius: 14, marginBottom: 8, padding: 14, borderLeftWidth: 4, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  leafMid: { flex: 1, gap: 5 },
  leafConf: { alignItems: "flex-end", gap: 4, minWidth: 52 },
  leafConfVal: { fontSize: 13, fontWeight: "700", color: "#44403c" },
  confTrack: { width: 52, height: 4, backgroundColor: "#f3f4f6", borderRadius: 2, overflow: "hidden" },
  confFill: { height: "100%" as any, borderRadius: 2 },

  // replace old leafRow / leafMid / leafConf / confTrack / confFill with these:
  leafGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  leafCard: {
    width: (SW - 48) / 2,   // ← exactly half width
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 2,
    borderLeftWidth: 4,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
    padding: 10,
    gap: 8,
  },
  leafInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  leafId: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  leafIdTxt: { fontSize: 11, fontWeight: "800", color: "#fff" },
  leafDisease: { fontSize: 14, fontWeight: "700", flex: 1 },

  // Actions
  actions: { padding: 16, paddingBottom: 52, gap: 10 },
  shareBtn: { backgroundColor: "#10b981", paddingVertical: 16, borderRadius: 16, alignItems: "center", shadowColor: "#10b981", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  shareBtnTxt: { fontSize: 16, fontWeight: "700", color: "#fff", letterSpacing: 0.3 },
  secRow: { flexDirection: "row", gap: 10 },
  secBtn: { flex: 1, backgroundColor: "#fff", paddingVertical: 14, borderRadius: 14, alignItems: "center", borderWidth: 1.5, borderColor: "#e7e5e4" },
  secBtnTxt: { fontSize: 15, fontWeight: "600", color: "#44403c" },
});