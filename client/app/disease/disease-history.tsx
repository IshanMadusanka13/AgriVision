import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { get_user_detections } from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface HistoryItem {
  id: string;
  annotated_image_url: string;
  total_detections: number;
  disease_summary: Record<string, number>;
  conclusion: string;
  status: string;
  created_at: string;
}

export default function DiseaseHistoryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detections, setDetections] = useState<HistoryItem[]>([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const email = await AsyncStorage.getItem("userEmail");
      
      if (!email) {
        Alert.alert(
          "Authentication Required",
          "Please log in to view your scan history",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      setUserEmail(email);
      setLoading(true);

      const response = await get_user_detections(email, 20, 0);
      setDetections(response.detections);
    } catch (error: any) {
      console.error("Load history error:", error);
      Alert.alert("Error", error.message || "Failed to load scan history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const handleViewDetection = (detectionId: string) => {
    router.push({
      pathname: "/disease/disease-details" as any,
      params: { detectionId },
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderItem = ({ item }: { item: HistoryItem }) => {
    const primaryDisease = Object.keys(item.disease_summary)[0] || "Unknown";
    const detectionCount = item.total_detections;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleViewDetection(item.id)}
      >
        <View style={styles.cardContent}>
          {item.annotated_image_url && (
            <Image
              source={{ uri: item.annotated_image_url }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          )}
          
          <View style={styles.cardInfo}>
            <View style={styles.cardHeader}>
              <Text style={styles.primaryDisease} numberOfLines={1}>
                {primaryDisease}
              </Text>
              <Text style={styles.detectionCount}>
                {detectionCount} {detectionCount === 1 ? "detection" : "detections"}
              </Text>
            </View>

            <Text style={styles.conclusion} numberOfLines={2}>
              {item.conclusion}
            </Text>

            {item.disease_summary && Object.keys(item.disease_summary).length > 1 && (
              <View style={styles.summaryContainer}>
                {Object.entries(item.disease_summary).slice(0, 3).map(([disease, count], index) => (
                  <View key={index} style={styles.summaryBadge}>
                    <Text style={styles.summaryText}>
                      {disease}: {count}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.cardFooter}>
              <Text style={styles.date}>{formatDate(item.created_at)}</Text>
              <Text style={styles.viewDetails}>View Details →</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  if (detections.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>📋</Text>
        <Text style={styles.emptyTitle}>No Scan History</Text>
        <Text style={styles.emptyMessage}>
          Your disease detection scans will appear here
        </Text>
        
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => router.push("/disease/disease-camera" as any)}
        >
          <Text style={styles.buttonIcon}>📷</Text>
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            Start Scanning
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔬 Scan History</Text>
        <Text style={styles.headerSubtitle}>
          {detections.length} scan{detections.length !== 1 ? "s" : ""} saved
        </Text>
      </View>

      <FlatList
        data={detections}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#ef4444"]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 16,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 8,
  },
  emptyMessage: {
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
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    flexDirection: "row",
    padding: 12,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  primaryDisease: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    flex: 1,
    marginRight: 8,
  },
  detectionCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ef4444",
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  conclusion: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginBottom: 8,
  },
  summaryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  summaryBadge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    fontSize: 12,
    color: "#9ca3af",
  },
  viewDetails: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3b82f6",
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
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: "#ef4444",
    borderColor: "#ef4444",
  },
  buttonIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },
  primaryButtonText: {
    color: "#fff",
  },
});