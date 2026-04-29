import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type DimensionValue,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

export default function SoilSamplingPlanScreen() {
  const params = useLocalSearchParams();

  const boundary = params.boundary || "[]";
  const areaParam =
    typeof params.manualArea === "string"
      ? params.manualArea
      : typeof params.area === "string"
      ? params.area
      : "0";
  const area = Number(areaParam || 0);

  // Example generated points
  const points: { id: number; left: DimensionValue; top: DimensionValue }[] = [
    { id: 1, left: "20%", top: "20%" },
    { id: 2, left: "70%", top: "20%" },
    { id: 3, left: "20%", top: "70%" },
    { id: 4, left: "70%", top: "70%" },
  ];

  const spacing = Math.sqrt(area / points.length);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🌱 Soil Sampling Plan</Text>

      <Text style={styles.subtitle}>
        Collect soil samples from the recommended locations below.
      </Text>

      <View style={styles.field}>
        {points.map((p) => (
          <View
            key={p.id}
            style={[
              styles.pointContainer,
              {
                left: p.left,
                top: p.top,
              },
            ]}
          >
            <View style={styles.point} />
            <Text style={styles.pointText}>{p.id}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.spacing}>
        Recommended spacing: {spacing.toFixed(1)} m
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => {
          router.push({
            pathname: "/planting/SoilInputScreen",
            params: {
              boundary,
              manualArea: area.toString(),
            },
          });
        }}
      >
        <Text style={styles.buttonText}>
          Continue to Soil Collection →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 20,
    color: "#555",
  },
  field: {
    width: 300,
    height: 300,
    borderWidth: 2,
    borderColor: "#333",
    position: "relative",
    backgroundColor: "#f5fff5",
  },
  pointContainer: {
    position: "absolute",
    alignItems: "center",
  },
  point: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "green",
  },
  pointText: {
    marginTop: 4,
    fontWeight: "bold",
  },
  spacing: {
    marginTop: 20,
    fontSize: 16,
  },
  button: {
    marginTop: 30,
    backgroundColor: "#2196F3",
    padding: 14,
    borderRadius: 10,
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
});
