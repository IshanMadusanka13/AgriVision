import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import api from "@/services/api";

// Define colors per grade
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
  const [imgW, setImgW] = useState(0);
  const [imgH, setImgH] = useState(0);

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={{ marginTop: 10, color: "#374151" }}>
          Grading image...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 60 }} // safe bottom padding
    >
      <Text style={styles.title}>Grading Result</Text>

      {/* Image without bounding boxes */}
      <View
        style={styles.imageWrapper}
        onLayout={(e) => {
          setImgW(e.nativeEvent.layout.width);
          setImgH(e.nativeEvent.layout.height);
        }}
      >
        <Image
          source={{ uri: firstImageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      {/* Category Cards */}
      <View style={styles.cardsContainer}>
        <View style={[styles.categoryCard, { borderLeftColor: gradeColors["Category A"] }]}>
          <Text style={styles.cardTitle}>Grade A Category Quality</Text>
          <Text style={styles.cardCount}>Count: {result.counts["Category A"] || 0}</Text>
          <Text style={styles.cardDesc}>
           ඉතා හොඳ ගුණාත්මක තත්වයේ Scotch Bonnet කාණ්ඩයයි.කොළ පැහැයෙන් යුක්තයි.
          </Text>
          <Text style={styles.cardUsage}>
            භාවිතය: Export, Supermarkets, Local markets
          </Text>
        </View>

        <View style={[styles.categoryCard, { borderLeftColor: gradeColors["Category B"] }]}>
          <Text style={styles.cardTitle}>Grade B Category Quality</Text>
          <Text style={styles.cardCount}>Count: {result.counts["Category B"] || 0}</Text>
          <Text style={styles.cardDesc}>
           හොඳ තත්ත්වයේ කොළ සහ කහ මුසු Scotch Bonnet කාණ්ඩයයි.
          </Text>
          <Text style={styles.cardUsage}>
            භාවිතය: Pickle,Local markets, Wholesale
          </Text>
        </View>

        <View style={[styles.categoryCard, { borderLeftColor: gradeColors["Category C"] }]}>
          <Text style={styles.cardTitle}>Grade C Category Quality</Text>
          <Text style={styles.cardCount}>Count: {result.counts["Category C"] || 0}</Text>
          <Text style={styles.cardDesc}>
             තැබිලි සහ රතු කාණ්ඩයේ Scotch Bonnet වර්ගයයි Processing සඳහා යෝග්‍යයි. 
          </Text>
          <Text style={styles.cardUsage}>
            භාවිතය: Sauce, Chilli powder, Dry processing
          </Text>
        </View>

        <View style={[styles.categoryCard, { borderLeftColor: gradeColors["Category D"] }]}>
          <Text style={styles.cardTitle}>Grade D Category Quality</Text>
          <Text style={styles.cardCount}>Count: {result.counts["Category D"] || 0}</Text>
          <Text style={styles.cardDesc}>
            වෙළඳපොල භාවිතයට ගත නොහැකි කාණ්ඩයයි.නමුත් වෙනත් අමුද්‍රව්‍ය සැකසීමට ගත හැකිය.
          </Text>
          <Text style={styles.cardUsage}>
            භාවිතය: Compost, Animal feed, Industrial use
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.nextBtn}
        onPress={() =>
          router.push({
            pathname: "/quality/sortingquality",
            params: { 
              result: JSON.stringify(result),
              images: JSON.stringify(imgArray) // keep this to send images
            },
          })
        }
      >
        <Text style={styles.nextText}>Go to Sorting →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  imageWrapper: {
    width: "100%",
    height: 300,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 3,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  cardsContainer: {
    marginBottom: 16,
  },
  categoryCard: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937",
  },
  cardCount: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 13,
    color: "#374151",
    marginBottom: 4,
  },
  cardUsage: {
    fontSize: 12,
    color: "#6b7280",
  },
  nextBtn: {
    backgroundColor: "#10b981",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  nextText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
