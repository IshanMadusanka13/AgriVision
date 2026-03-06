import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionDetails, getGrowthHistory, HistoryItem } from '@/services/api';
import { getPlant, PlantRecord, calcAgeFull } from '@/utils/plantRegistry';

// ── Growth stage metadata ─────────────────────────────────────────────────────
const STAGES = [
  { label: 'Seedling',   color: '#86efac', bg: '#f0fdf4', icon: '🌱' },
  { label: 'Vegetative', color: '#22c55e', bg: '#dcfce7', icon: '🌿' },
  { label: 'Flowering',  color: '#f59e0b', bg: '#fffbeb', icon: '🌸' },
  { label: 'Fruiting',   color: '#f97316', bg: '#fff7ed', icon: '🌶️' },
  { label: 'Ripening',   color: '#ef4444', bg: '#fef2f2', icon: '🔴' },
];

function stageIndex(stage: string): number {
  const s = stage.toLowerCase();
  if (s.includes('early')) return 0;
  if (s.includes('vegetative')) return 1;
  if (s.includes('flower')) return 2;
  if (s.includes('fruit')) return 3;
  if (s.includes('ripen') || s.includes('harvest')) return 4;
  return -1;
}

function stageInfo(stage: string) {
  const idx = stageIndex(stage);
  return idx >= 0 ? STAGES[idx] : { label: stage, color: '#22c55e', bg: '#dcfce7', icon: '🌱' };
}

// ── Stage progress dots ───────────────────────────────────────────────────────
function StageProgress({ stage }: { stage: string }) {
  const current = stageIndex(stage);
  return (
    <View style={prog.row}>
      {STAGES.map((s, i) => {
        const active    = i <= current;
        const isCurrent = i === current;
        return (
          <React.Fragment key={i}>
            <View style={[prog.dot, {
              backgroundColor: active ? s.color : '#e5e7eb',
              width:  isCurrent ? 14 : 8,
              height: isCurrent ? 14 : 8,
              borderRadius: 7,
              borderWidth: isCurrent ? 2 : 0,
              borderColor: '#fff',
            }]} />
            {i < STAGES.length - 1 && (
              <View style={[prog.line, {
                backgroundColor: i < current ? STAGES[i + 1].color : '#e5e7eb',
              }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const prog = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  dot:  { borderRadius: 7 },
  line: { flex: 1, height: 3, marginHorizontal: 4, borderRadius: 2 },
});

// ── Main screen ───────────────────────────────────────────────────────────────
export default function SessionDetailsScreen() {
  const router    = useRouter();
  const params    = useLocalSearchParams();
  const sessionId = params.sessionId as string;

  const [loading, setLoading]             = useState(true);
  const [sessionData, setSessionData]     = useState<any>(null);
  const [showAnnotated, setShowAnnotated] = useState(false);
  const [plantHistory, setPlantHistory]   = useState<HistoryItem[]>([]);
  const [plantRecord, setPlantRecord]     = useState<PlantRecord | null>(null);

  useEffect(() => { loadSessionDetails(); }, []);

  // After session loads, fetch plant history if plant_id exists
  useEffect(() => {
    if (sessionData?.session?.plant_id != null) {
      loadPlantHistory(sessionData.session.plant_id);
    }
  }, [sessionData]);

  const loadSessionDetails = async () => {
    try {
      const analysis = await getSessionDetails(sessionId);
      setSessionData(analysis);
    } catch (error) {
      Alert.alert('Error', 'Failed to load session details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadPlantHistory = async (plantId: number) => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) return;
      const all = await getGrowthHistory(email);
      const filtered = all
        .filter(h => h.plant_id === plantId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setPlantHistory(filtered);

      const rec = await getPlant(plantId);
      if (rec) {
        setPlantRecord(rec);
      } else if (filtered.length > 0) {
        // Estimate from first scan date
        setPlantRecord({ id: plantId, startDate: filtered[0].created_at.split('T')[0] });
      }
    } catch { /* silent */ }
  };

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const formatShortDate = (ds: string) =>
    new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) {
    return (
      <SafeAreaView style={s.loadingWrap}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={s.loadingText}>Loading session…</Text>
      </SafeAreaView>
    );
  }

  if (!sessionData) {
    return (
      <SafeAreaView style={s.container}>
        <Text style={s.errorText}>Session not found</Text>
      </SafeAreaView>
    );
  }

  const session         = sessionData.session;
  const recommendations = sessionData.fertilizer_recommendations;
  const info            = stageInfo(session.growth_stage);
  const confPct         = ((session.growth_stage_confidence || 0) * 100).toFixed(1);
  const heightPct       = session.plant_height_cm
    ? Math.min((session.plant_height_cm / 60) * 100, 100)
    : 0;

  const activeImageUrl = showAnnotated
    ? (session.annotated_image_url || session.original_image_url)
    : session.original_image_url;

  // Plant journey stats
  const journeyHeights = plantHistory.filter(h => h.plant_height_cm && h.plant_height_cm > 0);
  const maxJourneyH    = journeyHeights.length ? Math.max(...journeyHeights.map(h => h.plant_height_cm!)) : 1;
  const firstH  = plantHistory[0]?.plant_height_cm;
  const latestH = plantHistory[plantHistory.length - 1]?.plant_height_cm;
  const totalGrowth = firstH && latestH ? +(latestH - firstH).toFixed(1) : null;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Hero image ──────────────────────────────────────────────────── */}
        {activeImageUrl ? (
          <View style={s.heroWrap}>
            <Image source={{ uri: activeImageUrl }} style={s.heroImage} resizeMode="cover" />

            <View style={[s.heroBadge, { backgroundColor: info.color }]}>
              <Text style={s.heroBadgeText}>{info.icon}  {info.label}</Text>
            </View>

            {session.annotated_image_url && (
              <TouchableOpacity style={s.toggleBtn} onPress={() => setShowAnnotated(v => !v)}>
                <Text style={s.toggleBtnText}>
                  {showAnnotated ? '📷 Original' : '🔍 Annotated'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* ── Growth stage card ───────────────────────────────────────────── */}
        <View style={[s.stageCard, { borderColor: info.color, backgroundColor: info.bg }]}>
          <View style={s.stageTopRow}>
            <Text style={s.stageEmoji}>{info.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.stageName, { color: info.color }]}>{session.growth_stage}</Text>
              <Text style={s.stageConf}>Confidence: {confPct}%</Text>
            </View>
          </View>

          <StageProgress stage={session.growth_stage} />

          <View style={s.stageIconRow}>
            {STAGES.map((st, i) => (
              <Text
                key={i}
                style={[s.stageIconLabel, {
                  opacity: i === stageIndex(session.growth_stage) ? 1 : 0.3,
                }]}
              >
                {st.icon}
              </Text>
            ))}
          </View>
        </View>

        {/* ── Plant height ────────────────────────────────────────────────── */}
        {session.plant_height_cm != null && session.plant_height_cm > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>📏 Plant Height</Text>
            <View style={s.heightNumRow}>
              <Text style={[s.heightBig, { color: info.color }]}>
                {Number(session.plant_height_cm).toFixed(1)}
              </Text>
              <Text style={s.heightUnit}>cm</Text>
            </View>
            <View style={s.heightBarBg}>
              <View style={[s.heightBarFill, {
                width: `${heightPct}%` as any,
                backgroundColor: info.color,
              }]} />
            </View>
            <Text style={s.heightCaption}>Measured via ArUco marker · scale 0 – 60 cm</Text>
          </View>
        )}

        {/* ── Detection results ───────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🔍 Detection Results</Text>
          <View style={s.detRow}>
            <View style={[s.detBox, { backgroundColor: '#f0fdf4' }]}>
              <Text style={s.detEmoji}>🍃</Text>
              <Text style={[s.detNum, { color: '#16a34a' }]}>{session.leaf_count}</Text>
              <Text style={[s.detLabel, { color: '#4ade80' }]}>Leaves</Text>
            </View>
            <View style={[s.detBox, { backgroundColor: '#fffbeb' }]}>
              <Text style={s.detEmoji}>🌸</Text>
              <Text style={[s.detNum, { color: '#d97706' }]}>{session.flower_count}</Text>
              <Text style={[s.detLabel, { color: '#fbbf24' }]}>Flowers</Text>
            </View>
            <View style={[s.detBox, { backgroundColor: '#fff7ed' }]}>
              <Text style={s.detEmoji}>🌶️</Text>
              <Text style={[s.detNum, { color: '#ea580c' }]}>{session.fruit_count}</Text>
              <Text style={[s.detLabel, { color: '#fb923c' }]}>Fruits</Text>
            </View>
          </View>
        </View>

        {/* ── Environmental data ──────────────────────────────────────────── */}
        {(session.ph || session.temperature || session.humidity) && (
          <View style={s.card}>
            <Text style={s.cardTitle}>🌤️ Environmental Data</Text>
            <View style={s.envRow}>
              {session.ph ? (
                <View style={[s.envBox, { backgroundColor: '#eff6ff' }]}>
                  <Text style={s.envEmoji}>🧪</Text>
                  <Text style={[s.envVal, { color: '#1d4ed8' }]}>{Number(session.ph).toFixed(1)}</Text>
                  <Text style={[s.envKey, { color: '#93c5fd' }]}>pH</Text>
                </View>
              ) : null}
              {session.temperature ? (
                <View style={[s.envBox, { backgroundColor: '#fef2f2' }]}>
                  <Text style={s.envEmoji}>🌡️</Text>
                  <Text style={[s.envVal, { color: '#dc2626' }]}>{Number(session.temperature).toFixed(0)}°C</Text>
                  <Text style={[s.envKey, { color: '#fca5a5' }]}>Temp</Text>
                </View>
              ) : null}
              {session.humidity ? (
                <View style={[s.envBox, { backgroundColor: '#f0f9ff' }]}>
                  <Text style={s.envEmoji}>💧</Text>
                  <Text style={[s.envVal, { color: '#0284c7' }]}>{Number(session.humidity).toFixed(0)}%</Text>
                  <Text style={[s.envKey, { color: '#7dd3fc' }]}>Humidity</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* ── Plant Journey ───────────────────────────────────────────────── */}
        {session.plant_id != null && plantHistory.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>📈 Plant Journey</Text>

            {/* Stats row */}
            <View style={s.journeyStats}>
              {plantRecord && (
                <View style={[s.journeyStat, { backgroundColor: '#ede9fe' }]}>
                  <Text style={[s.journeyStatVal, { color: '#7c3aed' }]}>
                    {calcAgeFull(plantRecord.startDate)}
                  </Text>
                  <Text style={[s.journeyStatKey, { color: '#a78bfa' }]}>Plant Age</Text>
                </View>
              )}
              <View style={[s.journeyStat, { backgroundColor: '#f0fdf4' }]}>
                <Text style={[s.journeyStatVal, { color: '#16a34a' }]}>{plantHistory.length}</Text>
                <Text style={[s.journeyStatKey, { color: '#4ade80' }]}>Scans</Text>
              </View>
              {totalGrowth !== null && (
                <View style={[s.journeyStat, { backgroundColor: '#fff7ed' }]}>
                  <Text style={[s.journeyStatVal, { color: '#ea580c' }]}>
                    {totalGrowth >= 0 ? '+' : ''}{totalGrowth} cm
                  </Text>
                  <Text style={[s.journeyStatKey, { color: '#fb923c' }]}>Growth</Text>
                </View>
              )}
            </View>

            {/* Timeline */}
            {plantHistory.map((h, i) => {
              const isCurrent = h.id === sessionId;
              const hInfo     = stageInfo(h.growth_stage);
              const isLast    = i === plantHistory.length - 1;
              const barW      = h.plant_height_cm && h.plant_height_cm > 0
                ? `${Math.max(6, Math.round((h.plant_height_cm / maxJourneyH) * 100))}%` as any
                : '6%';

              return (
                <View key={h.id} style={s.timelineItem}>
                  {/* Left: dot + line */}
                  <View style={s.timelineLeft}>
                    <View style={[s.timelineDot, {
                      backgroundColor: hInfo.color,
                      borderWidth: isCurrent ? 3 : 0,
                      borderColor: '#fff',
                      width: isCurrent ? 16 : 10,
                      height: isCurrent ? 16 : 10,
                      borderRadius: 8,
                      shadowColor: isCurrent ? hInfo.color : 'transparent',
                      shadowRadius: 4, shadowOpacity: 0.7,
                      elevation: isCurrent ? 3 : 0,
                    }]} />
                    {!isLast && <View style={s.timelineLine} />}
                  </View>

                  {/* Right: content */}
                  <View style={[
                    s.timelineContent,
                    isCurrent && { backgroundColor: hInfo.bg, borderColor: hInfo.color, borderWidth: 1.5 },
                  ]}>
                    {/* Date + "current" tag */}
                    <View style={s.timelineTopRow}>
                      <Text style={s.timelineDate}>{formatShortDate(h.created_at)}</Text>
                      {isCurrent && (
                        <View style={[s.currentTag, { backgroundColor: hInfo.color }]}>
                          <Text style={s.currentTagText}>Current</Text>
                        </View>
                      )}
                    </View>

                    {/* Stage */}
                    <Text style={[s.timelineStage, { color: hInfo.color }]}>
                      {hInfo.icon}  {h.growth_stage}
                    </Text>

                    {/* Height bar */}
                    {h.plant_height_cm != null && h.plant_height_cm > 0 && (
                      <View style={s.timelineHeightRow}>
                        <View style={s.timelineBarBg}>
                          <View style={[s.timelineBarFill, {
                            width: barW,
                            backgroundColor: hInfo.color,
                          }]} />
                        </View>
                        <Text style={[s.timelineHeightText, { color: hInfo.color }]}>
                          {h.plant_height_cm.toFixed(1)} cm
                        </Text>
                      </View>
                    )}

                    {/* Detection mini chips */}
                    <View style={s.timelineChips}>
                      {h.leaf_count > 0 && (
                        <Text style={s.timelineChip}>🍃 {h.leaf_count}</Text>
                      )}
                      {h.flower_count > 0 && (
                        <Text style={s.timelineChip}>🌸 {h.flower_count}</Text>
                      )}
                      {h.fruit_count > 0 && (
                        <Text style={s.timelineChip}>🌶️ {h.fruit_count}</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Details ─────────────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📍 Details</Text>
          <View style={s.chipsRow}>
            {session.plant_id != null && (
              <View style={[s.chip, { backgroundColor: '#ede9fe' }]}>
                <Text style={[s.chipText, { color: '#7c3aed' }]}>🏷️ Plant #{session.plant_id}</Text>
              </View>
            )}
            {session.location ? (
              <View style={s.chip}>
                <Text style={s.chipText}>📍 {session.location}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.divider} />
          <Text style={s.dateText}>🗓️  {formatDate(session.created_at)}</Text>
        </View>

        {/* ── Fertilizer plan ─────────────────────────────────────────────── */}
        {recommendations && recommendations.length > 0 && (
          <View style={[s.card, { marginBottom: 32 }]}>
            <Text style={s.cardTitle}>🌿 Fertilizer Plan</Text>
            <Text style={s.fertSub}>Recommended for {info.label} stage</Text>
            {recommendations.map((rec: any, i: number) => (
              <View key={i} style={s.recItem}>
                <View style={[s.recDot, { backgroundColor: info.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.recDay}>{rec.day_name}</Text>
                  <Text style={[s.recFert, { color: info.color }]}>{rec.fertilizer_type}</Text>
                  <Text style={s.recAmt}>{rec.amount}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f9fafb' },
  scroll:      { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6b7280' },
  errorText:   { fontSize: 16, color: '#dc2626', textAlign: 'center', marginTop: 40 },

  // Hero
  heroWrap:      { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#000', position: 'relative' },
  heroImage:     { width: '100%', height: '100%' },
  heroBadge:     {
    position: 'absolute', bottom: 12, left: 12,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  heroBadgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  toggleBtn:     {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  toggleBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Stage card
  stageCard:     { marginHorizontal: 16, marginTop: 16, borderRadius: 16, borderWidth: 1.5, padding: 16 },
  stageTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stageEmoji:    { fontSize: 44 },
  stageName:     { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  stageConf:     { fontSize: 13, color: '#6b7280' },
  stageIconRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  stageIconLabel:{ fontSize: 18, textAlign: 'center', flex: 1 },

  // Generic card
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16, marginTop: 14,
    padding: 16, borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 14 },

  // Height
  heightNumRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 12 },
  heightBig:     { fontSize: 52, fontWeight: '800', lineHeight: 56 },
  heightUnit:    { fontSize: 22, color: '#6b7280', fontWeight: '600', marginBottom: 8 },
  heightBarBg:   { height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden', marginBottom: 6 },
  heightBarFill: { height: '100%', borderRadius: 5 },
  heightCaption: { fontSize: 11, color: '#9ca3af' },

  // Detection
  detRow:  { flexDirection: 'row', gap: 10 },
  detBox:  { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  detEmoji:{ fontSize: 28, marginBottom: 6 },
  detNum:  { fontSize: 28, fontWeight: '800', marginBottom: 2 },
  detLabel:{ fontSize: 12, fontWeight: '600' },

  // Environment
  envRow:  { flexDirection: 'row', gap: 10 },
  envBox:  { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  envEmoji:{ fontSize: 24, marginBottom: 4 },
  envVal:  { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  envKey:  { fontSize: 12, fontWeight: '600' },

  // Plant Journey
  journeyStats:   { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  journeyStat:    { flex: 1, minWidth: 80, borderRadius: 12, padding: 10, alignItems: 'center' },
  journeyStatVal: { fontSize: 14, fontWeight: '800', marginBottom: 2, textAlign: 'center' },
  journeyStatKey: { fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Timeline
  timelineItem:    { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineLeft:    { alignItems: 'center', width: 16 },
  timelineDot:     {},
  timelineLine:    { flex: 1, width: 2, backgroundColor: '#e5e7eb', marginVertical: 4 },
  timelineContent: {
    flex: 1, backgroundColor: '#f9fafb', borderRadius: 12,
    padding: 12, marginLeft: 0,
  },
  timelineTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  timelineDate:    { fontSize: 11, color: '#6b7280', fontWeight: '600' },
  currentTag:      { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  currentTagText:  { fontSize: 10, fontWeight: '700', color: '#fff' },
  timelineStage:   { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  timelineHeightRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  timelineBarBg:   { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  timelineBarFill: { height: '100%', borderRadius: 3 },
  timelineHeightText: { fontSize: 11, fontWeight: '700', minWidth: 42, textAlign: 'right' },
  timelineChips:   { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  timelineChip:    { fontSize: 11, color: '#6b7280' },

  // Details
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip:     { backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  divider:  { height: 1, backgroundColor: '#f3f4f6', marginBottom: 10 },
  dateText: { fontSize: 13, color: '#6b7280' },

  // Fertilizer
  fertSub: { fontSize: 12, color: '#6b7280', marginBottom: 12, marginTop: -8 },
  recItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#f9fafb', borderRadius: 12,
    padding: 12, marginBottom: 8,
  },
  recDot:  { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  recDay:  { fontSize: 13, fontWeight: '700', color: '#1f2937', marginBottom: 2 },
  recFert: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  recAmt:  { fontSize: 12, color: '#6b7280' },
});
