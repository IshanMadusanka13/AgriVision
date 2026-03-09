import React, { useEffect, useState } from "react";  
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from "@/services/api";

const gradeColors: Record<string, string> = {
  "Category A": "#10b981",
  "Category B": "#f59e0b",
  "Category C": "#ef4444",
  "Category D": "#3a3203ff",
};

export default function gradingquality() {
  const { images } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [expandedUsage, setExpandedUsage] = useState<string | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [imageModalVisible, setImageModalVisible] = useState(false);

  const imgArray = JSON.parse(images as string);
  const firstImageUri = imgArray[0];

  useEffect(() => {
    const upload = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem('userId');
        const data = await api.gradeQuality(imgArray, storedUserId || undefined);
        setResult(data);
        setLoading(false);
      } catch (err) {
        console.error(err);
      }
    };
    upload();
  }, []);

  // Handle navigation with delay for data serialization
  useEffect(() => {
    if (navigating && result) {
      const timer = setTimeout(() => {
        router.push({
          pathname: "/quality/sortingquality",
          params: {
            result: JSON.stringify(result),
            images: JSON.stringify(imgArray),
          },
        });
        // Reset navigating state after navigation
        setNavigating(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [navigating, result, router, imgArray]);

 
  if (loading || !result) {
    return (
      <SafeAreaView style={styles.loadingSafe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Grading in progress...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const counts = result.counts || {};
  const allZero =
    (counts["Category A"] || 0) +
      (counts["Category B"] || 0) +
      (counts["Category C"] || 0) +
      (counts["Category D"] || 0) ===
    0;

  const toggleUsage = (grade: string) => {
    setExpandedUsage(expandedUsage === grade ? null : grade);
  };


  if (allZero) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centeredContainer}>
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateEmoji}>🌶️</Text>
            <Text style={styles.emptyStateTitle}>No Scotch Bonnet Detected.</Text>
            <Text style={styles.emptyStateText}>
              The uploaded image does not contain Scotch Bonnet peppers.
            </Text>
           
          </View>

          <TouchableOpacity
            style={[styles.nextBtn, styles.tryAgainBtn]}
            onPress={() => router.push("/quality/uploadquality")}
          >
            <Text style={styles.nextText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>📊 Grading Result</Text>

        {/* Image Viewer Section */}
        <View style={styles.imageSection}>
          <View style={styles.imageWrapper}>
            <Image source={{ uri: firstImageUri }} style={styles.image} />
          </View>
          <TouchableOpacity 
            style={styles.viewImageBtn}
            onPress={() => setImageModalVisible(true)}
          >
            <Text style={styles.viewImageText}>🔍 View Full Image</Text>
          </TouchableOpacity>
        </View>

        {/* CATEGORY A */}
        <View
          style={[
            styles.categoryCard,
            { borderLeftColor: gradeColors["Category A"] },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Grade A Quality</Text>
            <TouchableOpacity onPress={() => toggleUsage("A")}>
              <Text style={styles.viewBtn}>
                {expandedUsage === "A" ? "Hide" : "View"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardCount}>
            Count: {counts["Category A"] || 0}
          </Text>

          <Text style={styles.desc}>
          This category represents a very high-quality Scotch Bonnet. 
          The color is consistently green, with no blemishes, drying, or deformed shapes.
        </Text>

          {expandedUsage === "A" && (
           <Text style={styles.usage}>
            🔹 Usage: Highly suitable for export markets, supermarket chains, and premium buyers.
          </Text>
          )}
        </View>

        {/* CATEGORY B */}
        <View
          style={[
            styles.categoryCard,
            { borderLeftColor: gradeColors["Category B"] },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Grade B Quality</Text>
            <TouchableOpacity onPress={() => toggleUsage("B")}>
              <Text style={styles.viewBtn}>
                {expandedUsage === "B" ? "Hide" : "View"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardCount}>
            Count: {counts["Category B"] || 0}
          </Text>

          <Text style={styles.desc}>
          This is a good-quality Scotch Bonnet. The color is a mix of green and yellow, 
          with no blemishes, drying, or deformed shapes.
        </Text>


          {expandedUsage === "B" && (
            <Text style={styles.usage}>
            🔹 Usage: Suitable for general markets, hotel kitchens, and pickle preparation.
          </Text>

          )}
        </View>

        {/* CATEGORY C */}
        <View
          style={[
            styles.categoryCard,
            { borderLeftColor: gradeColors["Category C"] },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Grade C Quality</Text>
            <TouchableOpacity onPress={() => toggleUsage("C")}>
              <Text style={styles.viewBtn}>
                {expandedUsage === "C" ? "Hide" : "View"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardCount}>
            Count: {counts["Category C"] || 0}
          </Text>

          <Text style={styles.desc}>
          The peppers in this category are orange or red in color. 
          Some may have slightly irregular shapes.
        </Text>

          {expandedUsage === "C" && (
            <Text style={styles.usage}>
            🔹 Usage: Used for processing into sauces, pastes, powders, or for drying.
          </Text>

          )}
        </View>

        {/* CATEGORY D */}
        <View
          style={[
            styles.categoryCard,
            { borderLeftColor: gradeColors["Category D"] },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Grade D Quality</Text>
            <TouchableOpacity onPress={() => toggleUsage("D")}>
              <Text style={styles.viewBtn}>
                {expandedUsage === "D" ? "Hide" : "View"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cardCount}>
            Count: {counts["Category D"] || 0}
          </Text>

          <Text style={styles.desc}>
            In this category, peppers clearly show blemishes, drying, pest damage, and deformed shapes.
          </Text>


          {expandedUsage === "D" && (
            <Text style={styles.usage}>
          🔹 Usage: Not suitable for human consumption; used for compost, animal feed, or industrial purposes.
        </Text>

          )}
        </View>

        {/* VIEW GRADE DETAILS BUTTON */}
        <TouchableOpacity
          style={styles.infoBtn}
          onPress={() => setInfoVisible(true)}
        >
          <Text style={styles.infoText}>View Grade Details</Text>
        </TouchableOpacity>

        {/* POPUP — UNCHANGED */}
        <Modal transparent animationType="fade" visible={infoVisible}>
          <View style={styles.modalBg}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                Scotch Bonnet Quality Grading
              </Text>

              <Text
                style={[
                  styles.modalItem,
                  { borderLeftColor: gradeColors["Category A"] },
                ]}
              >
                <Text style={styles.bold}>Grade A:</Text> Green color with no blemish– Excellent quality. Suitable
                 for export and supermarket sales.
              </Text>

              <Text
                style={[
                  styles.modalItem,
                  { borderLeftColor: gradeColors["Category B"] },
                ]}
              >
                <Text style={styles.bold}>Grade B:</Text> Green & yellow mix color with no blemish – Good quality. 
                Suitable for general markets and hotel use.

              </Text>

              <Text
                style={[
                  styles.modalItem,
                  { borderLeftColor: gradeColors["Category C"] },
                ]}
              >
                <Text style={styles.bold}>Grade C:</Text> Red & orange color with no blemish– Suitable for processing. Used for sauces, powders, 
                drying, and similar purposes.

              </Text>

              <Text
                style={[
                  styles.modalItem,
                  { borderLeftColor: gradeColors["Category D"] },
                ]}
              >
                <Text style={styles.bold}>Grade D:</Text> This category is not suitable for use without 
                special processing. Used for compost and industrial purposes.

              </Text>

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setInfoVisible(false)}
              >
                <Text style={styles.bold}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => setNavigating(true)}
          disabled={navigating}
        >
          <Text style={styles.nextText}>
            {navigating ? "Preparing data..." : "Go to Sorting →"}
          </Text>
        </TouchableOpacity>

        {/* Navigation Loading Modal */}
        <Modal visible={navigating} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalEmoji}>⏳</Text>
              <ActivityIndicator size="large" color="#10b981" />
              <Text style={styles.modalText}>Processing data...</Text>
            </View>
          </View>
        </Modal>

        {/* Image Viewer Modal */}
        <Modal visible={imageModalVisible} transparent animationType="fade">
          <View style={styles.imageModalOverlay}>
            <View style={styles.imageModalContent}>
              <TouchableOpacity 
                style={styles.closeImageBtn}
                onPress={() => setImageModalVisible(false)}
              >
                <Text style={styles.closeImageBtnText}>✕</Text>
              </TouchableOpacity>
              <Image 
                source={{ uri: firstImageUri }} 
                style={styles.fullImage}
                resizeMode="contain"
              />
             
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },

  
  loadingSafe: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },

  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  
  imageSection: { marginBottom: 20 },
  imageWrapper: { height: 280, marginBottom: 12, borderRadius: 12, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  viewImageBtn: {
    backgroundColor: "#10b981",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  viewImageText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
  },

  emptyStateCard: {
    width: "92%",
    maxWidth: 420,
    backgroundColor: "#ecfdf5",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#86efac",
    alignItems: "center",
    marginBottom: 18,
  },
  emptyStateEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#065f46",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateText: {
    fontSize: 15,
    color: "#1f2937",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 8,
  },
  emptyStateHint: {
    fontSize: 14,
    color: "#047857",
    textAlign: "center",
    lineHeight: 20,
  },

  categoryCard: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardCount: { fontWeight: "600", marginBottom: 4 },
  viewBtn: { color: "#10b981", fontWeight: "700" },
  desc: { fontSize: 14, color: "#374151", marginBottom: 6 },
  usage: { fontSize: 13, color: "#065f46" },

  infoBtn: {
    borderWidth: 1,
    borderColor: "#10b981",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 16,
  },
  infoText: { fontWeight: "700", color: "#10b981" },

  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: { fontWeight: "700", fontSize: 16, marginBottom: 12 },
  modalItem: { borderLeftWidth: 6, paddingLeft: 10, marginBottom: 8 },
  closeBtn: { alignSelf: "flex-end", marginTop: 10 },
  bold: { fontWeight: "700" },

  nextBtn: {
    backgroundColor: "#10b981",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 20,
    width: "100%",
  },
  tryAgainBtn: {
    backgroundColor: "#138745",
    marginVertical: 0,
    width: "92%",
    maxWidth: 420,
  },
  nextText: { color: "#fff", fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
  },
  modalEmoji: {
    fontSize: 60,
    marginBottom: 16,
  },
  modalText: {
    marginTop: 16,
    color: "#6b7280",
    fontSize: 14,
    fontWeight: "600",
  },

  imageModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalContent: {
    width: "95%",
    height: "85%",
    backgroundColor: "transparent",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  closeImageBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
    backgroundColor: "#ef4444",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  closeImageBtnText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "700",
  },
  fullImage: {
    width: "100%",
    height: "90%",
    marginTop: 20,
    borderRadius: 12,
  },
  imageModalTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 12,
  },
});
