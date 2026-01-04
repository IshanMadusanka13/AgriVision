// app/quality/uploadquality.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Switch,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function UploadQuality() {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [useFirstOnly, setUseFirstOnly] = useState(true); // Toggle switch state

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Allow access to gallery.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
    });

    if (!result.canceled) {
      const selected = result.assets.map((a) => a.uri);
      setImages([...images, ...selected].slice(0, 4));
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Allow camera access.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setImages([...images, result.assets[0].uri].slice(0, 4));
    }
  };

  const removeImage = (index: number) => {
    const updated = [...images];
    updated.splice(index, 1);
    setImages(updated);
  };

  const next = () => {
    if (images.length < 1) {
      Alert.alert(
        "Insufficient Images",
        "Upload at least 1 Scotch Bonnet image for quality grading."
      );
      return;
    }

    const imagesToSend = useFirstOnly ? [images[0]] : images;

    router.push({
      pathname: "/quality/gradingquality",
      params: { images: JSON.stringify(imagesToSend) },
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Preview */}
      <View style={styles.previewContainer}>
        {images.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📸</Text>
            <Text style={styles.placeholderText}>
              Upload clear photos of Scotch Bonnet peppers
            </Text>
          </View>
        )}
      </View>

      {/* Toggle: Use first image only */}
      

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={pickFromCamera}>
          <Text style={styles.buttonIcon}>📷</Text>
          <Text style={styles.buttonText}>Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={pickFromGallery}>
          <Text style={styles.buttonIcon}>🖼️</Text>
          <Text style={styles.buttonText}>Gallery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.primaryButton,
            images.length === 0 && styles.disabledButton,
          ]}
          onPress={next}
          disabled={images.length === 0}
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            📊 Start Quality Grading
          </Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionTitle}>📋 Tips for Best Results:</Text>
        <Text style={styles.instructionText}>
          • Use clear, well-lit Scotch Bonnet images
        </Text>
        <Text style={styles.instructionText}>
          • Avoid blurry or shadowed photos
        </Text>
        <Text style={styles.instructionText}>
          • Include different angles if possible
        </Text>
        <Text style={styles.instructionText}>
          • Upload up to 4 images for better grading
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },

  previewContainer: {
    margin: 16,
    height: 240,
    borderRadius: 12,
    backgroundColor: "#fff",
    overflow: "hidden",
    elevation: 3,
  },

  imageWrapper: { width: 220, height: "100%", marginRight: 10 },
  image: { width: "100%", height: "100%", borderRadius: 12 },

  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#ef4444",
    borderRadius: 14,
    padding: 4,
  },

  placeholder: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  placeholderIcon: { fontSize: 64, marginBottom: 12 },
  placeholderText: { fontSize: 16, color: "#6b7280", textAlign: "center" },

  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 16,
  },
  toggleText: { fontSize: 16, fontWeight: "600", color: "#1f2937" },

  buttonContainer: { padding: 16, gap: 12 },
  button: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    elevation: 2,
  },
  primaryButton: { backgroundColor: "#10b981", borderColor: "#10b981" },
  disabledButton: { backgroundColor: "#9ca3af", borderColor: "#9ca3af" },
  buttonIcon: { fontSize: 22, marginRight: 8 },
  buttonText: { fontSize: 16, fontWeight: "600", color: "#374151" },
  primaryButtonText: { color: "#fff" },

  instructionsContainer: {
    backgroundColor: "#fff",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  instructionTitle: { fontSize: 16, fontWeight: "600", color: "#1f2937", marginBottom: 10 },
  instructionText: { fontSize: 14, color: "#6b7280", marginBottom: 6 },
});
