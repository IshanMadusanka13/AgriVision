import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Share,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { predict_disease } from "@/services/api";

interface Detection {
  disease: string;
  confidence: number;
  bbox: number[];
}

interface DiseaseResult {
  annotatedImage?: string;
  diagnosis?: string;
  confidence?: number;
  severity?: string;
  total_detections?: number;
  detections?: Detection[];
  disease_summary?: Record<string, number>;
  conclusion?: string;
  recommendations?: string[];
  status?: string;
}

export default function DiseaseResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { imageUri } = params;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiseaseResult | null>(null);

  useEffect(() => {
    const analyzeImage = async () => {
      if (!imageUri) {
        setError("No image provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const analysisResult = await predict_disease(imageUri as string);
        
        if (analysisResult.status === "no_leaf_detected") {
          setError("No plant leaf detected in the image. Please try again with a clearer image of the affected area.");
          setLoading(false);
          return;
        }

        setResult(analysisResult);
      } catch (err: any) {
        console.error("Analysis error:", err);
        setError(err.message || "Failed to analyze image. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    analyzeImage();
  }, [imageUri]);

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
    if (!result) return;
    
    try {
      const diseaseSummary = result.disease_summary 
        ? Object.entries(result.disease_summary)
            .map(([disease, count]) => `${disease}: ${count}`)
            .join("\n• ")
        : "";
      
      const recommendationsText = result.recommendations?.join("\n• ") || "";
      
      await Share.share({
        message: `🔬 Disease Detection Results\n\n` +
                 `Total Detections: ${result.total_detections}\n` +
                 `Primary Diagnosis: ${result.diagnosis}\n` +
                 `Confidence: ${result.confidence}%\n` +
                 `Overall Severity: ${result.severity}\n\n` +
                 `Disease Summary:\n• ${diseaseSummary}\n\n` +
                 `Conclusion: ${result.conclusion}\n\n` +
                 `Recommendations:\n• ${recommendationsText}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleRetry = () => {
    router.back();
  };

  // Loading State
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Analyzing image...</Text>
        <Text style={styles.loadingSubtext}>Detecting all disease instances</Text>
      </View>
    );
  }

  // Error State
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Analysis Failed</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={handleRetry}
        >
          <Text style={styles.buttonIcon}>🔄</Text>
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            Try Again
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => router.push("/")}
        >
          <Text style={styles.buttonIcon}>🏠</Text>
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Success State
  if (!result) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔬 Analysis Results</Text>
        {result.total_detections && result.total_detections > 0 && (
          <Text style={styles.headerSubtitle}>
            {result.total_detections} detection{result.total_detections > 1 ? 's' : ''} found
          </Text>
        )}
      </View>

      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: result.annotatedImage || imageUri as string }} 
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      {result.conclusion && (
        <View style={styles.conclusionCard}>
          <Text style={styles.conclusionIcon}>📋</Text>
          <Text style={styles.conclusionText}>{result.conclusion}</Text>
        </View>
      )}

      <View style={styles.resultsCard}>
        <Text style={styles.cardTitle}>Summary</Text>
        
        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Primary Diagnosis:</Text>
          <Text style={styles.resultValue}>{result.diagnosis || "N/A"}</Text>
        </View>

        <View style={styles.resultRow}>
          <Text style={styles.resultLabel}>Confidence:</Text>
          <View style={styles.confidenceContainer}>
            <Text style={styles.resultValue}>{result.confidence || "N/A"}%</Text>
            <View style={styles.confidenceBar}>
              <View 
                style={[
                  styles.confidenceFill, 
                  { width: `${result.confidence || 0}%` }
                ]} 
              />
            </View>
          </View>
        </View>

        {result.severity && (
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Overall Severity:</Text>
            <View style={styles.severityContainer}>
              <Text style={styles.severityIcon}>
                {getSeverityIcon(result.severity)}
              </Text>
              <Text 
                style={[
                  styles.resultValue, 
                  { color: getSeverityColor(result.severity) }
                ]}
              >
                {result.severity}
              </Text>
            </View>
          </View>
        )}
      </View>

      {result.disease_summary && Object.keys(result.disease_summary).length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Disease Breakdown</Text>
          {Object.entries(result.disease_summary).map(([disease, count], index) => (
            <View key={index} style={styles.summaryItem}>
              <Text style={styles.summaryDisease}>{disease}</Text>
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryCount}>{count}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {result.detections && result.detections.length > 0 && (
        <View style={styles.detectionsCard}>
          <Text style={styles.cardTitle}>All Detections</Text>
          {result.detections.map((detection, index) => (
            <View key={index} style={styles.detectionItem}>
              <View style={styles.detectionHeader}>
                <Text style={styles.detectionNumber}>#{index + 1}</Text>
                <Text style={styles.detectionDisease}>{detection.disease}</Text>
              </View>
              <View style={styles.detectionConfidence}>
                <Text style={styles.detectionConfidenceLabel}>Confidence:</Text>
                <Text style={styles.detectionConfidenceValue}>
                  {detection.confidence}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <View style={styles.recommendationsCard}>
          <Text style={styles.recommendationsTitle}>
            💡 Treatment Recommendations
          </Text>
          {result.recommendations.map((rec: string, index: number) => (
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
          onPress={() => router.push("/")}
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
  centerContainer: {
    flex: 1,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#dc2626",
    marginBottom: 12,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
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
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
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
  conclusionCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: "#eff6ff",
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    flexDirection: "row",
    alignItems: "center",
  },
  conclusionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  conclusionText: {
    flex: 1,
    fontSize: 15,
    color: "#1e40af",
    fontWeight: "600",
    lineHeight: 22,
  },
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 16,
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
  summaryCard: {
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
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  summaryDisease: {
    fontSize: 15,
    color: "#374151",
    flex: 1,
  },
  summaryBadge: {
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 32,
    alignItems: "center",
  },
  summaryCount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  detectionsCard: {
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
  detectionItem: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  detectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  detectionNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  detectionDisease: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  detectionConfidence: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detectionConfidenceLabel: {
    fontSize: 13,
    color: "#6b7280",
  },
  detectionConfidenceValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10b981",
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