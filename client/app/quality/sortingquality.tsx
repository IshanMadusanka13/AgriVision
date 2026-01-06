import React, { useState, useEffect, useRef } from "react";   
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Animated,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useLocalSearchParams ,useRouter } from "expo-router";
import Svg, { Rect, Text as SvgText, G, Path } from "react-native-svg";

export default function SortingQuality() {
  const { result, images } = useLocalSearchParams();

  const data = result ? JSON.parse(result as string) : null;
  const imgArray = images ? JSON.parse(images as string) : [];

  const [imgW, setImgW] = useState(Dimensions.get("window").width - 50);
  const [imgH, setImgH] = useState(300);
  const [selectedSlice, setSelectedSlice] = useState<string | null>(null);

  const gradeColors: Record<string, string> = {
    "Category A": "#065f46",
    "Category B": "#b7af18ff",
    "Category C": "#991b1b",
    "Category D": "#1e3a8a",
  };

  if (!data || data.total_peppers === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={{ fontSize: 18 }}>No classification data available.</Text>
        <Image
          source={{
            uri: "https://upload.wikimedia.org/wikipedia/commons/1/12/Scotch_Bonnet_Chili.jpg",
          }}
          style={{ width: 200, height: 200, marginTop: 20 }}
        />
      </View>
    );
  }

  const firstImageUri =
    imgArray[0] ||
    "https://upload.wikimedia.org/wikipedia/commons/1/12/Scotch_Bonnet_Chili.jpg";

  const scaleX = imgW / data.image_width;
  const scaleY = imgH / data.image_height;

  const categoryCounts = Object.keys(data.bins).map((c) => ({
    category: c,
    count: data.bins[c].length,
    percentage:
      data.total_peppers > 0
        ? Math.round((data.bins[c].length / data.total_peppers) * 100)
        : 0,
  }));

  const maxCount = Math.max(...categoryCounts.map((c) => c.count));
  const maxCategories = categoryCounts.filter((c) => c.count === maxCount);

  const totalAnim = useRef(new Animated.Value(0)).current;
  const maxAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(300, [
      Animated.spring(totalAnim, { toValue: 1, useNativeDriver: true }),
      Animated.spring(maxAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, []);

  // Pie chart calculations
  const radius = 100;
  const center = radius;
  const total = categoryCounts.reduce((sum, c) => sum + c.count, 0);

  const piePaths: { pathData: string; color: string; category: string; percentage: number; midAngle: number }[] = [];
  let startAngle = 0;

  categoryCounts.forEach((c) => {
    const sliceAngle = (c.count / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);
    const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

    const pathData = `M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2} Z`;
    const midAngle = startAngle + sliceAngle / 2;

    piePaths.push({
      pathData,
      color: gradeColors[c.category],
      category: c.category,
      percentage: c.percentage,
      midAngle,
    });

    startAngle = endAngle;
  });
  
const router = useRouter();
  const handleAnalysis = () => {
    router.push("/quality/batchanalysis");
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>🧺 Visual Sorting</Text>

      {/* Info Cards */}
      <View style={styles.cardsContainer}>
        <Animated.View
          style={[styles.infoCard, { transform: [{ scale: totalAnim }] }]}
        >
          <Text style={styles.cardTitle}>Total Count</Text>
          <Text style={styles.cardValue}>{data.total_peppers}</Text>
        </Animated.View>

        <Animated.View
          style={[styles.infoCard, styles.maxCard, { transform: [{ scale: maxAnim }] }]}
        >
          <Text style={styles.cardTitle}>Max Count</Text>
          {maxCategories.map((c) => (
            <Text
              key={c.category}
              style={[styles.cardValue, { color: gradeColors[c.category] }]}
            >
              {c.category} ({c.count})
            </Text>
          ))}
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
        <Image source={{ uri: firstImageUri }} style={styles.image} resizeMode="contain" />
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
                    stroke={gradeColors[pepper.grade]}
                    strokeWidth={2}
                    fill="transparent"
                  />
                  <SvgText
                    x={x1 * scaleX + 4}
                    y={y1 * scaleY + 16}
                    fill={gradeColors[pepper.grade]}
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

      {/* Sinhala description */}
      <View style={styles.descriptionBox}>
        <Text style={styles.descriptionText}>
         The Scotch Bonnet varieties can be identified in this image by the marked Bounding boxes and numeric labels . The color varies depending on
          the variety (Grade A-D – Category Quality).
        </Text>
      </View>

      {/* Bins with percentages */}
      <View style={styles.binsContainer}>
        {categoryCounts.map((c) => {
          const isMax = maxCategories.some((m) => m.category === c.category);
          const peppers = data.bins[c.category];
          return (
            <View
              key={c.category}
              style={[styles.binBox, { backgroundColor: gradeColors[c.category] }, isMax && styles.maxBin]}
            >
              {isMax && (
                <Animated.View style={[styles.maxBadge, { transform: [{ scale: maxAnim }] }]}>
                  <Text style={styles.maxBadgeText}>MAX</Text>
                </Animated.View>
              )}
              <Text style={styles.binTitle}>{`${c.category} Grade Quality`}</Text>
              <Text style={styles.binNumbers}>
                {c.count} ({c.percentage}%)
              </Text>
              <Text style={styles.binDescription}>
               All Scotch bonnet percentages in this category
              </Text>
              <View style={styles.pepperList}>
                {peppers.map((p: any) => (
                  <Text key={p.number} style={styles.pepperNumber}>
                    {p.number}
                  </Text>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      {/* Pie Chart Card with selected slice */}
      <View style={styles.pieCard}>
        <Text style={styles.pieCardTitle}>Scotch Bonnet Grade Distribution</Text>

        {/* Show selected Quality if clicked */}
        {selectedSlice && (
          <Text style={styles.selectedQualityText}>
            Selected: {selectedSlice}
          </Text>
        )}

        <View style={{ flexDirection: "row", justifyContent: "space-around", marginVertical: 10 }}>
          {categoryCounts.map((c) => (
            <TouchableOpacity
              key={c.category}
              style={[styles.gradeButton, { backgroundColor: gradeColors[c.category] }]}
              onPress={() => setSelectedSlice(c.category)}
            >
              <Text style={styles.gradeButtonText}>{c.category.split(" ")[1]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ alignItems: "center", marginVertical: 16 }}>
          <Svg width={radius * 2} height={radius * 2}>
            <G>
              {piePaths.map((slice) => {
                const textX = center + (radius / 2) * Math.cos(slice.midAngle);
                const textY = center + (radius / 2) * Math.sin(slice.midAngle);
                return (
                  <React.Fragment key={slice.category}>
                    <Path
                      d={slice.pathData}
                      fill={slice.color}
                    />
                    {slice.percentage > 0 && (
                      <SvgText
                        x={textX}
                        y={textY}
                        fontSize={14}
                        fontWeight="bold"
                        fill="#fff"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        {slice.percentage}%
                      </SvgText>
                    )}
                  </React.Fragment>
                );
              })}
            </G>
          </Svg>
        </View>
      </View>
      {/* Summary */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>Summary</Text>
        <Text style={styles.summaryText}>Total Scotch Bonnets: {data.total_peppers}</Text>
        {categoryCounts.map((c) => {
          let desc = "";
          if (c.category === "Category A") {
  desc = "This Scotch Bonnet category is in excellent quality condition. It is green in color.";
} else if (c.category === "Category B") {
  desc = "This Scotch Bonnet category is in good condition with a mix of yellow color.";
} else if (c.category === "Category C") {
  desc = "This Scotch Bonnet variety belongs to the orange and red category. It is suitable for processing.";
} else if (c.category === "Category D") {
  desc = "This category is not suitable for direct market use, but it can be used for processing into other products.";
}

          return (
            <View key={c.category} style={{ marginBottom: 4 }}>
              <Text style={styles.summaryText}>
                {c.category}: {c.count} ({c.percentage}%)
              </Text>
              <Text style={styles.summaryDescription}>{desc}</Text>
            </View>
          );
        })}
      </View>

      {/* View Analysis Button */}
      <TouchableOpacity style={styles.analysisButton} onPress={handleAnalysis}>
        <Text style={styles.analysisButtonText}>View Analysis</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 25, paddingBottom: 60, backgroundColor: "#ffffff" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 15 },

  cardsContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15 },
  infoCard: { width: "48%", padding: 14, borderRadius: 12, elevation: 4, backgroundColor: "#e4edecff" },
  maxCard: { borderWidth: 2, borderColor: "#16a34a" },
  cardTitle: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
  cardValue: { fontSize: 17, fontWeight: "800" },

  imageWrapper: { width: "100%", height: 300, borderRadius: 12, marginBottom: 16, overflow: "hidden" },
  image: { width: "100%", height: "100%" },

  descriptionBox: { backgroundColor: "#e5e7eb", padding: 10, borderRadius: 8, marginBottom: 16 },
  descriptionText: { fontSize: 14, color: "#1f2937" },

  binsContainer: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 20 },
  binBox: { width: "48%", padding: 12, borderRadius: 10, marginBottom: 12, position: "relative" },
  maxBin: { borderWidth: 3, borderColor: "#facc15", shadowColor: "#facc15", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 8 },
  maxBadge: { position: "absolute", top: -8, right: -8, backgroundColor: "#facc15", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  maxBadgeText: { fontWeight: "900", fontSize: 12, color: "#1f2937" },
  binTitle: { fontWeight: "700", fontSize: 16, color: "#fff" },
  binNumbers: { color: "#fff", fontSize: 14 },
  binDescription: { fontSize: 12, color: "#f3f4f6", marginTop: 2 },
  pepperList: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  pepperNumber: { fontSize: 12, color: "#ffffff", backgroundColor: "rgba(0,0,0,0.2)", paddingHorizontal: 4, paddingVertical: 2, marginRight: 4, marginBottom: 2, borderRadius: 4 },

  pieCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 20, elevation: 4 },
  pieCardTitle: { fontSize: 18, fontWeight: "bold", textAlign: "center", color: "#065f46", marginBottom: 10 },
  gradeButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  gradeButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  selectedQualityText: { fontSize: 16, fontWeight: "700", color: "#065f46", textAlign: "center", marginBottom: 8 },

  summaryBox: { marginTop: 20, padding: 16, backgroundColor: "#e4edec", borderRadius: 12 },
  summaryTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 6, color: "#065f46" },
  summaryText: { fontSize: 15, fontWeight: "700", color: "#065f46" },
  summaryDescription: { fontSize: 13, color: "#065f46", marginLeft: 6, marginBottom: 4 },

  analysisButton: {
    backgroundColor: "#065f46",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    alignItems: "center",
  },
  analysisButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});