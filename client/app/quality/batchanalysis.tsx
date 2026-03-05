import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  RefreshControl,
} from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllBatches } from "../../services/api";

interface BatchData {
  id: string;
  batch_id: string;
  total_peppers: number;
  grade_a: number;
  grade_b: number;
  grade_c: number;
  grade_d: number;
  created_at: string;
}

export default function BatchAnalysis() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allBatches, setAllBatches] = useState<BatchData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pepperRotation = useRef(new Animated.Value(0)).current;

  // Spinning animation for pepper
  useEffect(() => {
    if (loading) {
      const spinAnimation = Animated.loop(
        Animated.timing(pepperRotation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );
      spinAnimation.start();
      return () => spinAnimation.stop();
    }
  }, [loading, pepperRotation]);

  // Load batches on mount
  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const storedUserId = await AsyncStorage.getItem('userId');

      if (!storedUserId) {
        setError("User not found. Please login again.");
        setAllBatches([]);
        return;
      }

      const response = await getAllBatches(storedUserId);
      
      if (response.success && response.batches && response.batches.length > 0) {
        // Sort batches by created_at in descending order (newest first)
        const sortedBatches = [...response.batches].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setAllBatches(sortedBatches);
      } else {
        setError(response?.error || "No batches found for your account. Please upload and grade some peppers first.");
      }
    } catch (err) {
      console.error("Error loading batches:", err);
      setError("Failed to load batch data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBatches();
    setRefreshing(false);
  };

  // Get current and previous batch
  const currentBatch = allBatches.length > 0 ? allBatches[0] : null;
  const previousBatch = allBatches.length > 1 ? allBatches[1] : null;

  // ---------------- CALCULATIONS ----------------
  const calcPercentage = (value: number, total: number) =>
    total === 0 ? 0 : Math.round((value / total) * 100);

  // Show loading state
  if (loading) {
    const spinValue = pepperRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Animated.Text style={{fontSize: 80, marginBottom: 16, transform: [{rotate: spinValue}]}}>🌶️</Animated.Text>
        <Text style={{ marginTop: 16, color: '#6b7280' }}>Loading batch data...</Text>
      </View>
    );
  }

  // Show error state
  if (error || !currentBatch) {
    return (
      <ScrollView 
        contentContainerStyle={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>📊 Batch Analysis Report</Text>
        <Text style={styles.subtitle}>Scotch Bonnet Quality Grading</Text>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>📭</Text>
          <Text style={styles.emptyText}>{error || "No batch data available"}</Text>
          <Text style={styles.emptyHint}>Pull down to refresh and load data</Text>
        </View>
      </ScrollView>
    );
  }

  const prevA = previousBatch ? calcPercentage(previousBatch.grade_a, previousBatch.total_peppers) : 0;
  const currA = calcPercentage(currentBatch.grade_a, currentBatch.total_peppers);
  const prevB = previousBatch ? calcPercentage(previousBatch.grade_b, previousBatch.total_peppers) : 0;
  const currB = calcPercentage(currentBatch.grade_b, currentBatch.total_peppers);
  const prevC = previousBatch ? calcPercentage(previousBatch.grade_c, previousBatch.total_peppers) : 0;
  const currC = calcPercentage(currentBatch.grade_c, currentBatch.total_peppers);
  const prevD = previousBatch ? calcPercentage(previousBatch.grade_d, previousBatch.total_peppers) : 0;
  const currD = calcPercentage(currentBatch.grade_d, currentBatch.total_peppers);

  let trendText = "Quality is stable.";
  let trendColor = "#16a34a";

  if (previousBatch) {
    if (currD > prevD) {
      trendText = `Quality declined. Below Standard (Grade D) increased by ${currD - prevD}% 📉`;
      trendColor = "#dc2626";
    } else if (currD < prevD) {
      trendText = `Quality improved! Below Standard (Grade D) decreased by ${prevD - currD}% 📈`;
      trendColor = "#16a34a";
    } else {
      trendText = "Quality is stable. No change in defect rates.";
      trendColor = "#16a34a";
    }
  } else {
    trendText = "This is your first batch! Scan more batches to compare trends.";
    trendColor = "#3b82f6";
  }

  // Format date (Sri Lanka timezone UTC+5:30)
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      timeZone: 'Asia/Colombo'
    });
  };

  // -------- UI --------
  return (
    <ScrollView 
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Title */}
      <Text style={styles.title}>📊 Batch Analysis Report</Text>
      <Text style={styles.subtitle}>Compare your scotch bonnet batch grades</Text>

      {/* Comparison Summary Section */}
      <View style={[styles.card, styles.comparisonCard]}>
        <Text style={styles.sectionTitle}>Current vs Previous Batch Comparison</Text>
        
        {previousBatch && (
          <View style={styles.comparisonContent}>
            <View style={styles.comparisonItem}>
              <View style={styles.comparisonHeader}>
                <View>
                  <Text style={styles.comparisonLabel}>Current Batch</Text>
                  <Text style={styles.comparisonBatchId}>ID: {currentBatch.batch_id.substring(0, 8)}</Text>
                </View>
                <Text style={styles.comparisonDate}>{formatDateTime(currentBatch.created_at)}</Text>
              </View>
              <Text style={styles.comparisonDetail}>Total: {currentBatch.total_peppers} peppers</Text>
              
              <View style={styles.gradesGrid}>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade A:</Text>
                  <Text style={styles.gradeGridValue}>{currA}% ({currentBatch.grade_a})</Text>
                </View>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade B:</Text>
                  <Text style={styles.gradeGridValue}>{currB}% ({currentBatch.grade_b})</Text>
                </View>
              </View>
              
              <View style={styles.gradesGrid}>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade C:</Text>
                  <Text style={styles.gradeGridValue}>{currC}% ({currentBatch.grade_c})</Text>
                </View>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade D:</Text>
                  <Text style={styles.gradeGridValue}>{currD}% ({currentBatch.grade_d})</Text>
                </View>
              </View>
            </View>

            <View style={styles.comparisonDivider} />

            <View style={styles.comparisonItem}>
              <View style={styles.comparisonHeader}>
                <View>
                  <Text style={styles.comparisonLabel}>Previous Batch</Text>
                  <Text style={styles.comparisonBatchId}>ID: {previousBatch.batch_id.substring(0, 8)}</Text>
                </View>
                <Text style={styles.comparisonDate}>{formatDateTime(previousBatch.created_at)}</Text>
              </View>
              <Text style={styles.comparisonDetail}>Total: {previousBatch.total_peppers} peppers</Text>
              
              <View style={styles.gradesGrid}>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade A:</Text>
                  <Text style={styles.gradeGridValue}>{prevA}% ({previousBatch.grade_a})</Text>
                </View>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade B:</Text>
                  <Text style={styles.gradeGridValue}>{prevB}% ({previousBatch.grade_b})</Text>
                </View>
              </View>
              
              <View style={styles.gradesGrid}>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade C:</Text>
                  <Text style={styles.gradeGridValue}>{prevC}% ({previousBatch.grade_c})</Text>
                </View>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade D:</Text>
                  <Text style={styles.gradeGridValue}>{prevD}% ({previousBatch.grade_d})</Text>
                </View>
              </View>
            </View>
          </View>
        )}
        {!previousBatch && (
          <View style={styles.comparisonContent}>
            <View style={styles.comparisonItem}>
              <View style={styles.comparisonHeader}>
                <View>
                  <Text style={styles.comparisonLabel}>Current Batch (First Batch)</Text>
                  <Text style={styles.comparisonBatchId}>ID: {currentBatch.batch_id.substring(0, 8)}</Text>
                </View>
                <Text style={styles.comparisonDate}>{formatDateTime(currentBatch.created_at)}</Text>
              </View>
              <Text style={styles.comparisonDetail}>Total: {currentBatch.total_peppers} peppers</Text>
              
              <View style={styles.gradesGrid}>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade A:</Text>
                  <Text style={styles.gradeGridValue}>{currA}% ({currentBatch.grade_a})</Text>
                </View>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade B:</Text>
                  <Text style={styles.gradeGridValue}>{currB}% ({currentBatch.grade_b})</Text>
                </View>
              </View>
              
              <View style={styles.gradesGrid}>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade C:</Text>
                  <Text style={styles.gradeGridValue}>{currC}% ({currentBatch.grade_c})</Text>
                </View>
                <View style={styles.gradeGridItem}>
                  <Text style={styles.gradeGridLabel}>Grade D:</Text>
                  <Text style={styles.gradeGridValue}>{currD}% ({currentBatch.grade_d})</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Trend */}
      <View style={[styles.trendBox, { borderLeftColor: trendColor }]}>
        <Text style={[styles.trendText, { color: trendColor }]}>
          {trendText}
        </Text>
      </View>

      {/* Summary */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>📌 Quality Comparison</Text>
        <Text style={styles.summaryText}>
          {previousBatch 
            ? `Previous batch: Highest grade was ${prevA >= prevB ? 'Grade A (Export Grade)' : 'Grade B (Supermarket Quality)'} at ${Math.max(prevA, prevB)}%.\n\nCurrent batch: Highest grade is ${currA >= currB ? 'Grade A (Export Grade)' : 'Grade B (Supermarket Quality)'} at ${Math.max(currA, currB)}%. Quality maintained with focus on export-ready grades.`
            : `First batch established: Best grade is ${currA >= currB ? 'Grade A (Export Grade)' : 'Grade B (Supermarket Quality)'} at ${Math.max(currA, currB)}% (${currentBatch.total_peppers} peppers). Baseline quality set.`
          }
        </Text>
      </View>

      {/* All Batches Section */}
      <Text style={[styles.title, styles.allBatchesTitle]}>📋 All Batches ({allBatches.length})</Text>

      {allBatches.map((batch, index) => (
          <View key={batch.id} style={[styles.card, index === 0 && styles.currentCard]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>
                  {index === 0 ? '⭐ Latest Batch' : `Batch #${allBatches.length - index}`}
                </Text>
                <Text style={styles.batchId}>Batch ID: {batch.batch_id.substring(0, 8)}</Text>
              </View>
              <Text style={styles.cardDate}>{formatDateTime(batch.created_at)}</Text>
            </View>

            <View style={styles.batchStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Peppers</Text>
                <Text style={styles.statValue}>{batch.total_peppers}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Graded Peppers</Text>
                <Text style={styles.statValue}>
                  {batch.grade_a + batch.grade_b + batch.grade_c + batch.grade_d}
                </Text>
              </View>
            </View>

            <View style={styles.gradesSection}>
              <GradeRow label="Grade A Quality" value={calcPercentage(batch.grade_a, batch.total_peppers)} color="#16a34a" count={batch.grade_a} />
              <GradeRow label="Grade B Quality" value={calcPercentage(batch.grade_b, batch.total_peppers)} color="#eab308" count={batch.grade_b} />
              <GradeRow label="Grade C Quality" value={calcPercentage(batch.grade_c, batch.total_peppers)} color="#f97316" count={batch.grade_c} />
              <GradeRow label="Grade D (Below Standard)" value={calcPercentage(batch.grade_d, batch.total_peppers)} color="#dc2626" count={batch.grade_d} />
            </View>
          </View>
        ))}
    </ScrollView>
  );
}

/* ---------------- GRADE ROW COMPONENT ---------------- */
function GradeRow({
  label,
  value,
  color,
  count,
}: {
  label: string;
  value: number;
  color: string;
  count?: number;
}) {
  return (
    <View style={styles.gradeRow}>
      <View style={styles.gradeHeader}>
        <Text style={styles.gradeLabel}>{label}</Text>
        <View style={styles.gradeValueContainer}>
          <Text style={{ fontWeight: "700" }}>{value}%</Text>
          {count !== undefined && <Text style={styles.gradeCount}>({count})</Text>}
        </View>
      </View>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: {
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  allBatchesTitle: {
    marginTop: 24,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    elevation: 3,
  },
  currentCard: {
    borderWidth: 2,
    borderColor: "#10b981",
  },
  comparisonCard: {
    borderWidth: 2,
    borderColor: "#3b82f6",
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  cardDate: {
    fontSize: 12,
    color: "#94a3b8",
    fontStyle: "italic",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
    color: "#1e293b",
  },
  comparisonContent: {
    flexDirection: "column",
  },
  comparisonItem: {
    marginBottom: 12,
  },
  comparisonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  comparisonLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 4,
  },
  comparisonBatchId: {
    fontSize: 11,
    color: "#64748b",
    fontStyle: "italic",
  },
  comparisonDate: {
    fontSize: 11,
    color: "#94a3b8",
    textAlign: "right",
    maxWidth: "45%",
  },
  comparisonDetail: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 8,
  },
  comparisonDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 12,
  },
  gradesGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  gradeGridItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  gradeGridLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 2,
  },
  gradeGridValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  batchId: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  batchStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#f1f5f9",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  statItem: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10b981",
  },
  gradesSection: {
    marginBottom: 12,
  },
  gradeRow: {
    marginBottom: 12,
  },
  gradeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  gradeLabel: {
    fontSize: 12,
    color: "#475569",
  },
  gradeValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gradeCount: {
    fontSize: 11,
    color: "#94a3b8",
  },
  barBackground: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 6,
    overflow: "hidden",
  },
  barFill: {
    height: 8,
    borderRadius: 6,
  },
  qualityIndicator: {
    backgroundColor: "#f0fdf4",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  qualityText: {
    fontSize: 14,
    fontWeight: "700",
  },
  trendBox: {
    backgroundColor: "#ffffff",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 6,
    marginBottom: 18,
  },
  trendText: {
    fontSize: 16,
    fontWeight: "700",
  },
  summaryBox: {
    backgroundColor: "#dcfce7",
    padding: 18,
    borderRadius: 16,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
    color: "#065f46",
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#065f46",
  },
  emptyCard: {
    backgroundColor: "#ffffff",
    padding: 40,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 20,
    elevation: 2,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
});
