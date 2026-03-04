import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Animated,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Polygon, Text as SvgText, G, Path, Circle } from "react-native-svg";

type CategoryName = "Category A" | "Category B" | "Category C" | "Category D";

export default function SortingQuality() {
  const { result, images } = useLocalSearchParams();

  const data = result ? JSON.parse(result as string) : null;
  const imgArray = images ? JSON.parse(images as string) : [];

  const [imgW, setImgW] = useState(Dimensions.get("window").width - 50);
  const [imgH, setImgH] = useState(Dimensions.get("window").width - 50);
  const [selectedSlice, setSelectedSlice] = useState<CategoryName | null>(null);

  const router = useRouter();

  const gradeColors: Record<CategoryName, string> = {
    "Category A": "#059669",
    "Category B": "#ca8a04",
    "Category C": "#dc2626",
    "Category D": "#2563eb",
  };

  const gradeLabels: Record<CategoryName, string> = {
    "Category A": "Grade A Quality",
    "Category B": "Grade B Quality",
    "Category C": "Grade C Quality",
    "Category D": "Grade D Quality",
  };

  if (!data || data.total_peppers === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No classification data available.</Text>
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

  // Correct coordinate mapping for resizeMode="contain"
  const srcW = Number(data.image_width) || 1;
  const srcH = Number(data.image_height) || 1;
  const imageAspect = srcW / srcH;
  const containerAspect = imgW / imgH;

  let renderW = imgW;
  let renderH = imgH;
  let offsetX = 0;
  let offsetY = 0;

  if (containerAspect > imageAspect) {
    renderH = imgH;
    renderW = renderH * imageAspect;
    offsetX = (imgW - renderW) / 2;
  } else {
    renderW = imgW;
    renderH = renderW / imageAspect;
    offsetY = (imgH - renderH) / 2;
  }

  const scaleX = renderW / srcW;
  const scaleY = renderH / srcH;

  const mapX = (x: number) => offsetX + x * scaleX;
  const mapY = (y: number) => offsetY + y * scaleY;

  // This page shows first image only
  const currentImageId = 0;

  const categoryCounts = (Object.keys(data.bins) as CategoryName[]).map((c) => ({
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
    Animated.stagger(250, [
      Animated.spring(totalAnim, { toValue: 1, useNativeDriver: true }),
      Animated.spring(maxAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [maxAnim, totalAnim]);

  // Pie chart
  const radius = 100;
  const center = radius;
  const total = categoryCounts.reduce((sum, c) => sum + c.count, 0);

  const pieSlices = useMemo(() => {
    let startAngle = -Math.PI / 2; // starts at top
    return categoryCounts.map((c) => {
      const sliceAngle = total > 0 ? (c.count / total) * 2 * Math.PI : 0;
      const endAngle = startAngle + sliceAngle;

      const x1 = center + radius * Math.cos(startAngle);
      const y1 = center + radius * Math.sin(startAngle);
      const x2 = center + radius * Math.cos(endAngle);
      const y2 = center + radius * Math.sin(endAngle);
      const largeArcFlag = sliceAngle > Math.PI ? 1 : 0;

      const pathData = `M${center},${center} L${x1},${y1} A${radius},${radius} 0 ${largeArcFlag} 1 ${x2},${y2} Z`;
      const midAngle = startAngle + sliceAngle / 2;

      const slice = {
        category: c.category,
        count: c.count,
        percentage: c.percentage,
        color: gradeColors[c.category],
        pathData,
        midAngle,
      };

      startAngle = endAngle;
      return slice;
    });
  }, [categoryCounts, total, center, radius, gradeColors]);

  const selectedData = selectedSlice
    ? categoryCounts.find((x) => x.category === selectedSlice)
    : null;

  const toRgba = (hex: string, alpha: number) => {
    const clean = hex.replace("#", "");
    const full =
      clean.length === 3
        ? clean
            .split("")
            .map((c) => c + c)
            .join("")
        : clean;
    const r = parseInt(full.substring(0, 2), 16);
    const g = parseInt(full.substring(2, 4), 16);
    const b = parseInt(full.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const renderNumberBadge = (x: number, y: number, num: number, color: string) => (
    <>
      <Circle cx={x} cy={y} r={12} fill="rgba(255,255,255,0.25)" />
      <Circle cx={x} cy={y} r={12} fill="none" stroke={color} strokeWidth={2} />
      <SvgText
        x={x}
        y={y + 4}
        fill="#1e293b"
        fontSize={12}
        fontWeight="900"
        textAnchor="middle"
        alignmentBaseline="middle"
      >
        {num}
      </SvgText>
    </>
  );

  const handleAnalysis = () => {
    router.push("/quality/batchanalysis");
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Classification Results</Text>

      {/* Total and Max cards */}
      <View style={styles.cardsContainer}>
        <Animated.View style={[styles.infoCard, { transform: [{ scale: totalAnim }] }]}>
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIcon}>📊</Text>
          </View>
          <Text style={styles.cardTitle}>Total Count</Text>
          <Text style={styles.cardValue}>{data.total_peppers}</Text>
          <Text style={styles.cardSubtext}>Peppers detected</Text>
        </Animated.View>

        <Animated.View style={[styles.infoCard, styles.maxCard, { transform: [{ scale: maxAnim }] }]}>
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIcon}>📊</Text>
          </View>
          <Text style={styles.cardTitle}>Max Count</Text>
          {maxCategories.map((c) => (
            <View key={c.category}>
              <Text style={[styles.cardValue, { color: gradeColors[c.category] }]}>{c.category}</Text>
              <Text style={styles.cardSubtext}>{c.count} peppers</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Image + overlays */}
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
            peppers
              .filter((pepper: any) => (pepper.image_id ?? 0) === currentImageId)
              .map((pepper: any) => {
                const color = gradeColors[pepper.grade as CategoryName];
                const hasPolygon = Array.isArray(pepper.polygon) && pepper.polygon.length >= 3;

                if (hasPolygon) {
                  const scaledPoints = pepper.polygon.map((p: any) => ({
                    x: mapX(p[0]),
                    y: mapY(p[1]),
                  }));

                  const centerX =
                    scaledPoints.reduce((sum: number, p: any) => sum + p.x, 0) / scaledPoints.length;
                  const centerY =
                    scaledPoints.reduce((sum: number, p: any) => sum + p.y, 0) / scaledPoints.length;

                  const polygonString = scaledPoints.map((p: any) => `${p.x},${p.y}`).join(" ");

                  return (
                    <React.Fragment key={`${category}_${pepper.number}`}>
                      <Polygon
                        points={polygonString}
                        stroke="none"
                        fill={toRgba(color, 0.25)}
                      />
                      {renderNumberBadge(centerX, centerY, pepper.number, color)}
                    </React.Fragment>
                  );
                }

                const [x1, y1, x2, y2] = pepper.bbox;
                const left = mapX(x1);
                const top = mapY(y1);
                const right = mapX(x2);
                const bottom = mapY(y2);
                const centerX = (left + right) / 2;
                const centerY = (top + bottom) / 2;

                const rectPoints = `${left},${top} ${right},${top} ${right},${bottom} ${left},${bottom}`;

                return (
                  <React.Fragment key={`${category}_${pepper.number}`}>
                    <Polygon
                      points={rectPoints}
                      stroke="none"
                      fill={toRgba(color, 0.25)}
                    />
                    {renderNumberBadge(centerX, centerY, pepper.number, color)}
                  </React.Fragment>
                );
              })
          )}
        </Svg>
      </View>

      <View style={styles.descriptionBox}>
        <Text style={styles.descriptionText}>
          Marked regions show detected Scotch Bonnet peppers. Colors indicate quality grade
          (Category A to D).
        </Text>
      </View>

      {/* Category cards */}
      <View style={styles.binsContainer}>
        {categoryCounts.filter((c) => c.count > 0).map((c) => {
          const isMax = maxCategories.some((m) => m.category === c.category);
          const peppers = data.bins[c.category];
          
          return (
            <View
              key={c.category}
              style={[
                styles.binBox,
                { backgroundColor: gradeColors[c.category] },
                isMax && styles.maxBin,
              ]}
            >
              {isMax && (
                <Animated.View style={[styles.maxBadge, { transform: [{ scale: maxAnim }] }]}>
                  <Text style={styles.maxBadgeText}>MAX</Text>
                </Animated.View>
              )}
              <View style={styles.cardHeader}>
                <Text style={styles.binTitle}>{c.category}</Text>
                <Text style={styles.binNumbers}>
                  {c.count} Scotch Bonnet{c.count !== 1 ? "s" : ""} {c.percentage}%
                </Text>
              </View>
              <Text style={styles.binDescription}>Share of peppers in this category</Text>
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

      {/* Interactive Pie Chart */}
      <View style={styles.pieCard}>
        <Text style={styles.pieCardTitle}>Interactive Grade Distribution</Text>
        <Text style={styles.pieHint}>Tap a slice or button to see details.</Text>

        <View style={{ alignItems: "center", marginVertical: 14 }}>
          <Svg width={radius * 2 + 30} height={radius * 2 + 30}>
            <G x={15} y={15}>
              {pieSlices.map((slice) => {
                const isSelected = selectedSlice === slice.category;
                const push = isSelected ? 10 : 0;
                const tx = push * Math.cos(slice.midAngle);
                const ty = push * Math.sin(slice.midAngle);

                const labelX = center + radius * 0.58 * Math.cos(slice.midAngle) + tx;
                const labelY = center + radius * 0.58 * Math.sin(slice.midAngle) + ty;

                return (
                  <G key={slice.category} transform={`translate(${tx}, ${ty})`}>
                    <Path
                      d={slice.pathData}
                      fill={slice.color}
                      opacity={isSelected ? 1 : 0.85}
                      onPress={() => setSelectedSlice(slice.category)}
                    />
                    {slice.percentage >= 8 && (
                      <SvgText
                        x={labelX - tx}
                        y={labelY - ty}
                        fontSize={13}
                        fontWeight="bold"
                        fill="#fff"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        {slice.percentage}%
                      </SvgText>
                    )}
                  </G>
                );
              })}

              {/* center */}
              <Circle cx={center} cy={center} r={34} fill="#ffffff" />
              <SvgText
                x={center}
                y={center - 2}
                fontSize={12}
                fontWeight="700"
                fill="#334155"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {selectedData ? selectedData.category.replace("Category ", "Cat ") : "Tap"}
              </SvgText>
              <SvgText
                x={center}
                y={center + 14}
                fontSize={12}
                fontWeight="900"
                fill="#0f172a"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {selectedData ? `${selectedData.count}` : `${data.total_peppers}`}
              </SvgText>
            </G>
          </Svg>
        </View>

        <View style={styles.legendRow}>
          {categoryCounts.map((c) => {
            const active = selectedSlice === c.category;
            return (
              <TouchableOpacity
                key={c.category}
                style={[
                  styles.legendButton,
                  {
                    borderColor: gradeColors[c.category],
                    backgroundColor: active ? gradeColors[c.category] : "#fff",
                  },
                ]}
                onPress={() => setSelectedSlice(c.category)}
              >
                <Text
                  style={[
                    styles.legendButtonText,
                    { color: active ? "#fff" : gradeColors[c.category] },
                  ]}
                >
                  {c.category.split(" ")[1]}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.clearButton} onPress={() => setSelectedSlice(null)}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {selectedData && (
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedInfoTitle}>{selectedData.category}</Text>
            <Text style={styles.selectedInfoText}>
              Count: {selectedData.count} | Percentage: {selectedData.percentage}%
            </Text>
          </View>
        )}
      </View>

      {/* Summary */}
      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>Summary</Text>
        <Text style={styles.summaryText}>Total Scotch Bonnets: {data.total_peppers}</Text>
        {categoryCounts.map((c) => {
          let desc = "";
          if (c.category === "Category A") desc = "Very high-quality Scotch Bonnet. The color is consistently green, with no blemishes, drying, or deformed shapes.";
          else if (c.category === "Category B") desc = "Good-quality Scotch Bonnet. The color is a mix of green and yellow, with no blemishes, drying, or deformed shapes.";
          else if (c.category === "Category C") desc = "Peppers in this category are orange or red in color. Some may have slightly irregular shapes.";
          else if (c.category === "Category D") desc = "Peppers clearly show blemishes, drying, pest damage, and deformed shapes.";

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

      <TouchableOpacity style={styles.analysisButton} onPress={handleAnalysis}>
        <Text style={styles.analysisButtonText}>View Analysis</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 25, paddingBottom: 40, backgroundColor: "#ffffff" },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  emptyText: { fontSize: 18, fontWeight: "600" },

  title: { fontSize: 22, fontWeight: "bold", marginBottom: 15 },

  // Updated total/max cards
  cardsContainer: { flexDirection: "row", justifyContent: "space-between", marginBottom: 15, gap: 10 },
  infoCard: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    elevation: 5,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: "center",
    borderTopWidth: 3,
    borderTopColor: "#10b981",
  },
  maxCard: { borderTopColor: "#f59e0b" },
  cardIconContainer: { marginBottom: 8 },
  cardIcon: { fontSize: 30 },
  cardTitle: {
    fontWeight: "600",
    fontSize: 13,
    color: "#64748b",
    marginBottom: 6,
    textAlign: "center",
  },
  cardValue: { fontSize: 22, fontWeight: "900", color: "#1e293b", textAlign: "center" },
  cardSubtext: { fontSize: 11, color: "#94a3b8", textAlign: "center" },

  imageWrapper: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },

  descriptionBox: { backgroundColor: "#e5e7eb", padding: 10, borderRadius: 8, marginBottom: 16 },
  descriptionText: { fontSize: 14, color: "#1f2937" },

  binsContainer: {
    marginBottom: 20,
  },
  binBox: { 
    width: "100%", 
    padding: 14, 
    borderRadius: 10, 
    marginBottom: 12, 
    position: "relative",
  },
  maxBin: {
    borderWidth: 3,
    borderColor: "#facc15",
    shadowColor: "#facc15",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  maxBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#facc15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  maxBadgeText: { fontWeight: "900", fontSize: 12, color: "#1f2937" },
  binTitle: { fontWeight: "700", fontSize: 15, color: "#fff", flex: 1 },
  binNumbers: { color: "#fff", fontSize: 15, fontWeight: "600"},
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  binDescription: { fontSize: 11, color: "#f3f4f6", marginTop: 0, marginBottom: 8 },
  pepperList: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, gap: 5 },
  pepperNumber: {
    fontSize: 11,
    color: "#ffffff",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 32,
    textAlign: "center",
    borderRadius: 6,
    fontWeight: "700",
    overflow: "hidden",
  },

  pieCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 20, marginTop: 8, elevation: 4 },
  pieCardTitle: {

    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    color: "#065f46",
    marginBottom: 4,
  },
  pieHint: { textAlign: "center", color: "#64748b", fontSize: 12, marginBottom: 2 },

  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  legendButton: {
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  legendButtonText: { fontWeight: "700", fontSize: 13 },

  clearButton: {
    borderWidth: 1,
    borderColor: "#94a3b8",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f8fafc",
  },
  clearButtonText: { color: "#475569", fontWeight: "700", fontSize: 13 },

  selectedInfo: {
    marginTop: 12,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  selectedInfoTitle: { fontWeight: "800", color: "#0f172a", marginBottom: 3 },
  selectedInfoText: { color: "#334155", fontSize: 13 },

  summaryBox: { marginTop: 8, padding: 16, backgroundColor: "#e4edec", borderRadius: 12 },
  summaryTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 6, color: "#065f46" },
  summaryText: { fontSize: 15, fontWeight: "700", color: "#065f46" },
  summaryDescription: { fontSize: 13, color: "#065f46", marginLeft: 6, marginBottom: 4 },

  analysisButton: {
    backgroundColor: "#065f46",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 20,
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  analysisButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});