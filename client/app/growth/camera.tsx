import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Accelerometer } from 'expo-sensors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { detectPlant, checkMarker, DetectionResult } from '@/services/api';
import { getPlant, savePlant } from '@/utils/plantRegistry';

// Tolerances (accelerometer units ≈ 0.15 → ~8.6°)
const TILT_X_TOLERANCE = 0.15;  // left-right roll
const TILT_Z_TOLERANCE = 0.20;  // forward-backward lean
const UPRIGHT_MIN      = 0.75;  // |y| > this → phone held upright (not flat)


export default function CameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('userEmail').then(email => setUserEmail(email));
  }, []);

  // Marker pre-check states
  type MarkerState = 'idle' | 'checking' | 'ok' | 'bad_angle' | 'not_found';
  const [markerState, setMarkerState] = useState<MarkerState>('idle');
  const [markerMsg, setMarkerMsg] = useState<string>('');

  // Accelerometer: all 3 axes
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(-1); // -1 = phone upright default
  const [tiltZ, setTiltZ] = useState(0);

  const isLevelX  = Math.abs(tiltX) < TILT_X_TOLERANCE;
  const isUpright = Math.abs(tiltY) > UPRIGHT_MIN;   // |y|≈1 = upright, |y|≈0 = flat
  const isLevelZ  = Math.abs(tiltZ) < TILT_Z_TOLERANCE;
  const isAngleOk = isLevelX && isUpright && isLevelZ;

  // Plant age modal state
  const [ageModalVisible, setAgeModalVisible] = useState(false);
  const [pendingResult, setPendingResult]     = useState<DetectionResult | null>(null);
  const [startDate, setStartDate]             = useState(new Date());
  const [savingAge, setSavingAge]             = useState(false);

  // ── Accelerometer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedImage) return; // stop sensor when previewing captured photo

    Accelerometer.setUpdateInterval(120);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      setTiltX(x);
      setTiltY(y);
      setTiltZ(z);
    });
    return () => sub.remove();
  }, [selectedImage]);

  // ── Gallery picker ─────────────────────────────────────────────────────────
  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets.length > 0) {
      setSelectedImage(result.assets[0].uri);
      setDetectionResult(null);
      setMarkerState('idle');
      setMarkerMsg('');
    }
  };

  // ── Capture ────────────────────────────────────────────────────────────────
  const capturePhoto = async () => {
    if (!cameraRef.current || !isAngleOk) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo) {
        setSelectedImage(photo.uri);
        setDetectionResult(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // ── Marker pre-check ───────────────────────────────────────────────────────
  const handleCheckMarker = async () => {
    if (!selectedImage) return;
    setMarkerState('checking');
    setMarkerMsg('');
    try {
      const check = await checkMarker(selectedImage);
      if (!check.detected) {
        setMarkerState('not_found');
        setMarkerMsg(check.message);
      } else if (!check.angle_ok) {
        setMarkerState('bad_angle');
        setMarkerMsg(check.message);
      } else {
        setMarkerState('ok');
        setMarkerMsg(check.message);
      }
    } catch {
      // If backend unreachable, allow proceeding without the check
      setMarkerState('ok');
      setMarkerMsg('');
    }
  };

  // ── Detect ─────────────────────────────────────────────────────────────────
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
    if (!selectedImage) return;
    setLoading(true);
    try {
      const result = await detectPlant(selectedImage, userEmail);
      setDetectionResult(result);

      if (result.growth_stage === 'Not a Scotch Bonnet plant') {
        Alert.alert('Detection Complete', 'Not a Scotch Bonnet plant detected.', [
          { text: 'Retake', onPress: () => setSelectedImage(null) },
        ]);
        return;
      }

      if (result.plant_id != null) {
        const existing = await getPlant(result.plant_id);
        if (!existing) {
          setPendingResult(result);
          setStartDate(new Date());
          setAgeModalVisible(true);
          return;
        }
      }

      navigateToEnvironmental(result);
    } catch {
      Alert.alert('Detection Failed', 'Failed to detect plant. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // ── Age modal ──────────────────────────────────────────────────────────────
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

  // ── Angle UI helpers ───────────────────────────────────────────────────────
  // Bubble offset in the spirit-level circle (clamped to ±28px)
  // Bubble moves left-right (tiltX) and up-down (tiltZ)
  const bubbleX = Math.max(-28, Math.min(28, tiltX * 140));
  const bubbleY = Math.max(-28, Math.min(28, tiltZ * 100));

  const angleColor = isAngleOk ? '#10b981' : '#ef4444';
  const angleLabel = isAngleOk
    ? '✓  Parallel to marker — tap to capture'
    : !isUpright
      ? '📱  Hold phone upright (not flat)'
      : !isLevelX && !isLevelZ
        ? '↕◀  Adjust left-right tilt and lean'
        : !isLevelX
          ? (tiltX > 0 ? '◀  Tilt phone left' : '▶  Tilt phone right')
          : (tiltZ > 0 ? '↓  Lean phone forward' : '↑  Lean phone back');

  // Tilt bar: indicator moves left/right based on tiltX
  const tiltBarPos = Math.max(4, Math.min(96, 50 + tiltX * 40));

  // ── Permission guard ───────────────────────────────────────────────────────
  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permIcon}>📷</Text>
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permDesc}>
          Allow camera access to photograph your plant and measure its height accurately.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {!selectedImage ? (
        /* ── Live camera + angle guide ─────────────────────────────────── */
        <View style={styles.cameraWrapper}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back">

            {/* Corner guide lines (rule-of-thirds feel) */}
            <View style={styles.cornerTL} />
            <View style={styles.cornerTR} />
            <View style={styles.cornerBL} />
            <View style={styles.cornerBR} />

            {/* Center crosshair */}
            <View pointerEvents="none" style={styles.crosshairContainer}>
              <View style={[styles.crosshairH, { borderColor: angleColor }]} />
              <View style={[styles.crosshairV, { borderColor: angleColor }]} />
            </View>

            {/* Spirit-level bubble */}
            <View style={styles.levelContainer}>
              <View style={[styles.levelRing, { borderColor: angleColor }]}>
                <View style={styles.levelCenter} />
                <View style={[
                  styles.bubble,
                  { transform: [{ translateX: bubbleX }, { translateY: bubbleY }] },
                  { backgroundColor: angleColor },
                ]} />
              </View>
              <Text style={[styles.levelLabel, { color: angleColor }]}>Level</Text>
            </View>

            {/* Horizontal tilt bar at bottom of camera */}
            <View style={styles.tiltBarWrapper}>
              <View style={styles.tiltBarTrack}>
                <View style={styles.tiltBarCenter} />
                <View style={[
                  styles.tiltBarDot,
                  { left: `${tiltBarPos}%` as any, backgroundColor: angleColor },
                ]} />
              </View>
            </View>

            {/* ArUco marker target box */}
            <View style={styles.markerGuideWrapper}>
              <View style={styles.markerGuideBox}>
                {/* Corner accents */}
                <View style={[styles.mgCorner, styles.mgCornerTL]} />
                <View style={[styles.mgCorner, styles.mgCornerTR]} />
                <View style={[styles.mgCorner, styles.mgCornerBL]} />
                <View style={[styles.mgCorner, styles.mgCornerBR]} />
                {/* Centre label */}
                <Text style={styles.markerGuideLabel}>ArUco Marker</Text>
              </View>
              <Text style={styles.markerGuideHint}>Place marker here</Text>
            </View>

            {/* Status badge */}
            <View style={[styles.statusBadge, { backgroundColor: angleColor + 'DD' }]}>
              <Text style={styles.statusText}>{angleLabel}</Text>
            </View>

          </CameraView>

          {/* Capture button row */}
          <View style={styles.captureRow}>
            <TouchableOpacity style={styles.galleryBtn} onPress={pickFromGallery}>
              <Text style={styles.galleryBtnIcon}>🖼️</Text>
              <Text style={styles.galleryBtnText}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.captureBtn, !isAngleOk && styles.captureBtnDisabled]}
              onPress={capturePhoto}
              activeOpacity={isAngleOk ? 0.7 : 1}
            >
              <View style={[styles.captureInner, !isAngleOk && styles.captureInnerDisabled]} />
            </TouchableOpacity>

            <View style={styles.galleryPlaceholder} />
          </View>
          {!isAngleOk && (
            <Text style={styles.captureHint}>Adjust angle to unlock camera</Text>
          )}

          {/* Tips */}
          <View style={styles.tipsRow}>
            <Text style={styles.tipItem}>📏 Include the height marker</Text>
            <Text style={styles.tipItem}>☀️ Good lighting</Text>
            <Text style={styles.tipItem}>📐 Keep camera level</Text>
          </View>
        </View>
      ) : (
        /* ── Captured photo preview ─────────────────────────────────────── */
        <View style={styles.previewWrapper}>
          <View style={styles.previewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.image} resizeMode="contain" />
            {detectionResult && (
              <View style={styles.resultOverlay}>
                <Text style={styles.resultText}>🌱 Plant ID: #{detectionResult.plant_id ?? '—'}</Text>
              </View>
            )}
          </View>

          {/* Marker check status banner */}
          {markerState !== 'idle' && (
            <View style={[
              styles.markerBanner,
              markerState === 'ok'        ? styles.markerBannerOk    :
              markerState === 'checking'  ? styles.markerBannerWait  :
                                            styles.markerBannerBad,
            ]}>
              <Text style={styles.markerBannerText}>
                {markerState === 'checking' ? '🔎  Checking marker angle…' :
                 markerState === 'ok'       ? `✓  ${markerMsg}` :
                 markerState === 'not_found'? `⚠  ${markerMsg}` :
                                             `↩  ${markerMsg}`}
              </Text>
            </View>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => {
                setSelectedImage(null);
                setDetectionResult(null);
                setMarkerState('idle');
                setMarkerMsg('');
              }}
            >
              <Text style={styles.retakeBtnIcon}>🔄</Text>
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>

            {/* Step 1: check marker — Step 2: full detect */}
            {markerState !== 'ok' ? (
              <TouchableOpacity
                style={[styles.detectBtn, markerState === 'checking' && styles.detectBtnDisabled]}
                onPress={handleCheckMarker}
                disabled={markerState === 'checking'}
              >
                {markerState === 'checking'
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Text style={styles.detectBtnIcon}>📐</Text>
                      <Text style={styles.detectBtnText}>
                        {markerState === 'idle' ? 'Check Marker' : 'Retry Check'}
                      </Text>
                    </>
                }
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.detectBtn, loading && styles.detectBtnDisabled]}
                onPress={handleDetect}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Text style={styles.detectBtnIcon}>🔍</Text>
                      <Text style={styles.detectBtnText}>Detect Plant</Text>
                    </>
                }
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── Plant Age Bottom Sheet ───────────────────────────────────────────── */}
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
    backgroundColor: '#000',
  },

  // ── Permission screen ──────────────────────────────────────────────────────
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f9fafb',
  },
  permIcon:  { fontSize: 56, marginBottom: 16 },
  permTitle: { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 8 },
  permDesc:  { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  permBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // ── Live camera ────────────────────────────────────────────────────────────
  cameraWrapper: { flex: 1 },
  camera:        { flex: 1 },

  // Corner brackets
  cornerTL: {
    position: 'absolute', top: 24, left: 24,
    width: 36, height: 36,
    borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#fff',
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    position: 'absolute', top: 24, right: 24,
    width: 36, height: 36,
    borderTopWidth: 3, borderRightWidth: 3, borderColor: '#fff',
    borderTopRightRadius: 4,
  },
  cornerBL: {
    position: 'absolute', bottom: 160, left: 24,
    width: 36, height: 36,
    borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    position: 'absolute', bottom: 160, right: 24,
    width: 36, height: 36,
    borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#fff',
    borderBottomRightRadius: 4,
  },

  // Centre crosshair
  crosshairContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crosshairH: {
    position: 'absolute',
    width: 48, height: 0,
    borderBottomWidth: 1.5, borderStyle: 'dashed',
  },
  crosshairV: {
    position: 'absolute',
    width: 0, height: 48,
    borderRightWidth: 1.5, borderStyle: 'dashed',
  },

  // Spirit-level bubble (top-right corner)
  levelContainer: {
    position: 'absolute',
    top: 20, right: 20,
    alignItems: 'center',
  },
  levelRing: {
    width: 64, height: 64,
    borderRadius: 32,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelCenter: {
    position: 'absolute',
    width: 6, height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  bubble: {
    width: 16, height: 16,
    borderRadius: 8,
    opacity: 0.9,
  },
  levelLabel: {
    marginTop: 4, fontSize: 10, fontWeight: '600',
    textShadowColor: '#000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  // Horizontal tilt bar
  tiltBarWrapper: {
    position: 'absolute',
    bottom: 152,
    left: 32, right: 32,
  },
  tiltBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    justifyContent: 'center',
  },
  tiltBarCenter: {
    position: 'absolute',
    alignSelf: 'center',
    width: 2, height: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 1,
  },
  tiltBarDot: {
    position: 'absolute',
    width: 14, height: 14,
    borderRadius: 7,
    top: -4,
    marginLeft: -7,
  },

  // Status badge
  statusBadge: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Capture button row
  captureRow: {
    position: 'absolute',
    bottom: 48,
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 32,
  },
  captureBtn: {
    width: 76, height: 76,
    borderRadius: 38,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  captureBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  captureInner: {
    width: 58, height: 58,
    borderRadius: 29,
    backgroundColor: '#10b981',
  },
  captureInnerDisabled: {
    backgroundColor: 'rgba(150,150,150,0.6)',
  },
  captureHint: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  galleryBtn: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryBtnIcon: {
    fontSize: 28,
  },
  galleryBtnText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  galleryPlaceholder: {
    width: 64,
  },

  // Tips row
  tipsRow: {
    position: 'absolute',
    top: 0,
    left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  tipItem: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '500',
  },

  // ── Photo preview ──────────────────────────────────────────────────────────
  previewWrapper: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  previewContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    backgroundColor: '#000',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  resultOverlay: {
    position: 'absolute',
    top: 16, left: 16,
    backgroundColor: 'rgba(16,185,129,0.92)',
    padding: 12, borderRadius: 10,
  },
  resultText: { color: '#fff', fontSize: 13, fontWeight: '600', marginBottom: 3 },

  actionRow: {
    flexDirection: 'row',
    margin: 16,
    gap: 12,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    gap: 8,
    elevation: 2,
  },
  retakeBtnIcon: { fontSize: 18 },
  retakeBtnText: { fontSize: 15, fontWeight: '600', color: '#374151' },

  detectBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 15,
    borderRadius: 14,
    gap: 8,
    elevation: 3,
  },
  detectBtnDisabled: { opacity: 0.65 },
  detectBtnIcon:     { fontSize: 18 },
  detectBtnText:     { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Marker check banner
  markerBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  markerBannerOk:   { backgroundColor: '#d1fae5' },
  markerBannerWait: { backgroundColor: '#e0f2fe' },
  markerBannerBad:  { backgroundColor: '#fee2e2' },
  markerBannerText: { fontSize: 13, fontWeight: '600', color: '#1f2937' },

  // ── Age bottom sheet ───────────────────────────────────────────────────────
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 28, paddingBottom: 40,
    alignItems: 'center',
  },
  modalEmoji:    { fontSize: 48, marginBottom: 8 },
  modalTitle:    { fontSize: 20, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  modalSubtitle: {
    fontSize: 14, color: '#6b7280',
    textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  inputWrapper:  { width: '100%', marginBottom: 24 },
  inputLabel:    { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  datePicker:    { width: '100%', height: 180 },
  modalActions:  { flexDirection: 'row', gap: 12, width: '100%' },
  skipBtn: {
    flex: 1, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#d1d5db', alignItems: 'center',
  },
  skipBtnText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  saveBtn: {
    flex: 2, paddingVertical: 14,
    borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ArUco marker guide box
  markerGuideWrapper: {
    position: 'absolute',
    bottom: 170,
    alignSelf: 'center',
    alignItems: 'center',
  },
  markerGuideBox: {
    width: 100,
    height: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    borderStyle: 'dashed',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  mgCorner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: '#10b981',
    borderWidth: 2.5,
  },
  mgCornerTL: { top: -1, left: -1, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  mgCornerTR: { top: -1, right: -1, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  mgCornerBL: { bottom: -1, left: -1, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  mgCornerBR: { bottom: -1, right: -1, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  markerGuideLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  markerGuideHint: {
    marginTop: 5,
    color: '#10b981',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
