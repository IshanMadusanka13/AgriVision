import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

export default function BatchAnalysis() {
  // ---------------- MOCK DATA ----------------
  const previousBatch = {
    batchId: "Batch-2025-12",
    total: 20,
    grades: { A: 6, B: 7, C: 5, D: 2 },
  };

  const currentBatch = {
    batchId: "Batch-2026-01",
    total: 20,
    grades: { A: 9, B: 6, C: 3, D: 2 },
  };

  // ---------------- CALCULATIONS ----------------
  const calcPercentage = (value: number, total: number) =>
    total === 0 ? 0 : Math.round((value / total) * 100);

  const prevA = calcPercentage(previousBatch.grades.A, previousBatch.total);
  const currA = calcPercentage(currentBatch.grades.A, currentBatch.total);
  const prevD = calcPercentage(previousBatch.grades.D, previousBatch.total);
  const currD = calcPercentage(currentBatch.grades.D, currentBatch.total);

  let trendText = "ගුණාත්මකභාවය ස්ථාවර වේ.";
  let trendColor = "#16a34a";

  if (currA > prevA && currD <= prevD) {
    trendText = "මෙම කණ්ඩායමේ ගුණාත්මකභාවය වැඩි වී ඇත 📈";
    trendColor = "#16a34a";
  } else if (currA < prevA || currD > prevD) {
    trendText = "මෙම කණ්ඩායමේ ගුණාත්මකභාවය අඩු වී ඇත 📉";
    trendColor = "#dc2626";
  }

  // ---------------- UI ----------------
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Title */}
      <Text style={styles.title}>📊 කාණ්ඩ විශ්ලේෂණ වාර්තාව</Text>
      <Text style={styles.subtitle}>Scotch Bonnet Grade Comparison</Text>

      {/* Previous Batch */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Previous Batch</Text>
        <Text style={styles.batchId}>{previousBatch.batchId}</Text>

        <GradeRow label="Grade A" value={prevA} color="#16a34a" />
        <GradeRow label="Grade B" value={calcPercentage(previousBatch.grades.B, previousBatch.total)} color="#eab308" />
        <GradeRow label="Grade C" value={calcPercentage(previousBatch.grades.C, previousBatch.total)} color="#f97316" />
        <GradeRow label="Grade D" value={prevD} color="#dc2626" />
      </View>

      {/* Current Batch */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Batch</Text>
        <Text style={styles.batchId}>{currentBatch.batchId}</Text>

        <GradeRow label="Grade A" value={currA} color="#16a34a" />
        <GradeRow label="Grade B" value={calcPercentage(currentBatch.grades.B, currentBatch.total)} color="#eab308" />
        <GradeRow label="Grade C" value={calcPercentage(currentBatch.grades.C, currentBatch.total)} color="#f97316" />
        <GradeRow label="Grade D" value={currD} color="#dc2626" />
      </View>

      {/* Trend */}
      <View style={[styles.trendBox, { borderLeftColor: trendColor }]}>
        <Text style={[styles.trendText, { color: trendColor }]}>
          {trendText}
        </Text>
      </View>

      {/* Summary */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>📌 විශ්ලේෂණ සාරාංශය</Text>
        <Text style={styles.summaryText}>
          පසුගිය කණ්ඩායම හා සසඳන විට මෙම Scotch Bonnet කණ්ඩායමේ
          Grade A ප්‍රතිශතය වැඩි වී 있으며,
          Grade D ප්‍රමාණය අඩු වී ඇත.
          මෙය වෙළඳපොළ හා අපනයනය සඳහා ඉතා හොඳ ගුණාත්මක තත්ත්වයක් බව
          පෙන්වයි.
        </Text>
      </View>
    </ScrollView>
  );
}

/* ---------------- GRADE ROW COMPONENT ---------------- */
function GradeRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.gradeRow}>
      <View style={styles.gradeHeader}>
        <Text>{label}</Text>
        <Text style={{ fontWeight: "700" }}>{value}%</Text>
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  batchId: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 12,
  },
  gradeRow: {
    marginBottom: 12,
  },
  gradeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
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
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#065f46",
  },
});
