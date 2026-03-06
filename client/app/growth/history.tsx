import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGrowthHistory, HistoryItem } from '@/services/api';
import {
  getRegistry,
  PlantRecord,
  calcAge,
  calcAgeFull,
} from '@/utils/plantRegistry';

// ── Growth stage metadata ────────────────────────────────────────────────────
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
  return idx >= 0 ? STAGES[idx] : { label: stage, color: '#9ca3af', bg: '#f9fafb', icon: '🌱' };
}

// ── Stage progress dots ──────────────────────────────────────────────────────
function StageProgress({ stage }: { stage: string }) {
  const current = stageIndex(stage);
  return (
    <View style={prog.row}>
      {STAGES.map((s, i) => {
        const active   = i <= current;
        const current_ = i === current;
        return (
          <React.Fragment key={i}>
            <View style={[prog.dot, {
              backgroundColor: active ? s.color : '#e5e7eb',
              width: current_ ? 10 : 7, height: current_ ? 10 : 7,
              borderRadius: 5,
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
  row:  { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
  dot:  { borderRadius: 5 },
  line: { flex: 1, height: 2, marginHorizontal: 3 },
});

// ── Plant monitor card ───────────────────────────────────────────────────────
interface PlantMonitorCardProps {
  plantId: number;
  sessions: HistoryItem[];   // sorted most-recent first
  plantRecord: PlantRecord | null;
  onPress: () => void;
}

function PlantMonitorCard({ plantId, sessions, plantRecord, onPress }: PlantMonitorCardProps) {
  const latest = sessions[0];
  const asc    = [...sessions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const oldest = asc[0];
  const info   = stageInfo(latest.growth_stage);

  const latestH = latest.plant_height_cm ?? null;
  const oldestH = oldest.plant_height_cm ?? null;
  const heightGain = latestH != null && oldestH != null ? +(latestH - oldestH).toFixed(1) : null;

  const ageLabel = plantRecord
    ? calcAgeFull(plantRecord.startDate)
    : `Since ${new Date(oldest.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Mini height bars (up to 5 most-recent scans, asc order for left→right)
  const barSessions = asc.slice(-5).filter(s => s.plant_height_cm && s.plant_height_cm > 0);
  const maxH = barSessions.length ? Math.max(...barSessions.map(s => s.plant_height_cm!)) : 1;

  return (
    <TouchableOpacity style={[pm.card, { borderColor: info.color }]} onPress={onPress} activeOpacity={0.85}>
      {/* ── Top row: ID badge + scan count */}
      <View style={pm.topRow}>
        <View style={pm.idBadge}>
          <Text style={pm.idText}>🏷️  Plant #{plantId}</Text>
        </View>
        <Text style={pm.scanCount}>{sessions.length} scan{sessions.length !== 1 ? 's' : ''}</Text>
      </View>

      <View style={pm.body}>
        {/* ── Thumbnail */}
        <View style={pm.thumbWrap}>
          {latest.original_image_url ? (
            <Image source={{ uri: latest.original_image_url }} style={pm.thumb} resizeMode="cover" />
          ) : (
            <View style={pm.thumbPlaceholder}>
              <Text style={{ fontSize: 28 }}>{info.icon}</Text>
            </View>
          )}
          <View style={[pm.thumbBadge, { backgroundColor: info.color }]}>
            <Text style={pm.thumbBadgeText}>{info.icon}</Text>
          </View>
        </View>

        {/* ── Info */}
        <View style={pm.info}>
          {/* Age */}
          <Text style={pm.ageText}>{ageLabel}</Text>

          {/* Current stage */}
          <Text style={[pm.stageText, { color: info.color }]}>{latest.growth_stage}</Text>

          {/* Stage progress */}
          <StageProgress stage={latest.growth_stage} />

          {/* Height trend */}
          {latestH != null && latestH > 0 && (
            <View style={pm.heightRow}>
              <Text style={pm.heightIcon}>📏</Text>
              {oldestH != null && oldestH !== latestH && (
                <>
                  <Text style={pm.heightOld}>{oldestH.toFixed(1)}</Text>
                  <Text style={pm.heightArrow}> → </Text>
                </>
              )}
              <Text style={[pm.heightCurrent, { color: info.color }]}>{latestH.toFixed(1)} cm</Text>
              {heightGain !== null && heightGain !== 0 && (
                <Text style={[pm.heightGain, { color: heightGain > 0 ? '#22c55e' : '#ef4444' }]}>
                  {'  '}({heightGain > 0 ? '+' : ''}{heightGain})
                </Text>
              )}
            </View>
          )}

          {/* Mini bar chart */}
          {barSessions.length > 1 && (
            <View style={pm.miniChart}>
              {barSessions.map((s, i) => {
                const h = s.plant_height_cm!;
                const barInfo = stageInfo(s.growth_stage);
                return (
                  <View key={i} style={pm.miniBarWrap}>
                    <View style={[pm.miniBar, {
                      height: Math.max(4, Math.round((h / maxH) * 30)),
                      backgroundColor: barInfo.color,
                    }]} />
                  </View>
                );
              })}
            </View>
          )}

          {/* Last scan */}
          <Text style={pm.lastScan}>Last scan: {formatDate(latest.created_at)}</Text>
        </View>
      </View>

      <View style={pm.arrowWrap}>
        <Text style={pm.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const pm = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 14,
    borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  idBadge: {
    backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  idText:     { fontSize: 12, fontWeight: '700', color: '#7c3aed' },
  scanCount:  { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  body:       { flexDirection: 'row', padding: 12, gap: 12, flex: 1 },
  thumbWrap:  { width: 90, position: 'relative' },
  thumb:      { width: 90, height: 110, borderRadius: 10 },
  thumbPlaceholder: {
    width: 90, height: 110, borderRadius: 10,
    backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center',
  },
  thumbBadge: {
    position: 'absolute', bottom: 4, left: 4,
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  thumbBadgeText: { fontSize: 14 },
  info:       { flex: 1 },
  ageText:    { fontSize: 11, color: '#6b7280', marginBottom: 2 },
  stageText:  { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  heightRow:  { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
  heightIcon: { fontSize: 11, marginRight: 3 },
  heightOld:  { fontSize: 11, color: '#9ca3af', textDecorationLine: 'line-through' },
  heightArrow:{ fontSize: 11, color: '#9ca3af' },
  heightCurrent: { fontSize: 13, fontWeight: '700' },
  heightGain: { fontSize: 11, fontWeight: '600' },
  miniChart:  { flexDirection: 'row', alignItems: 'flex-end', height: 34, gap: 3, marginTop: 6 },
  miniBarWrap:{ alignItems: 'center', flex: 1 },
  miniBar:    { width: 10, borderRadius: 3 },
  lastScan:   { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  arrowWrap:  { justifyContent: 'center', paddingRight: 12 },
  arrow:      { color: '#d1d5db', fontSize: 22 },
});

// ── History card (sessions view) ─────────────────────────────────────────────
function HistoryCard({ item, onPress }: { item: HistoryItem; onPress: () => void }) {
  const info = stageInfo(item.growth_stage);

  const formatDate = (ds: string) =>
    new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const formatTime = (ds: string) =>
    new Date(ds).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <TouchableOpacity style={[card.wrapper, { borderLeftColor: info.color }]} onPress={onPress} activeOpacity={0.85}>
      <View style={card.imageWrap}>
        {item.original_image_url ? (
          <Image source={{ uri: item.original_image_url }} style={card.image} resizeMode="cover" />
        ) : (
          <View style={[card.image, card.imagePlaceholder]}>
            <Text style={card.imagePlaceholderIcon}>🌱</Text>
          </View>
        )}
        <View style={[card.stageBadge, { backgroundColor: info.color }]}>
          <Text style={card.stageBadgeText}>{info.icon} {info.label}</Text>
        </View>
      </View>

      <View style={card.body}>
        <StageProgress stage={item.growth_stage} />

        <View style={card.row}>
          <Text style={card.dateText}>{formatDate(item.created_at)}</Text>
          <Text style={card.timeText}>{formatTime(item.created_at)}</Text>
        </View>

        <View style={card.countsRow}>
          {item.leaf_count > 0 && (
            <View style={[card.countChip, { backgroundColor: '#dcfce7' }]}>
              <Text style={[card.countChipText, { color: '#16a34a' }]}>🍃 {item.leaf_count}</Text>
            </View>
          )}
          {item.flower_count > 0 && (
            <View style={[card.countChip, { backgroundColor: '#fef9c3' }]}>
              <Text style={[card.countChipText, { color: '#b45309' }]}>🌸 {item.flower_count}</Text>
            </View>
          )}
          {item.fruit_count > 0 && (
            <View style={[card.countChip, { backgroundColor: '#ffedd5' }]}>
              <Text style={[card.countChipText, { color: '#c2410c' }]}>🌶️ {item.fruit_count}</Text>
            </View>
          )}
        </View>

        {item.plant_height_cm != null && item.plant_height_cm > 0 && (
          <View style={card.heightRow}>
            <Text style={card.heightLabel}>📏 Height</Text>
            <View style={card.heightBarBg}>
              <View style={[card.heightBarFill, {
                width: `${Math.min((item.plant_height_cm / 60) * 100, 100)}%` as any,
                backgroundColor: info.color,
              }]} />
            </View>
            <Text style={[card.heightValue, { color: info.color }]}>{Math.floor(item.plant_height_cm)} cm</Text>
          </View>
        )}

        <View style={card.envRow}>
          {item.plant_id != null && (
            <View style={[card.envChip, { backgroundColor: '#ede9fe' }]}>
              <Text style={[card.envLabel, { color: '#7c3aed' }]}>🏷️</Text>
              <Text style={[card.envValue, { color: '#7c3aed' }]}>#{item.plant_id}</Text>
            </View>
          )}
          {item.ph > 0 && (
            <View style={card.envChip}>
              <Text style={card.envLabel}>pH</Text>
              <Text style={card.envValue}>{item.ph.toFixed(1)}</Text>
            </View>
          )}
          {item.temperature > 0 && (
            <View style={card.envChip}>
              <Text style={card.envLabel}>🌡️</Text>
              <Text style={card.envValue}>{item.temperature.toFixed(0)}°C</Text>
            </View>
          )}
          {item.location ? (
            <View style={card.envChip}>
              <Text style={card.envLabel}>📍</Text>
              <Text style={card.envValue} numberOfLines={1}>{item.location}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={card.arrow}>
        <Text style={{ color: '#d1d5db', fontSize: 18 }}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff', borderRadius: 16, marginBottom: 14,
    flexDirection: 'row', overflow: 'hidden', borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  imageWrap: { width: 100, position: 'relative', alignSelf: 'stretch' },
  image: { width: 100, height: 140 },
  imagePlaceholder: { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderIcon: { fontSize: 32 },
  stageBadge: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingVertical: 3, paddingHorizontal: 4, alignItems: 'center',
  },
  stageBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  body: { flex: 1, padding: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  dateText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  timeText: { fontSize: 12, color: '#9ca3af' },
  countsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  countChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  countChipText: { fontSize: 11, fontWeight: '600' },
  heightRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  heightLabel: { fontSize: 10, color: '#6b7280', fontWeight: '600', width: 48 },
  heightBarBg: { flex: 1, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' },
  heightBarFill: { height: '100%', borderRadius: 3 },
  heightValue: { fontSize: 11, fontWeight: '700', width: 42, textAlign: 'right' },
  envRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  envChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#f3f4f6', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20,
  },
  envLabel: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
  envValue: { fontSize: 11, color: '#374151', fontWeight: '600', maxWidth: 80 },
  arrow: { justifyContent: 'center', paddingHorizontal: 10 },
});

// ── Plants summary banner ────────────────────────────────────────────────────
function PlantsSummary({ plantCount, sessionCount, latestStage }: {
  plantCount: number;
  sessionCount: number;
  latestStage: string;
}) {
  const info = stageInfo(latestStage);
  return (
    <View style={[smr.wrap, { backgroundColor: info.bg, borderColor: info.color }]}>
      <Text style={smr.icon}>{info.icon}</Text>
      <View style={smr.right}>
        <Text style={[smr.title, { color: info.color }]}>My Plants</Text>
        <Text style={smr.sub}>{plantCount} plant{plantCount !== 1 ? 's' : ''} tracked  •  {sessionCount} scans total</Text>
        <Text style={smr.stage}>Latest stage: {latestStage}</Text>
      </View>
    </View>
  );
}

const smr = StyleSheet.create({
  wrap: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 14, borderWidth: 1.5,
    flexDirection: 'row', padding: 14, alignItems: 'center',
  },
  icon:  { fontSize: 40, marginRight: 14 },
  right: { flex: 1 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  sub:   { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  stage: { fontSize: 12, color: '#374151', fontWeight: '600' },
});

// ── Sessions summary banner (sessions tab) ───────────────────────────────────
function SessionsSummary({ history }: { history: HistoryItem[] }) {
  if (history.length === 0) return null;
  const latest      = history[0];
  const info        = stageInfo(latest.growth_stage);
  return (
    <View style={[banner.wrap, { backgroundColor: info.bg, borderColor: info.color }]}>
      <View style={banner.left}><Text style={banner.icon}>{info.icon}</Text></View>
      <View style={banner.right}>
        <Text style={[banner.stage, { color: info.color }]}>{latest.growth_stage}</Text>
        <Text style={banner.sub}>Latest stage  •  {history.length} scans total</Text>
      </View>
    </View>
  );
}

const banner = StyleSheet.create({
  wrap: {
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    borderRadius: 14, borderWidth: 1.5,
    flexDirection: 'row', padding: 14, alignItems: 'center',
  },
  left:  { marginRight: 14 },
  icon:  { fontSize: 40 },
  right: { flex: 1 },
  stage: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  sub:   { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  stat:  { fontSize: 12, color: '#374151', fontWeight: '600' },
});

// ── Main screen ──────────────────────────────────────────────────────────────
export default function HistoryScreen() {
  const router = useRouter();
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory]       = useState<HistoryItem[]>([]);
  const [userEmail, setUserEmail]   = useState('');
  const [registry, setRegistry]     = useState<Record<string, any>>({});
  const [viewMode, setViewMode]     = useState<'plants' | 'sessions'>('plants');
  const [filterPlantId, setFilterPlantId] = useState<number | null>(null);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        Alert.alert('Error', 'Please login first');
        router.replace('/(auth)/login');
        return;
      }
      setUserEmail(email);
      const [sessions, reg] = await Promise.all([
        getGrowthHistory(email),
        getRegistry(),
      ]);
      setHistory(sessions);
      setRegistry(reg);
    } catch {
      Alert.alert('Error', 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const [sessions, reg] = await Promise.all([
        getGrowthHistory(userEmail),
        getRegistry(),
      ]);
      setHistory(sessions);
      setRegistry(reg);
    } catch {
      Alert.alert('Error', 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  // Group sessions by plant_id (sorted most-recent first)
  const plantGroups = useMemo(() => {
    const map = new Map<number, HistoryItem[]>();
    for (const item of history) {
      if (item.plant_id != null) {
        const arr = map.get(item.plant_id) ?? [];
        arr.push(item);
        map.set(item.plant_id, arr);
      }
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return map;
  }, [history]);

  const plantIds = useMemo(() =>
    Array.from(plantGroups.keys()).sort((a, b) => a - b),
    [plantGroups]);

  const unlinked = useMemo(() =>
    history.filter(h => h.plant_id == null)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [history]);

  // Sessions shown in sessions tab (all or filtered by plant)
  const visibleSessions = useMemo(() => {
    if (filterPlantId != null) {
      return plantGroups.get(filterPlantId) ?? [];
    }
    return [...history].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [history, filterPlantId, plantGroups]);

  const latestStage = history.length ? history.reduce((latest, h) =>
    new Date(h.created_at) > new Date(latest.created_at) ? h : latest
  ).growth_stage : '';

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading growth journal…</Text>
      </SafeAreaView>
    );
  }

  // ── Plant tab items list ──────────────────────────────────────────────────
  const plantsListData: Array<
    | { type: 'summary' }
    | { type: 'plant'; plantId: number }
    | { type: 'unlinkedHeader' }
    | { type: 'session'; item: HistoryItem }
  > = [];

  if (plantIds.length > 0) {
    plantsListData.push({ type: 'summary' });
    for (const id of plantIds) plantsListData.push({ type: 'plant', plantId: id });
  }
  if (unlinked.length > 0) {
    plantsListData.push({ type: 'unlinkedHeader' });
    for (const item of unlinked) plantsListData.push({ type: 'session', item });
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🌱 Growth Journal</Text>
          <Text style={styles.headerSub}>
            {plantIds.length} plant{plantIds.length !== 1 ? 's' : ''}  •  {history.length} scan{history.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* ── Tab toggle */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'plants' && styles.tabActive]}
          onPress={() => { setViewMode('plants'); setFilterPlantId(null); }}
        >
          <Text style={[styles.tabText, viewMode === 'plants' && styles.tabTextActive]}>
            🌿 Plants
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'sessions' && styles.tabActive]}
          onPress={() => { setViewMode('sessions'); setFilterPlantId(null); }}
        >
          <Text style={[styles.tabText, viewMode === 'sessions' && styles.tabTextActive]}>
            📋 Sessions
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Plants view */}
      {viewMode === 'plants' && (
        <FlatList
          data={plantsListData}
          keyExtractor={(item, i) =>
            item.type === 'plant' ? `plant-${item.plantId}` :
            item.type === 'session' ? `sess-${item.item.id}` :
            `${item.type}-${i}`
          }
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>📷</Text>
              <Text style={styles.emptyTitle}>No plants tracked yet</Text>
              <Text style={styles.emptySub}>Scan your plant to start the growth journal</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/growth/camera')}>
                <Text style={styles.emptyBtnText}>Start Scanning</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === 'summary') {
              return (
                <PlantsSummary
                  plantCount={plantIds.length}
                  sessionCount={history.length}
                  latestStage={latestStage}
                />
              );
            }
            if (item.type === 'plant') {
              const sessions = plantGroups.get(item.plantId)!;
              const plantRecord = registry[String(item.plantId)] ?? null;
              return (
                <PlantMonitorCard
                  plantId={item.plantId}
                  sessions={sessions}
                  plantRecord={plantRecord}
                  onPress={() => {
                    setFilterPlantId(item.plantId);
                    setViewMode('sessions');
                  }}
                />
              );
            }
            if (item.type === 'unlinkedHeader') {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>Unlinked Scans</Text>
                </View>
              );
            }
            if (item.type === 'session') {
              return (
                <HistoryCard
                  item={item.item}
                  onPress={() => router.push({ pathname: '/growth/session-details', params: { sessionId: item.item.id } })}
                />
              );
            }
            return null;
          }}
        />
      )}

      {/* ── Sessions view */}
      {viewMode === 'sessions' && (
        <>
          {/* Filter bar (when viewing a specific plant) */}
          {filterPlantId != null && (
            <View style={styles.filterBar}>
              <TouchableOpacity
                style={styles.filterBackBtn}
                onPress={() => { setFilterPlantId(null); setViewMode('plants'); }}
              >
                <Text style={styles.filterBackText}>‹ Plants</Text>
              </TouchableOpacity>
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>🏷️ Plant #{filterPlantId}</Text>
              </View>
              <Text style={styles.filterCount}>{visibleSessions.length} scans</Text>
            </View>
          )}

          <FlatList
            data={visibleSessions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={filterPlantId == null ? <SessionsSummary history={visibleSessions} /> : null}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>📷</Text>
                <Text style={styles.emptyTitle}>No entries yet</Text>
                <Text style={styles.emptySub}>Scan your plant to start the growth journal</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/growth/camera')}>
                  <Text style={styles.emptyBtnText}>Start Scanning</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <HistoryCard
                item={item}
                onPress={() => router.push({ pathname: '/growth/session-details', params: { sessionId: item.id } })}
              />
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f9fafb' },
  loading:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6b7280' },

  header: {
    paddingTop: 20, paddingBottom: 12, paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#14532d' },
  headerSub:   { fontSize: 13, color: '#6b7280', marginTop: 2 },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
    paddingHorizontal: 16, paddingBottom: 0,
  },
  tab: {
    flex: 1, paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#22c55e' },
  tabText:   { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#14532d' },

  // Filter bar
  filterBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#f0fdf4', borderBottomWidth: 1, borderBottomColor: '#bbf7d0',
    gap: 10,
  },
  filterBackBtn:  { paddingVertical: 4, paddingRight: 6 },
  filterBackText: { fontSize: 14, fontWeight: '700', color: '#22c55e' },
  filterBadge:    { backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  filterBadgeText:{ fontSize: 12, fontWeight: '700', color: '#7c3aed' },
  filterCount:    { marginLeft: 'auto', fontSize: 12, color: '#6b7280' },

  // Section
  sectionHeader: { paddingHorizontal: 4, paddingTop: 16, paddingBottom: 6 },
  sectionHeaderText: { fontSize: 13, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },

  list:        { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  emptyWrap:   { paddingTop: 60, alignItems: 'center', paddingHorizontal: 32 },
  emptyIcon:   { fontSize: 64, marginBottom: 16 },
  emptyTitle:  { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  emptySub:    { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:    { backgroundColor: '#22c55e', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText:{ color: '#fff', fontSize: 16, fontWeight: '700' },
});
