// app/camera.tsx
// Camera screen for taking or selecting plant photos

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { detectPlant, DetectionResult } from '@/services/api';

export default function CameraScreen() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);

  // Request camera permissions
  const requestCameraPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera permission is required to take photos',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  // Request gallery permissions
  const requestGalleryPermission = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Gallery permission is required to select photos',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  // Take photo with camera
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
        setDetectionResult(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.error(error);
    }
  };

  // Select photo from gallery
  const selectPhoto = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
        setDetectionResult(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select photo');
      console.error(error);
    }
  };

  // Detect plant from selected image
  const handleDetect = async () => {
    if (!selectedImage) {
      Alert.alert('No Image', 'Please take or select a photo first');
      return;
    }

    setLoading(true);
    try {
      const result = await detectPlant(selectedImage);
      setDetectionResult(result);

      Alert.alert(
        'Detection Complete',
        `Growth Stage: ${result.growth_stage}\nLeaves: ${result.leaves_count}\nFlowers: ${result.flowers_count}\nFruits: ${result.fruits_count}`,
        [
          {
            text: 'Next: NPK Input',
            onPress: () =>
              router.push({
                pathname: '/growth/npk-input',
                params: {
                  imageUri: selectedImage,
                  growth_stage: result.growth_stage,
                  confidence: result.confidence.toString(),
                  leaves_count: result.leaves_count.toString(),
                  flowers_count: result.flowers_count.toString(),
                  fruits_count: result.fruits_count.toString(),
                },
              }),
          },
          { text: 'Retake', onPress: () => setSelectedImage(null) },
        ]
      );
    } catch (error) {
      Alert.alert(
        'Detection Failed',
        'Failed to detect plant. Make sure backend is running.',
        [{ text: 'OK' }]
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Image Preview */}
      <View style={styles.previewContainer}>
        {selectedImage ? (
          <>
            <Image source={{ uri: selectedImage }} style={styles.image} />
            {detectionResult && (
              <View style={styles.resultOverlay}>
                <Text style={styles.resultText}>
                  🌱 Growth: {detectionResult.growth_stage}
                </Text>
                <Text style={styles.resultText}>
                  🍃 Leaves: {detectionResult.leaves_count}
                </Text>
                <Text style={styles.resultText}>
                  🌸 Flowers: {detectionResult.flowers_count}
                </Text>
                <Text style={styles.resultText}>
                  🌶️ Fruits: {detectionResult.fruits_count}
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📸</Text>
            <Text style={styles.placeholderText}>
              Take or select a photo of your Scotch Bonnet plant
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
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
                  <Text style={[styles.buttonText, styles.primaryButtonText]}>
                    Detect Plant
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setSelectedImage(null);
                setDetectionResult(null);
              }}
            >
              <Text style={styles.buttonIcon}>🔄</Text>
              <Text style={styles.buttonText}>Retake</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionTitle}>📋 Tips for Best Results:</Text>
        <Text style={styles.instructionText}>• Clear, focused photo</Text>
        <Text style={styles.instructionText}>• Good lighting (natural light best)</Text>
        <Text style={styles.instructionText}>• Include leaves, flowers, and/or fruits</Text>
        <Text style={styles.instructionText}>• Avoid shadows and glare</Text>
        <Text style={styles.instructionText}>• Keep camera steady</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  previewContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  placeholderIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  resultOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    padding: 12,
    borderRadius: 8,
  },
  resultText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  buttonContainer: {
    padding: 16,
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  primaryButton: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  buttonIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  primaryButtonText: {
    color: '#fff',
  },
  instructionsContainer: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
  },
});
