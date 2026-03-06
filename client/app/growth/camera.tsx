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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { detectPlant, DetectionResult } from '@/services/api';
import { getPlant, savePlant } from '@/utils/plantRegistry';

export default function CameraScreen() {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);

  // Plant age modal state
  const [ageModalVisible, setAgeModalVisible] = useState(false);
  const [pendingResult, setPendingResult] = useState<DetectionResult | null>(null);
  const [startDate, setStartDate] = useState(new Date());
  const [savingAge, setSavingAge] = useState(false);

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

  const navigateToEnvironmental = (result: DetectionResult) => {
    router.push({
      pathname: '/growth/environmental-input',
      params: {
        imageUri: selectedImage!,
        growth_stage: result.growth_stage,
        confidence: result.confidence.toString(),
        leaves_count: result.leaves_count.toString(),
        flowers_count: result.flowers_count.toString(),
        fruits_count: result.fruits_count.toString(),
        plant_height_cm: result.plant_height_cm?.toString() || '',
        plant_id: result.plant_id?.toString() || '',
      },
    });
  };

  const handleDetect = async () => {
    if (!selectedImage) {
      Alert.alert('No Image', 'Please take or select a photo first');
      return;
    }

    setLoading(true);
    try {
      const result = await detectPlant(selectedImage);
      setDetectionResult(result);

      if (result.growth_stage === 'Not a Scotch Bonnet plant') {
        Alert.alert('Detection Complete', 'Not a Scotch Bonnet plant detected.', [
          { text: 'Retake', onPress: () => setSelectedImage(null) },
        ]);
        return;
      }

      // Check if this plant already has a start date
      if (result.plant_id != null) {
        const existing = await getPlant(result.plant_id);
        if (!existing) {
          // New plant — ask for start date
          setPendingResult(result);
          setStartDate(new Date());
          setAgeModalVisible(true);
          return;
        }
      }

      // Plant already has start date (or no marker detected) — proceed directly
      Alert.alert(
        'Detection Complete',
        `Growth Stage: ${result.growth_stage}\nPlant ID: #${result.plant_id ?? '—'}`,
        [{ text: 'Next: Environmental Data', onPress: () => navigateToEnvironmental(result) }]
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

  const toDateString = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const handleDateChange = (_: DateTimePickerEvent, selected?: Date) => {
    if (selected) setStartDate(selected);
  };

  const handleSaveAge = async () => {
    if (!pendingResult) return;
    setSavingAge(true);
    try {
      if (pendingResult.plant_id != null) {
        await savePlant({ id: pendingResult.plant_id, startDate: toDateString(startDate) });
      }
    } catch (e) {
      console.error('Failed to save plant start date', e);
    } finally {
      setSavingAge(false);
      setAgeModalVisible(false);
      navigateToEnvironmental(pendingResult);
    }
  };

  const handleSkipAge = () => {
    if (!pendingResult) return;
    setAgeModalVisible(false);
    navigateToEnvironmental(pendingResult);
  };

  return (
    <View style={styles.container}>
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

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionTitle}>📋 Tips for Best Results:</Text>
        <Text style={styles.instructionText}>• Clear, focused photo</Text>
        <Text style={styles.instructionText}>• Good lighting (natural light best)</Text>
        <Text style={styles.instructionText}>• Include leaves, flowers, and/or fruits</Text>
        <Text style={styles.instructionText}>• Avoid shadows and glare</Text>
        <Text style={styles.instructionText}>• Keep camera steady</Text>
      </View>

      {/* Plant Age Bottom Sheet — rendered in main tree so DateTimePicker works on Android */}
      {ageModalVisible && (
        <>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleSkipAge} />
          <View style={styles.modalCard}>
            <Text style={styles.modalEmoji}>🌱</Text>
            <Text style={styles.modalTitle}>New Plant Detected!</Text>
            <Text style={styles.modalSubtitle}>
              Plant ID - {pendingResult?.plant_id} has no start date yet.{'\n'}
              When did you plant this?
            </Text>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Start Date</Text>
              <DateTimePicker
                value={startDate}
                mode="date"
                display="spinner"
                themeVariant="light"
                maximumDate={new Date()}
                onChange={handleDateChange}
                style={styles.datePicker}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.skipBtn} onPress={handleSkipAge}>
                <Text style={styles.skipBtnText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveAge}
                disabled={savingAge}
              >
                {savingAge
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>Save & Continue</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
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

  // Plant age bottom sheet
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 28,
    paddingBottom: 40,
    alignItems: 'center',
  },
  modalEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  dateButton: {
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#f9fafb',
  },
  dateButtonText: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '500',
  },
  datePicker: {
    width: '100%',
    height: 180,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  skipBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
