import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { checkAPIStatus } from "@/services/api";

export default function DiseaseScreen() {
  const router = useRouter();
  const [apiStatus, setApiStatus] = useState("checking");

  useEffect(() => {
    checkAPI();
  }, []);

  const checkAPI = async () => {
    try {
      const isOnline = await checkAPIStatus();
      setApiStatus(isOnline ? "online" : "offline");
    } catch (error) {
      setApiStatus("offline");
    }
  };

  const handleStartAnalysis = () => {
    if (apiStatus === "offline") {
      Alert.alert(
        "API Offline",
        "Backend server is not running. Start backend:\n\ncd backend\npython main.py",
        [{ text: "OK" }]
      );
      return;
    }
    router.push("/disease/camera");
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🦠</Text>
        <Text style={styles.subtitle}>Plant Disease Analyzer</Text>
        <Text style={styles.description}>Detect symptoms, severity & treatment suggestions</Text>
      </View>

      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, apiStatus === "online" && styles.statusOnline]}>
          <View style={[styles.statusDot, apiStatus === "online" && styles.dotOnline]} />
          <Text style={styles.statusText}>
            {apiStatus === "checking" ? "Checking..." : apiStatus === "online" ? "API Online" : "API Offline"}
          </Text>
        </View>
        <TouchableOpacity onPress={checkAPI} style={styles.refreshButton}>
          <Text style={styles.refreshText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.featuresContainer}>
        <Text style={styles.sectionTitle}>Features</Text>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>📸</Text>
          <Text style={styles.featureTitle}>Disease Detection</Text>
          <Text style={styles.featureDescription}>Automatic symptom detection from leaf photos</Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>⚠️</Text>
          <Text style={styles.featureTitle}>Severity Assessment</Text>
          <Text style={styles.featureDescription}>Estimate severity and recommend actions</Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>🩺</Text>
          <Text style={styles.featureTitle}>Treatment Tips</Text>
          <Text style={styles.featureDescription}>Cultural and chemical suggestions tailored to condition</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.startButton, apiStatus === "offline" && styles.buttonDisabled]}
        onPress={handleStartAnalysis}
      >
        <Text style={styles.startButtonText}>
          {apiStatus === "offline" ? "⚠️ API Offline" : "🔬 Start Disease Scan"}
        </Text>
      </TouchableOpacity>

      <View style={styles.instructionsContainer}>
        <Text style={styles.sectionTitle}>How to Use</Text>
        <Text style={styles.instructionText}>1. Take a clear photo of affected area</Text>
        <Text style={styles.instructionText}>2. Wait for AI analysis</Text>
        <Text style={styles.instructionText}>3. Review severity & treatment suggestions</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { alignItems: "center", paddingVertical: 40, backgroundColor: "#ef4444" },
  title: { fontSize: 64, marginBottom: 10 },
  subtitle: { fontSize: 28, fontWeight: "bold", color: "#fff", marginBottom: 5 },
  description: { fontSize: 16, color: "#fee2e2" },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fee2e2", borderRadius: 20 },
  statusOnline: { backgroundColor: "#d1fae5" },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444", marginRight: 8 },
  dotOnline: { backgroundColor: "#10b981" },
  statusText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  refreshButton: { paddingHorizontal: 12, paddingVertical: 6 },
  refreshText: { fontSize: 14, color: "#ef4444", fontWeight: "600" },
  featuresContainer: { padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: "bold", color: "#1f2937", marginBottom: 16 },
  featureCard: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  featureIcon: { fontSize: 32, marginBottom: 8 },
  featureTitle: { fontSize: 18, fontWeight: "600", color: "#1f2937", marginBottom: 4 },
  featureDescription: { fontSize: 14, color: "#6b7280", lineHeight: 20 },
  startButton: { backgroundColor: "#ef4444", marginHorizontal: 16, marginTop: 8, paddingVertical: 16, borderRadius: 12, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  buttonDisabled: { backgroundColor: "#9ca3af" },
  startButtonText: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  instructionsContainer: { padding: 16, marginTop: 16 },
  instructionText: { fontSize: 15, color: "#4b5563", marginBottom: 8, paddingLeft: 8 },
});
