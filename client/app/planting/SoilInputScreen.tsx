import React, { useState, useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  Alert,
  TextInput,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";

type SoilPoint = {
  latitude: number;
  longitude: number;
  N: number;
  P: number;
  K: number;
  pH: number;
  moisture: number;
};

// NEW: Type for averages
type SoilAverages = {
  N: number;
  P: number;
  K: number;
  pH: number;
  moisture: number;
  pointCount: number;
};

export default function SoilInputScreen() {
  const params = useLocalSearchParams();

  // Get boundary and manualArea from previous screen
  let boundary: any[] = [];
  let manualArea: string = "0";

  try {
    boundary =
      typeof params.boundary === "string"
        ? JSON.parse(params.boundary)
        : [];
    manualArea = typeof params.manualArea === "string" ? params.manualArea : "0";
  } catch (error) {
    console.log("Boundary parse error:", error);
    boundary = [];
  }

  const [soilPoints, setSoilPoints] = useState<SoilPoint[]>([]);
  const [soilAverages, setSoilAverages] = useState<SoilAverages | null>(null);
  const [manualEntry, setManualEntry] = useState({
    N: "",
    P: "",
    K: "",
    pH: "",
    moisture: "",
  });

  // ✅ Validate boundary
  useEffect(() => {
    if (!boundary || boundary.length < 3) {
      Alert.alert(
        "Invalid Boundary",
        "Please capture a valid field boundary first.",
        [{ text: "Go Back", onPress: () => router.back() }]
      );
    }
  }, [boundary]);

  // ✅ NEW: Calculate averages whenever points change
  useEffect(() => {
    if (soilPoints.length > 0) {
      calculateAverages();
    } else {
      setSoilAverages(null);
    }
  }, [soilPoints]);

  // ✅ NEW: Function to calculate averages
  const calculateAverages = () => {
    if (soilPoints.length === 0) return;

    const sums = soilPoints.reduce(
      (acc, point) => ({
        N: acc.N + point.N,
        P: acc.P + point.P,
        K: acc.K + point.K,
        pH: acc.pH + point.pH,
        moisture: acc.moisture + point.moisture,
      }),
      { N: 0, P: 0, K: 0, pH: 0, moisture: 0 }
    );

    const count = soilPoints.length;
    setSoilAverages({
      N: Number((sums.N / count).toFixed(1)),
      P: Number((sums.P / count).toFixed(1)),
      K: Number((sums.K / count).toFixed(1)),
      pH: Number((sums.pH / count).toFixed(1)),
      moisture: Number((sums.moisture / count).toFixed(1)),
      pointCount: count,
    });
  };

  // ✅ Get High Accuracy GPS
  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission Denied", "Enable location to add soil point.");
      return null;
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return loc.coords;
  };

  // ✅ Add Soil Point
  const addManualPoint = async () => {
    const coords = await getCurrentLocation();
    if (!coords) return;

    const { N, P, K, pH, moisture } = manualEntry;

    if (
      !N ||
      !P ||
      !K ||
      !pH ||
      !moisture ||
      isNaN(Number(N)) ||
      isNaN(Number(P)) ||
      isNaN(Number(K)) ||
      isNaN(Number(pH)) ||
      isNaN(Number(moisture))
    ) {
      Alert.alert("Invalid Data", "Enter valid numeric soil values.");
      return;
    }

    const newPoint: SoilPoint = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      N: Number(N),
      P: Number(P),
      K: Number(K),
      pH: Number(pH),
      moisture: Number(moisture),
    };

    setSoilPoints((prev) => [...prev, newPoint]);
    setManualEntry({ N: "", P: "", K: "", pH: "", moisture: "" });
    Alert.alert("Success", `Point ${soilPoints.length + 1} added.`);
  };

  // ✅ Updated Submit Data - NOW INCLUDES AVERAGES
  const submitSoilData = () => {
    if (soilPoints.length < 3) {
      Alert.alert(
        "Not Enough Points",
        "Add at least 3 soil points to process the field."
      );
      return;
    }

    // Show summary before proceeding
    Alert.alert(
      "Field Summary",
      `📍 ${soilPoints.length} soil samples\n` +
      `📊 Averages:\n` +
      `N: ${soilAverages?.N} | P: ${soilAverages?.P} | K: ${soilAverages?.K}\n` +
      `pH: ${soilAverages?.pH} | Moisture: ${soilAverages?.moisture}%\n` +
      `🌱 Area: ${(Number(manualArea) / 10000).toFixed(2)} hectares\n\n` +
      `Proceed to results?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: () => {
            router.push({
              pathname: "/planting/ResultScreen",
              params: {
                soilData: JSON.stringify(soilPoints),      // All points for K-means
                soilAverages: JSON.stringify(soilAverages), // Averages for yield prediction
                boundary: JSON.stringify(boundary),
                area: manualArea,                           // Area in sq meters
              },
            });
          },
        },
      ]
    );
  };

  // ✅ NEW: Render averages preview
  const renderAveragesPreview = () => {
    if (!soilAverages || soilPoints.length < 3) return null;

    return (
      <View style={styles.averagesContainer}>
        <Text style={styles.averagesTitle}>📊 Field Averages</Text>
        <View style={styles.avgRow}>
          <Text style={styles.avgItem}>N: {soilAverages.N}</Text>
          <Text style={styles.avgItem}>P: {soilAverages.P}</Text>
          <Text style={styles.avgItem}>K: {soilAverages.K}</Text>
        </View>
        <View style={styles.avgRow}>
          <Text style={styles.avgItem}>pH: {soilAverages.pH}</Text>
          <Text style={styles.avgItem}>Moisture: {soilAverages.moisture}%</Text>
        </View>
        <Text style={styles.sampleCount}>Based on {soilPoints.length} samples</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>🌱 Manual Soil Entry</Text>
        <Text style={styles.areaText}>
          Field Area: {(Number(manualArea) / 10000).toFixed(2)} hectares
        </Text>

        {["N", "P", "K", "pH", "moisture"].map((key) => (
          <TextInput
            key={key}
            placeholder={`Enter ${key} ${key === "moisture" ? "(%)" : ""}`}
            value={manualEntry[key as keyof typeof manualEntry]}
            keyboardType="numeric"
            onChangeText={(text) =>
              setManualEntry({ ...manualEntry, [key]: text })
            }
            style={styles.input}
          />
        ))}

        <TouchableOpacity style={styles.button} onPress={addManualPoint}>
          <Text style={styles.buttonText}>📍 Add Soil Point</Text>
        </TouchableOpacity>

        <Text style={styles.counter}>
          Points: {soilPoints.length} {soilPoints.length < 3 ? "(min 3)" : "✅"}
        </Text>

        {/* NEW: Show averages preview */}
        {renderAveragesPreview()}

        <FlatList
          data={soilPoints}
          scrollEnabled={false}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item, index }) => (
            <View style={styles.pointCard}>
              <Text style={styles.pointTitle}>Point {index + 1}</Text>
              <Text>N:{item.N} P:{item.P} K:{item.K}</Text>
              <Text>pH:{item.pH} Moisture:{item.moisture}%</Text>
            </View>
          )}
        />

        {soilPoints.length >= 3 && (
          <TouchableOpacity 
            style={[styles.button, styles.processButton]} 
            onPress={submitSoilData}
          >
            <Text style={styles.buttonText}>📊 Process Field & Predict Yield</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 10 },
  areaText: { fontSize: 16, color: "#666", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    marginVertical: 6,
    borderRadius: 8,
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 14,
    borderRadius: 8,
    marginTop: 12,
    alignItems: "center",
  },
  processButton: { backgroundColor: "#2196F3" },
  buttonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  counter: { marginTop: 15, fontSize: 15, fontWeight: "500" },
  pointCard: {
    backgroundColor: "#e6f7ff",
    padding: 10,
    marginVertical: 6,
    borderRadius: 6,
  },
  pointTitle: { fontWeight: "600" },
  // New styles
  averagesContainer: {
    backgroundColor: "#e3f2fd",
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#2196f3",
  },
  averagesTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1976d2",
    marginBottom: 12,
  },
  avgRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  avgItem: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  sampleCount: {
    marginTop: 8,
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
});