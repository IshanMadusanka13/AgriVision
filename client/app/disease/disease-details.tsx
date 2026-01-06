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
import { get_detection_by_id } from "@/services/api";

interface Detection {
  disease: string;
  confidence: number;
  bbox: number[];
  severity: string;
}

interface DiseaseResult {
  annotated_image?: string;
  total_detections?: number;
  detections?: Detection[];
  disease_summary?: Record<string, number>;
  conclusion?: string;
  recommendations?: Record<string, string[]>;
  status?: string;
  created_at?: string;
}

export default function DiseaseDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { detectionId } = params;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiseaseResult | null>(null);

  useEffect(() => {
    const loadDetection = async () => {
      if (!detectionId) {
        setError("No detection ID provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const detection = await get_detection_by_id(detectionId as string);
        setResult(detection);
      } catch (err: any) {
        console.error("Load detection error:", err);
        setError(err.message || "Failed to load detection details");
      } finally {
        setLoading(false);
      }
    };

    loadDetection();
  }, [detectionId]);

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleShare = async () => {
    if (!result) return;
    
    try {
      const diseaseSummary = result.disease_summary 
        ? Object.entries(result.disease_summary)
            .map(([disease, count]) => `${disease}: ${count}`)
            .join("\n• ")
        : "";
      
      let recommendationsText = "";
      if (result.recommendations) {
        recommendationsText = Object.entries(result.recommendations)
          .map(([disease, recs]) => {
            return `\n${disease}:\n• ${recs.join("\n• ")}`;
          })
          .join("\n");
      }
      
      await Share.share({
        message: `🔬 Disease Detection Results\n\n` +
                 `Date: ${formatDate(result.created_at)}\n` +
                 `Total Detections: ${result.total_detections}\n` +
                 `Disease Summary:\n• ${diseaseSummary}\n\n` +
                 `Conclusion: ${result.conclusion}\n\n` +
                 `Recommendations:${recommendationsText}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorTitle}>Failed to Load</Text>
        <Text style={styles.errorMessage}>
          {error || "Detection not found"}
        </Text>
        
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={() => router.back()}
        >
          <Text style={styles.buttonIcon}>←</Text>
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const mostSevereDetection = result.detections?.reduce((prev, current) => {
    const severityOrder = { High: 3, Moderate: 2, Low: 1, None: 0 };
    const prevScore = severityOrder[prev.severity as keyof typeof severityOrder] || 0;
    const currentScore = severityOrder[current.severity as keyof typeof severityOrder] || 0;
    return currentScore > prevScore ? current : prev;
  }, result.detections[0]);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔬 Detection Details</Text>
        {result.created_at && (
          <Text style={styles.headerSubtitle}>
            {formatDate(result.created_at)}
          </Text>
        )}
      </View>

      <View style={styles.imageContainer}>
        {result.annotated_image && (
          <Image 
            source={{ uri: result.annotated_image }} 
            style={styles.image}
            resizeMode="contain"
          />
        )}
      </View>

      {result.conclusion && (
        <View style={styles.conclusionCard}>
          <Text style={styles.conclusionIcon}>📋</Text>
          <Text style={styles.conclusionText}>{result.conclusion}</Text>
        </View>
      )}

      <View style={styles.resultsCard}>
        <Text style={styles.cardTitle}>Summary</Text>
        
        {mostSevereDetection && (
          <>
            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Primary Disease:</Text>
              <Text style={styles.resultValue}>{mostSevereDetection.disease}</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Confidence:</Text>
              <View style={styles.confidenceContainer}>
                <Text style={styles.resultValue}>{mostSevereDetection.confidence}%</Text>
                <View style={styles.confidenceBar}>
                  <View 
                    style={[
                      styles.confidenceFill, 
                      { width: `${mostSevereDetection.confidence}%` }
                    ]} 
                  />
                </View>
              </View>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Severity:</Text>
              <View style={styles.severityContainer}>
                <Text style={styles.severityIcon}>
                  {getSeverityIcon(mostSevereDetection.severity)}
                </Text>
                <Text 
                  style={[
                    styles.resultValue, 
                    { color: getSeverityColor(mostSevereDetection.severity) }
                  ]}
                >
                  {mostSevereDetection.severity}
                </Text>
              </View>
            </View>
          </>
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
                <View style={[
                  styles.severityBadge,
                  { backgroundColor: getSeverityColor(detection.severity) }
                ]}>
                  <Text style={styles.severityBadgeText}>
                    {detection.severity}
                  </Text>
                </View>
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

      {result.recommendations && Object.keys(result.recommendations).length > 0 && (
        <View style={styles.recommendationsCard}>
          <Text style={styles.recommendationsTitle}>
            💡 Treatment Recommendations
          </Text>
          {Object.entries(result.recommendations).map(([disease, recs], diseaseIndex) => (
            <View key={diseaseIndex} style={styles.diseaseRecommendationSection}>
              <Text style={styles.diseaseRecommendationTitle}>{disease}</Text>
              {recs.map((rec: string, recIndex: number) => (
                <View key={recIndex} style={styles.recommendationItem}>
                  <Text style={styles.recommendationBullet}>•</Text>
                  <Text style={styles.recommendationText}>{rec}</Text>
                </View>
              ))}
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
          <Text style={styles.buttonIcon}>←</Text>
          <Text style={styles.buttonText}>Back to History</Text>
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
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
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
  diseaseRecommendationSection: {
    marginBottom: 16,
  },
  diseaseRecommendationTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  recommendationItem: {
    flexDirection: "row",
    marginBottom: 8,
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
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
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