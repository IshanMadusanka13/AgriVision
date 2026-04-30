import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FullAnalysisResult, getSmartAdvice, SmartAdviceResult, predict_disease } from '@/services/api';
import { getPlant, calcAgeFull } from '@/utils/plantRegistry';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STAGES = ['Early Vegetative', 'Vegetative', 'Flowering', 'Fruiting', 'Ripening'];
const STAGE_META: Record<string, { emoji: string; color: string; bg: string }> = {
  'Early Vegetative': { emoji: '🌱', color: '#10b981', bg: '#f0fdf4' },
  'Vegetative':       { emoji: '🌿', color: '#059669', bg: '#ecfdf5' },
  'Flowering':        { emoji: '🌸', color: '#f59e0b', bg: '#fffbeb' },
  'Fruiting':         { emoji: '🌶️', color: '#f97316', bg: '#fff7ed' },
  'Ripening':         { emoji: '🔥', color: '#dc2626', bg: '#fef2f2' },
};

const DAY_ACCENTS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

interface DiseaseLeaf { leaf_id: number; disease: string; confidence: number; severity?: string; bbox: number[]; leaf_image: string; }
interface DiseaseRec { disease: string; severity: string | null; treatments: string[]; description: string; }
interface DiseaseResult { status: string; annotated_image?: string; total_leaves?: number; leaves?: DiseaseLeaf[]; disease_summary?: Record<string, number>; recommendations?: Record<string, DiseaseRec>; }

const DISEASE_COLORS: Record<string, string> = { bacterial_spot: '#ef4444', cercospora: '#8b5cf6', healthy: '#10b981', leaf_curl: '#f59e0b', powdery_mildew: '#6366f1', uncertain: '#9ca3af' };
const SEVERITY_CONFIG: Record<string, { color: string; bg: string; label: string; dot: string }> = {
  low:      { color: '#059669', bg: '#ecfdf5', label: 'Low',      dot: '#10b981' },
  moderate: { color: '#d97706', bg: '#fffbeb', label: 'Moderate', dot: '#f59e0b' },
  high:     { color: '#dc2626', bg: '#fef2f2', label: 'High',     dot: '#dc2626' },
  severe:   { color: '#7f1d1d', bg: '#fff1f2', label: 'Severe',   dot: '#b91c1c' },
};
function getDiseaseColor(d: string) { return DISEASE_COLORS[d?.toLowerCase().replace(/ /g, '_')] ?? '#6366f1'; }
function formatDisease(name: string) { return name?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? '—'; }
function getSevConfig(sev?: string | null) { return sev ? (SEVERITY_CONFIG[sev.toLowerCase()] ?? { color: '#6b7280', bg: '#f9fafb', label: sev, dot: '#9ca3af' }) : null; }

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const result: FullAnalysisResult = JSON.parse(params.resultData as string);
  const { recommendation } = result;

  // full_analysis re-detects server-side and may not return plant_id / plant_height_cm.
  // Use the values captured at the camera step as reliable fallbacks.
  const cameraPlantId = params.camera_plant_id ? parseInt(params.camera_plant_id as string) : null;
  const cameraPlantHeight = params.camera_plant_height ? parseFloat(params.camera_plant_height as string) : null;
  const detection = {
    ...result.detection,
    plant_id: result.detection.plant_id ?? cameraPlantId,
    plant_height_cm: result.detection.plant_height_cm ?? cameraPlantHeight,
  };

  const [plantAge, setPlantAge] = useState<string | null>(null);
  const [smartAdvice, setSmartAdvice] = useState<SmartAdviceResult | null>(null);
  const [smartLoading, setSmartLoading] = useState(false);
  const [diseaseResult, setDiseaseResult] = useState<DiseaseResult | null>(null);
  const [diseaseLoading, setDiseaseLoading] = useState(false);
  const diseaseImageUri = params.disease_image_uri as string || '';

  useEffect(() => {
    if (detection.plant_id) {
      getPlant(detection.plant_id).then(p => {
        if (p) setPlantAge(calcAgeFull(p.startDate));
      });
    }
  }, []);

  useEffect(() => {
    if (detection.plant_id && detection.growth_stage) {
      setSmartLoading(true);
      getSmartAdvice(detection.plant_id, detection.growth_stage)
        .then(setSmartAdvice)
        .catch(() => setSmartAdvice(null))
        .finally(() => setSmartLoading(false));
    }
  }, []);

  useEffect(() => {
    if (!diseaseImageUri) return;
    setDiseaseLoading(true);
    AsyncStorage.getItem('userEmail').then(email =>
      predict_disease(diseaseImageUri, email, false)
    ).then(raw => {
      const recs: Record<string, DiseaseRec> = {};
      if (raw.recommendations) {
        Object.entries(raw.recommendations).forEach(([k, v]: [string, any]) => {
          recs[k] = { disease: v.disease || k, severity: v.severity || null, treatments: Array.isArray(v.treatments) ? v.treatments : [], description: v.description || '' };
        });
      }
      setDiseaseResult({ ...raw, recommendations: recs });
    }).catch(() => setDiseaseResult(null))
      .finally(() => setDiseaseLoading(false));
  }, []);

  const stageKey = STAGES.find(s => detection.growth_stage?.toLowerCase().includes(s.toLowerCase())) || '';
  const meta = STAGE_META[stageKey] || { emoji: '🌱', color: '#10b981', bg: '#f0fdf4' };
  const stageIndex = STAGES.indexOf(stageKey);
  const heightPct = detection.plant_height_cm ? Math.min((detection.plant_height_cm / 90) * 100, 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

      {/* ── Plant Hero Card ── */}
      <View style={[styles.heroCard, { borderTopColor: meta.color }]}>
        {/* ID + Age */}
        <View style={styles.heroTopRow}>
          <View style={[styles.idPill, { backgroundColor: meta.color }]}>
            <Text style={styles.idPillText}>{meta.emoji}  Plant #{detection.plant_id ?? '—'}</Text>
          </View>
          {plantAge && (
            <View style={styles.agePill}>
              <Text style={styles.agePillText}>🗓️  {plantAge}</Text>
            </View>
          )}
        </View>

        {/* Stage */}
        <View style={styles.stageRow}>
          <View style={[styles.stageIconBox, { backgroundColor: meta.bg }]}>
            <Text style={styles.stageIconText}>{meta.emoji}</Text>
          </View>
          <View style={styles.stageInfo}>
            <Text style={[styles.stageName, { color: meta.color }]}>{detection.growth_stage}</Text>
            <Text style={styles.stageConf}>{Math.round(detection.confidence * 100)}% confidence</Text>
            <View style={styles.stageDots}>
              {STAGES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      width: i === stageIndex ? 18 : 8,
                      backgroundColor: i <= stageIndex ? meta.color : '#e5e7eb',
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Height bar */}
        {detection.plant_height_cm != null && (
          <View style={styles.heightSection}>
            <View style={styles.heightLabelRow}>
              <Text style={styles.heightLabel}>📏  Plant Height(Approx.)</Text>
              <Text style={[styles.heightValue, { color: meta.color }]}>
                {Math.floor(detection.plant_height_cm)} cm
              </Text>
            </View>
            <View style={styles.heightBarBg}>
              <View style={[styles.heightBarFill, { width: `${heightPct}%`, backgroundColor: meta.color }]} />
            </View>
            <View style={styles.heightScaleRow}>
              <Text style={styles.heightScaleText}>0 cm</Text>
              <Text style={styles.heightScaleText}>30 cm</Text>
              <Text style={styles.heightScaleText}>60 cm</Text>
              <Text style={styles.heightScaleText}>90 cm</Text>
            </View>
          </View>
        )}

        {/* Count chips */}
        <View style={styles.countsRow}>
          <View style={[styles.countChip, { backgroundColor: '#f0fdf4', borderColor: '#10b981' }]}>
            <Text style={styles.countEmoji}>🍃</Text>
            <Text style={styles.countNum}>{detection.leaves_count}</Text>
            <Text style={styles.countLbl}>Approx. Leaves</Text>
          </View>
          <View style={[styles.countChip, { backgroundColor: '#fdf4ff', borderColor: '#d946ef' }]}>
            <Text style={styles.countEmoji}>🌸</Text>
            <Text style={styles.countNum}>{detection.flowers_count}</Text>
            <Text style={styles.countLbl}>Approx. Flowers</Text>
          </View>
          <View style={[styles.countChip, { backgroundColor: '#fff7ed', borderColor: '#f97316' }]}>
            <Text style={styles.countEmoji}>🌶️</Text>
            <Text style={styles.countNum}>{detection.fruits_count}</Text>
            <Text style={styles.countLbl}>Approx. Fruits</Text>
          </View>
        </View>
      </View>

      {/* ── Warnings ── */}
      {recommendation.warnings && recommendation.warnings.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleIcon}>⚠️</Text>
            <Text style={styles.cardTitle}>Warnings</Text>
          </View>
          {recommendation.warnings.map((w, i) => (
            <View key={i} style={styles.warningItem}>
              <View style={styles.warningDot} />
              <Text style={styles.warningText}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Fertilizer Week Plan — Timeline ── */}
      <View style={styles.card}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.cardTitleIcon}>📅</Text>
          <Text style={styles.cardTitle}>Weekly Fertilizer Plan</Text>
        </View>

        <View style={styles.timeline}>
          {recommendation.week_plan.map((day, index) => {
            const accent = DAY_ACCENTS[index % DAY_ACCENTS.length];
            const isLast = index === recommendation.week_plan.length - 1;
            return (
              <View key={index} style={styles.timelineItem}>
                {/* Left: node + connector line */}
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineNode, { backgroundColor: accent }]}>
                    <Text style={styles.timelineNodeText}>{index + 1}</Text>
                  </View>
                  {!isLast && (
                    <View style={[styles.timelineLine, { backgroundColor: accent + '55' }]} />
                  )}
                </View>

                {/* Right: content card */}
                <View style={[styles.timelineContent, { borderLeftColor: accent }]}>
                  {/* Day header */}
                  <View style={[styles.tlDayHeader, { backgroundColor: accent + '18' }]}>
                    <Text style={[styles.tlDayName, { color: accent }]}>{day.day}</Text>
                  </View>

                  {/* Fertilizer name */}
                  <View style={styles.tlFertRow}>
                    <View style={[styles.tlFertDot, { backgroundColor: accent }]} />
                    <Text style={[styles.tlFertName, { color: accent }]}>{day.fertilizer_type}</Text>
                  </View>

                  {/* Details */}
                  <View style={styles.tlDetails}>
                    <View style={styles.tlDetailRow}>
                      <Text style={styles.tlDetailIcon}>📊</Text>
                      <View style={styles.tlDetailBody}>
                        <Text style={styles.tlDetailLabel}>Amount</Text>
                        <Text style={styles.tlDetailValue}>{day.amount}</Text>
                        {day.amount_adjusted && (
                          <Text style={styles.tlDetailAdjusted}>⚖️ {day.amount_adjusted}</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.tlDetailRow}>
                      <Text style={styles.tlDetailIcon}>🎯</Text>
                      <View style={styles.tlDetailBody}>
                        <Text style={styles.tlDetailLabel}>Method</Text>
                        <Text style={styles.tlDetailValue}>{day.method}</Text>
                      </View>
                    </View>

                    <View style={[styles.tlDetailRow, styles.tlDetailRowLast]}>
                      <Text style={styles.tlDetailIcon}>💧</Text>
                      <View style={styles.tlDetailBody}>
                        <Text style={styles.tlDetailLabel}>Watering</Text>
                        <Text style={[styles.tlDetailValue, { color: '#2563eb' }]}>{day.watering}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Tips ── */}
      {recommendation.tips && recommendation.tips.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleIcon}>💡</Text>
            <Text style={styles.cardTitle}>Tips</Text>
          </View>
          {recommendation.tips.map((tip, i) => (
            <View key={i} style={styles.tipItem}>
              <View style={[styles.tipDot, { backgroundColor: meta.color }]} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Smart Advice (Benchmark Tips) ── */}
      {detection.plant_id && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleIcon}>🏆</Text>
            <Text style={styles.cardTitle}>Smart Advice</Text>
          </View>

          {smartLoading ? (
            <Text style={styles.smartStatusText}>Analysing peer plants...</Text>
          ) : smartAdvice?.status === 'insufficient_data' ? (
            <View style={styles.smartStatusBox}>
              <Text style={styles.smartStatusIcon}>📊</Text>
              <Text style={styles.smartStatusText}>{smartAdvice.tips[0]}</Text>
            </View>
          ) : smartAdvice?.status === 'not_configured' ? (
            <View style={styles.smartStatusBox}>
              <Text style={styles.smartStatusIcon}>⚙️</Text>
              <Text style={styles.smartStatusText}>Smart advice is not configured yet.</Text>
            </View>
          ) : smartAdvice ? (
            <>
              {/* Benchmark info row */}
              <View style={styles.benchmarkRow}>
                <View style={styles.benchmarkBadge}>
                  <Text style={styles.benchmarkBadgeText}>
                    {smartAdvice.benchmark_used === 'peers' ? '👥 Peer Benchmark' : '📋 Optimal Values'}
                  </Text>
                </View>
                {smartAdvice.status === 'no_peers' && (
                  <Text style={styles.noPeersText}>No peers yet — using optimal values</Text>
                )}
              </View>

              {/* Growth rate comparison */}
              {smartAdvice.user_growth_rate_cm_per_day !== null && (
                <View style={styles.growthRateRow}>
                  <View style={styles.growthRateBox}>
                    <Text style={styles.growthRateLabel}>Your Growth</Text>
                    <Text style={[styles.growthRateValue, { color: meta.color }]}>
                      {smartAdvice.user_growth_rate_cm_per_day.toFixed(2)} cm/day
                    </Text>
                  </View>
                  {smartAdvice.benchmark_growth_rate_cm_per_day !== null && (
                    <View style={styles.growthRateBox}>
                      <Text style={styles.growthRateLabel}>Top Performers</Text>
                      <Text style={[styles.growthRateValue, { color: '#f59e0b' }]}>
                        {smartAdvice.benchmark_growth_rate_cm_per_day.toFixed(2)} cm/day
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Tips */}
              {smartAdvice.tips.length > 0 ? (
                smartAdvice.tips.map((tip, i) => (
                  <View key={i} style={styles.smartTipItem}>
                    <Text style={styles.smartTipIcon}>💡</Text>
                    <Text style={styles.smartTipText}>{tip}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.smartStatusBox}>
                  <Text style={styles.smartStatusIcon}>✅</Text>
                  <Text style={styles.smartStatusText}>
                    Your plant's conditions are close to top performers. Keep it up!
                  </Text>
                </View>
              )}
            </>
          ) : null}
        </View>
      )}

      {/* ── Disease Analysis ── */}
      {(diseaseImageUri || diseaseLoading || diseaseResult) && (
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitleIcon}>🔬</Text>
            <Text style={styles.cardTitle}>Disease Analysis</Text>
          </View>

          {diseaseLoading ? (
            <View style={styles.diseaseLoadingRow}>
              <ActivityIndicator size="small" color="#10b981" />
              <Text style={styles.diseaseLoadingText}>Analysing leaves…</Text>
            </View>
          ) : !diseaseResult || diseaseResult.status === 'no_leaf_detected' ? (
            <View style={styles.diseaseStatusBox}>
              <Text style={styles.diseaseStatusIcon}>🌿</Text>
              <Text style={styles.diseaseStatusText}>No leaf detected in the photo. Try a clearer image.</Text>
            </View>
          ) : (
            <>
              {/* Annotated image */}
              {diseaseResult.annotated_image && (
                <Image source={{ uri: diseaseResult.annotated_image }} style={styles.diseaseAnnotatedImg} resizeMode="contain" />
              )}

              {/* Summary pills */}
              {diseaseResult.disease_summary && Object.keys(diseaseResult.disease_summary).length > 0 && (
                <View style={styles.diseasePillRow}>
                  {Object.entries(diseaseResult.disease_summary).map(([d, count]) => {
                    const color = getDiseaseColor(d);
                    return (
                      <View key={d} style={[styles.diseasePill, { borderColor: color }]}>
                        <View style={[styles.diseasePillDot, { backgroundColor: color }]} />
                        <Text style={[styles.diseasePillName, { color }]}>{formatDisease(d)}</Text>
                        <View style={[styles.diseasePillBadge, { backgroundColor: color }]}>
                          <Text style={styles.diseasePillCount}>{count}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Recommendation cards */}
              {diseaseResult.recommendations && Object.values(diseaseResult.recommendations).map((rec, i) => {
                const color = getDiseaseColor(rec.disease);
                const sev = getSevConfig(rec.severity);
                return (
                  <View key={i} style={[styles.diseaseRecCard, { borderLeftColor: color }]}>
                    <View style={styles.diseaseRecHeader}>
                      <View style={[styles.diseaseRecDot, { backgroundColor: color }]} />
                      <Text style={[styles.diseaseRecTitle, { color }]}>{formatDisease(rec.disease)}</Text>
                      {sev && (
                        <View style={[styles.diseaseSevBadge, { backgroundColor: sev.bg }]}>
                          <View style={[styles.diseaseSevDot, { backgroundColor: sev.dot }]} />
                          <Text style={[styles.diseaseSevText, { color: sev.color }]}>{sev.label}</Text>
                        </View>
                      )}
                    </View>
                    {!!rec.description && <Text style={styles.diseaseRecDesc}>{rec.description}</Text>}
                    {rec.treatments.map((t, j) => (
                      <View key={j} style={styles.diseaseTreatRow}>
                        <Text style={[styles.diseaseTreatBullet, { color }]}>›</Text>
                        <Text style={styles.diseaseTreatText}>{t}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}
            </>
          )}
        </View>
      )}

      {/* ── Actions ── */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.push('/')}>
          <Text style={styles.homeBtnText}>🏠  Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.newBtn, { backgroundColor: meta.color }]} onPress={() => router.push('/growth/camera')}>
          <Text style={styles.newBtnText}>📸  New Scan</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  scrollContent: { paddingBottom: 40 },

  // ── Hero card ──
  heroCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  idPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  idPillText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  agePill: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  agePillText: { color: '#374151', fontWeight: '600', fontSize: 13 },

  stageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stageIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stageIconText: { fontSize: 30 },
  stageInfo: { flex: 1 },
  stageName: { fontSize: 18, fontWeight: '800', marginBottom: 3 },
  stageConf: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },
  stageDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { height: 8, borderRadius: 4 },

  heightSection: { marginBottom: 20 },
  heightLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  heightLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  heightValue: { fontSize: 15, fontWeight: '800' },
  heightBarBg: { height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden' },
  heightBarFill: { height: 10, borderRadius: 5 },
  heightScaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  heightScaleText: { fontSize: 10, color: '#9ca3af' },

  countsRow: { flexDirection: 'row', gap: 8 },
  countChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  countEmoji: { fontSize: 22, marginBottom: 4 },
  countNum: { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  countLbl: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  // ── Generic card ──
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 18,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitleIcon: { fontSize: 20, marginRight: 8 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#1f2937' },

  // Warnings
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b',
    marginTop: 5, marginRight: 10,
  },
  warningText: { flex: 1, fontSize: 14, color: '#78350f', lineHeight: 20 },

  // ── Timeline ──
  timeline: { marginTop: 4 },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineLeft: {
    width: 36,
    alignItems: 'center',
    marginRight: 12,
  },
  timelineNode: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineNodeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 4,
    marginBottom: 0,
    minHeight: 20,
  },
  timelineContent: {
    flex: 1,
    marginBottom: 16,
    borderRadius: 14,
    borderLeftWidth: 3,
    backgroundColor: '#fafafa',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  tlDayHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tlDayName: { fontSize: 15, fontWeight: '800' },
  tlFertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  tlFertDot: { width: 8, height: 8, borderRadius: 4 },
  tlFertName: { flex: 1, fontSize: 13, fontWeight: '700' },
  tlDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  tlDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  tlDetailRowLast: { borderBottomWidth: 0 },
  tlDetailIcon: { fontSize: 15, marginTop: 2 },
  tlDetailBody: { flex: 1 },
  tlDetailLabel: {
    fontSize: 10,
    color: '#9ca3af',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  tlDetailValue: { fontSize: 13, fontWeight: '600', color: '#1f2937', lineHeight: 18 },
  tlDetailAdjusted: { fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginTop: 2 },

  // Tips
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  tipDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, marginRight: 10 },
  tipText: { flex: 1, fontSize: 14, color: '#374151', lineHeight: 20 },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
  },
  homeBtn: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: '#fff',
  },
  homeBtnText: { fontSize: 15, fontWeight: '700', color: '#10b981' },
  newBtn: {
    flex: 2,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  newBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },

  // Smart Advice card
  smartStatusBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  smartStatusIcon: { fontSize: 20 },
  smartStatusText: { flex: 1, fontSize: 13, color: '#6b7280', lineHeight: 19 },
  benchmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  benchmarkBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  benchmarkBadgeText: { fontSize: 12, fontWeight: '700', color: '#065f46' },
  noPeersText: { fontSize: 11, color: '#9ca3af', flex: 1 },
  growthRateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  growthRateBox: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  growthRateLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', marginBottom: 4 },
  growthRateValue: { fontSize: 16, fontWeight: '800' },
  smartTipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
    gap: 10,
  },
  smartTipIcon: { fontSize: 16 },
  smartTipText: { flex: 1, fontSize: 13, color: '#78350f', lineHeight: 19 },

  // Disease Analysis
  diseaseLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  diseaseLoadingText: { fontSize: 14, color: '#6b7280' },
  diseaseStatusBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, gap: 10 },
  diseaseStatusIcon: { fontSize: 20 },
  diseaseStatusText: { flex: 1, fontSize: 13, color: '#6b7280', lineHeight: 19 },
  diseaseAnnotatedImg: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#f3f4f6', marginBottom: 14 },
  diseasePillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  diseasePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  diseasePillDot: { width: 7, height: 7, borderRadius: 4 },
  diseasePillName: { fontSize: 13, fontWeight: '600' },
  diseasePillBadge: { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  diseasePillCount: { fontSize: 11, fontWeight: '800', color: '#fff' },
  diseaseRecCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderWidth: 1, borderColor: '#f0f0f0' },
  diseaseRecHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  diseaseRecDot: { width: 9, height: 9, borderRadius: 5 },
  diseaseRecTitle: { fontSize: 15, fontWeight: '700' },
  diseaseSevBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 4 },
  diseaseSevDot: { width: 6, height: 6, borderRadius: 3 },
  diseaseSevText: { fontSize: 11, fontWeight: '600' },
  diseaseRecDesc: { fontSize: 13, color: '#78716c', fontStyle: 'italic', marginBottom: 8, lineHeight: 19 },
  diseaseTreatRow: { flexDirection: 'row', gap: 8, marginBottom: 5, paddingLeft: 4 },
  diseaseTreatBullet: { fontSize: 18, fontWeight: '700', lineHeight: 22 },
  diseaseTreatText: { flex: 1, fontSize: 13, color: '#44403c', lineHeight: 20 },
});
