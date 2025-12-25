import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { predict_disease } from "@/services/api";

interface DiseaseResult {
  diagnosis?: string;
  confidence?: number;
  severity?: string;
  recommendations?: string[];
  annotatedImage?: string;
  [key: string]: any;
}

export default function DiseaseCameraScreen() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [diseaseResult, setDiseaseResult] = useState<DiseaseResult | null>(null);

  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Camera permission is required to take photos", [{ text: "OK" }]);
      return false;
    }
    return true;
  };

  const requestGalleryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Gallery permission is required to select photos", [{ text: "OK" }]);
      return false;
    }
    return true;
  };

  const takePhoto = async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images" as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
        setDiseaseResult(null);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo");
      console.error(error);
    }
  };

  const selectPhoto = async () => {
    const ok = await requestGalleryPermission();
    if (!ok) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images" as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
        setDiseaseResult(null);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select photo");
      console.error(error);
    }
  };

  const handleDetect = async () => {
    if (!selectedImage) {
      Alert.alert("No Image", "Please take or select a photo first");
      return;
    }
    setLoading(true);
    try {
      const result = await predict_disease(selectedImage);
      
      if (result?.annotatedImage) {
        // Navigate to results page with all data
        router.push({
          pathname: "/disease/disease-results",
          params: {
            annotatedImage: result.annotatedImage,
            diagnosis: result.diagnosis || "Unknown",
            confidence: result.confidence?.toString() || "0",
            severity: result.severity || "N/A",
            recommendations: JSON.stringify(result.recommendations || []),
          },
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || "Failed to analyze image";
      Alert.alert("Detection Failed", errorMessage, [{ text: "OK" }]);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.previewContainer}>
        {selectedImage ? (
          <>
            <Image source={{ uri: selectedImage }} style={styles.image} />
            {diseaseResult && (
              <View style={styles.resultOverlay}>
                <Text style={styles.resultText}>🩺 {diseaseResult.diagnosis ?? "No diagnosis"}</Text>
                {diseaseResult.severity && <Text style={styles.resultText}>Severity: {diseaseResult.severity}</Text>}
                {typeof diseaseResult.confidence !== "undefined" && (
                  <Text style={styles.resultText}>Confidence: {diseaseResult.confidence}%</Text>
                )}
              </View>
            )}
          </>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>🔬</Text>
            <Text style={styles.placeholderText}>Take or select a photo of affected plant area</Text>
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        {!selectedImage ? (
          <>
            <TouchableOpacity style={styles.button} onPress={takePhoto}>
              <Text style={styles.buttonIcon}>📷</Text>
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={selectPhoto}>
              <Text style={styles.buttonIcon}>🖼️</Text>
              <Text style={styles.buttonText}>Select from Gallery</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]} 
              onPress={handleDetect} 
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonIcon}>🔍</Text>
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>Analyze</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.button} 
              onPress={() => { 
                setSelectedImage(null); 
                setDiseaseResult(null); 
              }}
            >
              <Text style={styles.buttonIcon}>🔄</Text>
              <Text style={styles.buttonText}>Retake</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionTitle}>📋 Tips for Best Results:</Text>
        <Text style={styles.instructionText}>• Take a clear, focused photo</Text>
        <Text style={styles.instructionText}>• Use good natural lighting</Text>
        <Text style={styles.instructionText}>• Include affected area (leaves/stems)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  previewContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: { width: "100%", height: "100%", resizeMode: "contain" },
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  placeholderIcon: { fontSize: 64, marginBottom: 16 },
  placeholderText: { fontSize: 16, color: "#6b7280", textAlign: "center", lineHeight: 24 },
  resultOverlay: { 
    position: "absolute", 
    top: 16, 
    left: 16, 
    backgroundColor: "rgba(239,68,68,0.95)", 
    padding: 12, 
    borderRadius: 8 
  },
  resultText: { color: "#fff", fontSize: 14, fontWeight: "600", marginBottom: 4 },
  buttonContainer: { padding: 16, gap: 12 },
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
  primaryButton: { backgroundColor: "#ef4444", borderColor: "#ef4444" },
  buttonIcon: { fontSize: 24, marginRight: 8 },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#374151" },
  primaryButtonText: { color: "#fff" },
  instructionsContainer: { 
    backgroundColor: "#fff", 
    margin: 16, 
    padding: 16, 
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: "#e5e7eb" 
  },
  instructionTitle: { fontSize: 16, fontWeight: "600", color: "#1f2937", marginBottom: 12 },
  instructionText: { fontSize: 14, color: "#6b7280", marginBottom: 6 },
});