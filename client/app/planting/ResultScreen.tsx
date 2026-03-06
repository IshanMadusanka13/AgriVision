import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { processField } from "@/services/api";

const { width } = Dimensions.get("window");

export default function ResultScreen() {
  const params = useLocalSearchParams();

  const soilData = params.soilData
    ? JSON.parse(params.soilData as string)
    : [];

  const boundary = params.boundary
    ? JSON.parse(params.boundary as string)
    : [];

  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (soilData.length === 0 || boundary.length < 3) {
      Alert.alert("Invalid Data");
      return;
    }
    sendToBackend();
  }, []);

  const sendToBackend = async () => {
    try {
      const response = await processField({
        boundary,
        points: soilData,
      });
      setResult(response);
    } catch (error) {
      Alert.alert("Processing Failed");
    }
  };

  if (!result) {
    return (
      <View style={styles.center}>
        <Text>Generating Farm Plan...</Text>
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
    return result.points[index];
  });

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>🌶️ Field Plantation Plan</Text>

        {/* Field Sketch */}
        <View style={styles.fieldBox}>
          {orderedPoints.map((p: any, idx: number) => {
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
                <Text>Richness: {zoneLabel.toUpperCase()}</Text>
                <Text>Spacing: {p.intra_spacing_m} m</Text>
                <Text>Density: {p.density_per_m2}/m²</Text>
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
          <Text style={styles.summaryTitle}>📊 Summary</Text>
          <Text>Area: {result.area_m2.toFixed(2)} m²</Text>
          <Text>Perches: {result.area_perches.toFixed(2)}</Text>
          <Text>Total Plants: {result.total_plant_count}</Text>
          <Text>Predicted Yield: {result.predicted_yield} kg</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40, // IMPORTANT
    backgroundColor: "#f4f6f8",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heading: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  fieldBox: {
    width: width - 40,
    borderWidth: 2,
    borderColor: "#333",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 15,
  },
  zoneBlock: {
    padding: 15,
    borderBottomWidth: 2,
    borderColor: "#fff",
  },
  zoneTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  summaryBox: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    elevation: 3,
    marginTop: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  legendBox: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    elevation: 2,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  colorBox: {
    width: 20,
    height: 20,
    marginRight: 10,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 14,
  },
});