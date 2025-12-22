import React, { useState, useEffect, useRef } from "react";
import { 
  View, Text, StyleSheet, ScrollView, Image, Dimensions, Animated 
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

export default function SortingQuality() {
  const { result, images } = useLocalSearchParams();

  const data = result ? JSON.parse(result as string) : null;
  const imgArray = images ? JSON.parse(images as string) : [];

  if (!data) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>වර්ගීකරණ දත්ත නොමැත.</Text>
      </View>
    );
  }

  const firstImageUri = imgArray[0];
  const [imgW, setImgW] = useState(Dimensions.get("window").width - 50);
  const [imgH, setImgH] = useState(300);

  const gradeColors: Record<string, string> = {
    "Category A": "#065f46",
    "Category B": "#b45309",
    "Category C": "#991b1b",
    "Category D": "#1e3a8a",
  };

  const scaleX = imgW / data.image_width;
  const scaleY = imgH / data.image_height;

  const categoryCounts = Object.keys(data.bins).map((c) => ({
    category: c,
    count: data.bins[c].length,
  }));
  const maxCategory = categoryCounts.reduce((prev, curr) =>
    curr.count > prev.count ? curr : prev
  );

  const totalAnim = useRef(new Animated.Value(0)).current;
  const maxAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(300, [
      Animated.spring(totalAnim, { toValue: 1, useNativeDriver: true }),
      Animated.spring(maxAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>වර්ගීකරණ ප්‍රතිඵල</Text>

      {/* Animated Cards with Sinhala phrasing */}
      <View style={styles.cardsContainer}>
        <Animated.View style={[styles.infoCard, { 
          backgroundColor: "#e4edecff",
          transform: [{ scale: totalAnim }]
        }]}>
          <Text style={styles.cardTitle}>Total Count</Text>
          <Text style={styles.cardValue}>{data.total_peppers}</Text>
        </Animated.View>

        <Animated.View style={[styles.infoCard, { 
          backgroundColor: "#e4edecff",
          transform: [{ scale: maxAnim }]
        }]}>
          <Text style={styles.cardTitle}>Max Count</Text>
          <Text style={styles.cardValue}>
            {maxCategory.category} ({maxCategory.count})
          </Text>
        </Animated.View>
      </View>

      {/* Image with bounding boxes */}
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
       <Svg style={StyleSheet.absoluteFill}>
  {Object.entries(data.bins).map(([category, peppers]: any) =>
    peppers.map((pepper: any) => {
      const [x1, y1, x2, y2] = pepper.bbox;
      return (
        <React.Fragment key={`${category}_${pepper.number}`}>
          <Rect
            x={x1 * scaleX}
            y={y1 * scaleY}
            width={(x2 - x1) * scaleX}
            height={(y2 - y1) * scaleY}
            stroke={gradeColors[pepper.grade] || "white"}
            strokeWidth={2}
            fill="transparent"
          />
          <SvgText
            x={x1 * scaleX + 4}
            y={y1 * scaleY + 16}
            fill={gradeColors[pepper.grade] || "white"}
            fontSize={16}
            fontWeight="bold"
          >
            {pepper.number}
          </SvgText>
        </React.Fragment>
      );
    })
  )}
</Svg>

      </View>

      {/* Sinhala + English description for bounding boxes */}
      <View style={styles.descriptionBox}>
        <Text style={styles.descriptionText}>
          සලකුණු කර ඇති හැඳුනුම්කරණ කොටස් (Bounding boxes) මගින් 
          මෙම රූපයේ Scotch Bonnet  වර්ග හඳුනාගත හැක. 
          වර්ගය අනුව වර්ණය වෙනස් වේ (Grade A-D – Category Quality).
        </Text>
      </View>

      {/* Grid of bins */}
      <View style={styles.binsContainer}>
        {Object.keys(data.bins).map((category) => (
          <View
            key={category}
            style={[styles.binBox, { backgroundColor: gradeColors[category] }]}
          >
            <Text style={styles.binTitle}>
              {`${category} Grade Quality`}
            </Text>
            <Text style={styles.binNumbers}>
              {data.bins[category].map((p: any) => p.number).join(", ")}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 25, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 15 },

  cardsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  infoCard: {
    width: "48%",
    padding: 14,
    borderRadius: 12,
    elevation: 4,
  },
  cardTitle: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
  cardValue: { fontSize: 18, fontWeight: "800" },
  cardTip: { fontSize: 13, marginTop: 4, color: "#4b5563" },

  imageWrapper: {
    width: "100%",
    height: 300,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 3,
  },
  image: { width: "100%", height: "100%" },

  descriptionBox: {
    backgroundColor: "#e5e7eb",
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  descriptionText: { fontSize: 14, color: "#1f2937" },

  binsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  binBox: {
    width: "48%",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  binTitle: { fontWeight: "700", fontSize: 16, color: "#fff", marginBottom: 6 },
  binNumbers: { color: "#fff", fontSize: 14 },
});
