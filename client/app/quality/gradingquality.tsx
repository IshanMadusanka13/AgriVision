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

  const imgArray = JSON.parse(images as string);
  const firstImageUri = imgArray[0];

  useEffect(() => {
    const upload = async () => {
      try {
        const data = await api.gradeQuality(imgArray);
        setResult(data);
        setLoading(false);
      } catch (err) {
        console.error(err);
      }
    };
    upload();
  }, []);

 
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
          <Text style={[styles.title, { textAlign: "center", marginBottom: 20 }]}>
            The uploaded image we doesn't detect Scotch Bonnet ,
            Please upload a correct scotch bonnet batch images .
          </Text>

          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: "#138745ff" }]}
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

        <View style={styles.imageWrapper}>
          <Image source={{ uri: firstImageUri }} style={styles.image} />
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
                <Text style={styles.bold}>Grade A:</Text> Green color – Excellent quality. Suitable
                 for export and supermarket sales.
              </Text>

              <Text
                style={[
                  styles.modalItem,
                  { borderLeftColor: gradeColors["Category B"] },
                ]}
              >
                <Text style={styles.bold}>Grade B:</Text> Green & yellow mix color – Good quality. 
                Suitable for general markets and hotel use.

              </Text>

              <Text
                style={[
                  styles.modalItem,
                  { borderLeftColor: gradeColors["Category C"] },
                ]}
              >
                <Text style={styles.bold}>Grade C:</Text> Red & orange color – Suitable for processing. Used for sauces, powders, 
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
          onPress={() =>
            router.push({
              pathname: "/quality/sortingquality",
              params: {
                result: JSON.stringify(result),
                images: JSON.stringify(imgArray),
              },
            })
          }
        >
          <Text style={styles.nextText}>Go to Sorting →</Text>
        </TouchableOpacity>
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
  imageWrapper: { height: 280, marginBottom: 16 },
  image: { width: "100%", height: "100%" },

  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
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
  },
  nextText: { color: "#fff", fontWeight: "700" },
});