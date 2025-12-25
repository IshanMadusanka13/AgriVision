import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Share,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function DiseaseResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const { annotatedImage, diagnosis, confidence, severity, recommendations } = params;
  
  // Parse recommendations from JSON string
  const recommendationsList = recommendations 
    ? JSON.parse(recommendations as string) 
    : [];

  const getSeverityColor = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case "high": return "#dc2626";
      case "moderate": return "#f59e0b";
      case "low": return "#10b981";
      case "none": return "#3b82f6";
      default: return "#6b7280";
    }
  };

  const getSeverityIcon = (sev: string) => {
    switch (sev?.toLowerCase()) {
      case "high": return "⚠️";
      case "moderate": return "⚡";
      case "low": return "✓";
      case "none": return "✅";
      default: return "ℹ️";
    }
  };

  const handleShare = async () => {
    try {
      const recommendationsText = recommendationsList.join("\n• ");
      await Share.share({
        message: `🔬 Disease Detection Result\n\n` +
                 `Diagnosis: ${diagnosis}\n` +
                 `Confidence: ${confidence}%\n` +
                 `Severity: ${severity}\n\n` +
                 `Recommendations:\n• ${recommendationsText}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔬 Analysis Results</Text>
      </View>

      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: annotatedImage as string }} 
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      <View style={styles.resultsCard}>
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Diagnosis:</Text>
          <Text style={styles.resultValue}>{diagnosis || "N/A"}</Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Confidence:</Text>
          <View style={styles.confidenceContainer}>
            <Text style={styles.resultValue}>{confidence || "N/A"}%</Text>
            <View style={styles.confidenceBar}>
              <View 
                style={[
                  styles.confidenceFill, 
                  { width: `${(confidence || 0) as unknown as number}%` }
                ]} 
              />
            </View>
          </View>
        </View>

        {severity && (
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Severity:</Text>
            <View style={styles.severityContainer}>
              <Text style={styles.severityIcon}>
                {getSeverityIcon(severity as string)}
              </Text>
              <Text 
                style={[
                  styles.resultValue, 
                  { color: getSeverityColor(severity as string) }
                ]}
              >
                {severity}
              </Text>
            </View>
          </View>
        )}
      </View>

      {recommendationsList.length > 0 && (
        <View style={styles.recommendationsCard}>
          <Text style={styles.recommendationsTitle}>
            💡 Treatment Recommendations
          </Text>
          {recommendationsList.map((rec: string, index: number) => (
            <View key={index} style={styles.recommendationItem}>
              <Text style={styles.recommendationBullet}>•</Text>
              <Text style={styles.recommendationText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={handleShare}
        >
          <Text style={styles.buttonIcon}>📤</Text>
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            Share Results
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.back()}
        >
          <Text style={styles.buttonIcon}>🔄</Text>
          <Text style={styles.buttonText}>Analyze Another</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.push("/(tabs)")}
        >
          <Text style={styles.buttonIcon}>🏠</Text>
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { 
    padding: 20, 
    backgroundColor: "#fff", 
    borderBottomWidth: 1, 
    borderBottomColor: "#e5e7eb" 
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: "700", 
    color: "#1f2937", 
    textAlign: "center" 
  },
  imageContainer: {
    margin: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: { width: "100%", height: 400 },
  resultsCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  resultLabel: { 
    fontSize: 16, 
    fontWeight: "600", 
    color: "#6b7280",
    flex: 1,
  },
  resultValue: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: "#1f2937",
    textAlign: "right",
  },
  confidenceContainer: {
    flex: 1,
    alignItems: "flex-end",
  },
  confidenceBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    marginTop: 4,
    overflow: "hidden",
  },
  confidenceFill: {
    height: "100%",
    backgroundColor: "#10b981",
    borderRadius: 4,
  },
  severityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  severityIcon: {
    fontSize: 20,
  },
  recommendationsCard: {
    margin: 16,
    marginTop: 8,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 16,
  },
  recommendationItem: {
    flexDirection: "row",
    marginBottom: 12,
    paddingLeft: 8,
  },
  recommendationBullet: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10b981",
    marginRight: 12,
    marginTop: 2,
  },
  recommendationText: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
  },
  buttonContainer: { 
    padding: 16, 
    gap: 12, 
    marginBottom: 32 
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  primaryButton: { 
    backgroundColor: "#10b981", 
    borderColor: "#10b981" 
  },
  buttonIcon: { fontSize: 24, marginRight: 8 },
  buttonText: { 
    fontSize: 16, 
    fontWeight: "600", 
    color: "#374151" 
  },
  primaryButtonText: { color: "#fff" },
});