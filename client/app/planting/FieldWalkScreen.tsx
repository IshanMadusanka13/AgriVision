import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
} from "react-native";
import MapView, { Polygon, Marker } from "react-native-maps";
import * as Location from "expo-location";
import { polygon, area } from "@turf/turf";
import { router } from "expo-router";

interface Point {
  latitude: number;
  longitude: number;
}

interface AreaResult {
  sqMeters: number;
  perches: number;
  acres: number;
  hectares: number;
}

export default function FieldWalkScreen() {
  const [location, setLocation] =
    useState<Location.LocationObjectCoords | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [areaResult, setAreaResult] = useState<AreaResult | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null);

  // ─── Get Current Location Every 3 Seconds ─────────────
  useEffect(() => {
    let interval: any;

    (async () => {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Location access is needed to measure field area."
        );
        return;
      }

      setPermissionGranted(true);

      interval = setInterval(async () => {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setLocation(loc.coords);
        setCurrentAccuracy(loc.coords.accuracy ?? null);
      }, 3000);
    })();

    return () => clearInterval(interval);
  }, []);

  // ─── Capture a Point ─────────────────────────────────
  const capturePoint = () => {
    if (!location) return;

    const newPoint = {
      latitude: location.latitude,
      longitude: location.longitude,
    };

    setPoints((prev) => {
      if (prev.length > 100) return prev;
      return [...prev, newPoint];
    });
  };

  // ─── Calculate Area ───────────────────────────────────
  const calculateArea = () => {
    if (points.length < 3) {
      Alert.alert("Not Enough Points", "Please capture at least 3 points.");
      return;
    }

    try {
      const ring: [number, number][] = points.map((p) => [
        p.longitude,
        p.latitude,
      ]);

      ring.push(ring[0]); // close polygon

      const poly = polygon([ring]);
      const sqMeters = area(poly);

      setAreaResult({
        sqMeters,
        perches: sqMeters / 25.29285264,
        acres: sqMeters * 0.000247105,
        hectares: sqMeters / 10000,
      });
    } catch (e) {
      Alert.alert("Error", "Failed to calculate area.");
    }
  };

  // ─── Reset ───────────────────────────────────────────
  const reset = () => {
    setPoints([]);
    setAreaResult(null);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {location ? (
        <MapView
          style={{ flex: 1 }}
          mapType="satellite"
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          }}
          showsUserLocation
        >
          {points.length > 2 && (
            <Polygon
              coordinates={points}
              fillColor="rgba(0,200,0,0.3)"
              strokeColor="rgba(0,180,0,0.9)"
              strokeWidth={2}
            />
          )}

          {points.length > 0 && (
            <Marker
              coordinate={points[0]}
              title="Start Point"
              pinColor="green"
            />
          )}
        </MapView>
      ) : (
        <View style={styles.loading}>
          <Text>Locking GPS...</Text>
        </View>
      )}

      <View style={styles.controls}>
        {currentAccuracy !== null && (
          <Text style={styles.status}>
            GPS Accuracy: {currentAccuracy.toFixed(1)} m
          </Text>
        )}

        <Text style={styles.status}>
          Points Captured: {points.length}
        </Text>

        {areaResult && (
          <View style={styles.areaBox}>
            <Text>📐 Field Area</Text>
            <Text>{areaResult.sqMeters.toFixed(1)} m²</Text>
            <Text>{areaResult.perches.toFixed(4)} perches</Text>
            <Text>{areaResult.acres.toFixed(4)} acres</Text>
            
            
          </View>
        )}

        <TouchableOpacity
          style={styles.btn}
          onPress={capturePoint}
          disabled={!permissionGranted}
        >
          <Text style={styles.btnText}>📍 Capture Point</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.stop]}
          onPress={calculateArea}
        >
          <Text style={styles.btnText}>⏹ Calculate Area</Text>
        </TouchableOpacity>

        {/* ✅ FIXED Navigation */}
        <TouchableOpacity
          style={[styles.btn, styles.submit]}
          onPress={() => {
            if (!areaResult) {
              Alert.alert(
                "No Area",
                "Please calculate area first."
              );
              return;
            }

            router.push({
              pathname: "/planting/SoilInputScreen",
              params: {
                manualArea: areaResult.sqMeters.toString(),
                boundary: JSON.stringify(points),
              },
            });
          }}
        >
          <Text style={styles.btnText}>
            ✅ Use Area & Enter Soil Data
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.reset]}
          onPress={reset}
        >
          <Text style={styles.btnText}>🔄 Reset</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  controls: {
    padding: 16,
    backgroundColor: "#fff",
    gap: 10,
  },
  status: {
    textAlign: "center",
    fontWeight: "500",
  },
  areaBox: {
    backgroundColor: "#e8f5e9",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#a5d6a7",
  },
  btn: {
    backgroundColor: "#4CAF50",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  stop: {
    backgroundColor: "#f44336",
    marginTop: 5,
  },
  submit: {
    backgroundColor: "#1976d2",
    marginTop: 5,
  },
  reset: {
    backgroundColor: "#9e9e9e",
    marginTop: 5,
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
  },
});