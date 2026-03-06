import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { processField, predictyield } from "@/services/api";

const { width } = Dimensions.get("window");

export default function ResultScreen() {
  const params = useLocalSearchParams();

  const soilData = params.soilData
    ? JSON.parse(params.soilData as string)
    : [];

  const soilAverages = params.soilAverages
    ? JSON.parse(params.soilAverages as string)
    : null;

  const boundary = params.boundary
    ? JSON.parse(params.boundary as string)
    : [];

  const area = params.area ? parseFloat(params.area as string) : 0;

  const [result, setResult] = useState<any>(null);
  const [yieldPrediction, setYieldPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (soilData.length === 0 || boundary.length < 3) {
      Alert.alert("Invalid Data", "Missing soil data or boundary");
      return;
    }
    processData();
  }, []);

  const processData = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("Calling process endpoint...");
      const fieldResult = await processField({
        boundary,
        points: soilData,
      });

      console.log("Process result:", fieldResult);
      setResult(fieldResult);

      if (soilAverages) {
        console.log("Calling predict-yield endpoint...");

        try {
          const yieldResult = await predictyield({
            N: soilAverages.N,
            P: soilAverages.P,
            K: soilAverages.K,
            pH: soilAverages.pH,
            moisture: soilAverages.moisture,
          });

          console.log("Yield prediction:", yieldResult);
          setYieldPrediction(yieldResult);
        } catch (yieldError) {
          console.error("Yield prediction failed:", yieldError);
          setYieldPrediction(null);
        }
      }
    } catch (error: any) {
      console.error("Processing failed:", error);
      setError(error.message || "Failed to process field");
      Alert.alert("Processing Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={{ marginTop: 10 }}>Generating Farm Plan...</Text>
        <Text style={{ marginTop: 5, color: "#666" }}>
          Analyzing soil samples...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: "red", marginBottom: 10 }}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={processData}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const zoneColors: Record<string, string> = {
    rich: "#6BCB77",
    medium: "#FFD93D",
    poor: "#FF6B6B",
  };

  const getZoneLabel = (zoneValue: unknown): "rich" | "medium" | "poor" => {
    if (typeof zoneValue === "string") {
      const normalized = zoneValue.toLowerCase();
      if (["rich", "medium", "poor"].includes(normalized)) {
        return normalized as any;
      }
    }

    if (typeof zoneValue === "number") {
      if (zoneValue === 0) return "rich";
      if (zoneValue === 1) return "medium";
      if (zoneValue === 2) return "poor";
    }

    return "medium";
  };

  const orderedPoints = soilData.map((_: any, index: number) => {
    return result?.points[index];
  });

  // safer extraction
  const predictedYield =
    yieldPrediction?.predicted_yield ??
    yieldPrediction?.yield ??
    yieldPrediction?.prediction ??
    null;

  const hasPlantCount =
    typeof result?.total_plant_count === "number" &&
    result.total_plant_count > 0;

  // TOTAL YIELD = yield per plant * plant count
  const totalYield =
    predictedYield && hasPlantCount
      ? predictedYield * result.total_plant_count
      : null;

  const hasTotalYield =
    typeof totalYield === "number" && !Number.isNaN(totalYield);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>🌶️ Field Plantation Plan</Text>

        {/* Yield Prediction */}
        {yieldPrediction && (
          <View style={styles.yieldCard}>
            <Text style={styles.yieldTitle}>📈 Expected Harvest</Text>

            {hasTotalYield && (
              <View style={styles.yieldRow}>
                <Text style={styles.yieldLabel}>Estimated Yield:</Text>
                <Text style={[styles.yieldValue, styles.totalYield]}>
                  {totalYield.toFixed(1)} kg
                </Text>
              </View>
            )}

            {hasPlantCount && (
              <Text style={styles.perPlantText}>
                {result.total_plant_count} plants ×{" "}
                {predictedYield?.toFixed(2)} kg per plant
              </Text>
            )}
          </View>
        )}

        {/* Soil Zones */}
        <Text style={styles.sectionTitle}>🗺️ Soil Zones</Text>

        <View style={styles.fieldBox}>
          {orderedPoints?.map((p: any, idx: number) => {
            const zoneLabel = getZoneLabel(p?.zone);

            return (
              <View
                key={idx}
                style={[
                  styles.zoneBlock,
                  { backgroundColor: zoneColors[zoneLabel] || "#ccc" },
                ]}
              >
                <Text style={styles.zoneTitle}>Point {idx + 1}</Text>

                <Text style={styles.zoneText}>
                  Class: {zoneLabel.toUpperCase()}
                </Text>

                <Text style={styles.zoneText}>
                  Spacing: {p?.intra_spacing_m || 0} m
                </Text>

                <Text style={styles.zoneText}>
                  Density: {p?.density_per_m2 || 0}/m²
                </Text>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legendBox}>
          {Object.entries(zoneColors).map(([key, color]) => (
            <View style={styles.legendRow} key={key}>
              <View style={[styles.colorBox, { backgroundColor: color }]} />
              <Text style={styles.legendText}>{key.toUpperCase()}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>📊 Field Summary</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Area:</Text>
            <Text style={styles.summaryValue}>
              {result?.area_m2?.toFixed(2)} m²
            </Text>
          </View>

          

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Plants:</Text>
            <Text style={styles.summaryValue}>
              {result?.total_plant_count}
            </Text>
          </View>

          {hasTotalYield && (
            <View style={[styles.summaryRow, styles.highlightRow]}>
              <Text style={styles.summaryLabel}>Expected Harvest:</Text>
              <Text style={styles.highlightValue}>
                {totalYield.toFixed(1)} kg
              </Text>
            </View>
          )}
        </View>

        {/* Soil Results */}
        {soilAverages && (
          <View style={styles.soilSummaryBox}>
            <Text style={styles.soilSummaryTitle}>🌱 Soil Test Results</Text>

            <View style={styles.soilGrid}>
              <View style={styles.soilItem}>
                <Text style={styles.soilLabel}>N</Text>
                <Text style={styles.soilValue}>{soilAverages.N}</Text>
              </View>

              <View style={styles.soilItem}>
                <Text style={styles.soilLabel}>P</Text>
                <Text style={styles.soilValue}>{soilAverages.P}</Text>
              </View>

              <View style={styles.soilItem}>
                <Text style={styles.soilLabel}>K</Text>
                <Text style={styles.soilValue}>{soilAverages.K}</Text>
              </View>

              <View style={styles.soilItem}>
                <Text style={styles.soilLabel}>pH</Text>
                <Text style={styles.soilValue}>{soilAverages.pH}</Text>
              </View>

              <View style={styles.soilItem}>
                <Text style={styles.soilLabel}>Moisture</Text>
                <Text style={styles.soilValue}>
                  {soilAverages.moisture}%
                </Text>
              </View>
            </View>

            <Text style={styles.sampleNote}>
              Based on {soilAverages.pointCount} samples
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f5f5f5", paddingBottom: 30 },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  heading: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    color: "#333",
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#555",
  },

  yieldCard: {
    backgroundColor: "#4CAF50",
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
  },

  yieldTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },

  yieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  yieldLabel: { fontSize: 16, color: "#fff" },

  yieldValue: { fontSize: 20, fontWeight: "bold", color: "#fff" },

  totalYield: { fontSize: 24, color: "#FFD700" },

  perPlantText: { fontSize: 14, color: "#fff", opacity: 0.9 },

  fieldBox: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

  zoneBlock: {
    width: width / 2 - 24,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },

  zoneTitle: { fontWeight: "bold", marginBottom: 4 },

  zoneText: { fontSize: 13, color: "#333" },

  legendBox: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
  },

  legendRow: { flexDirection: "row", alignItems: "center" },

  colorBox: { width: 20, height: 20, borderRadius: 4, marginRight: 6 },

  legendText: { fontSize: 14 },

  summaryBox: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },

  summaryTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 12 },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  summaryLabel: { fontSize: 15, color: "#666" },

  summaryValue: { fontSize: 15, fontWeight: "500" },

  highlightRow: { marginTop: 8 },

  highlightValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4CAF50",
  },

  soilSummaryBox: {
    backgroundColor: "#e3f2fd",
    padding: 16,
    borderRadius: 12,
  },

  soilSummaryTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },

  soilGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },

  soilItem: { flex: 1, minWidth: "30%", alignItems: "center" },

  soilLabel: { fontSize: 12, color: "#666" },

  soilValue: { fontSize: 16, fontWeight: "600" },

  sampleNote: { fontSize: 12, color: "#666", marginTop: 4 },

  retryButton: {
    backgroundColor: "#4CAF50",
    padding: 12,
    borderRadius: 8,
  },

  retryText: { color: "#fff", fontWeight: "bold" },
});