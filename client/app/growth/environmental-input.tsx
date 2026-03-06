import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFullAnalysis, getCurrentWeather, type WeatherData, type Location as LocationType } from '@/services/api';
import { getPlant, calcAgeFull } from '@/utils/plantRegistry';

const STAGES = ['Early Vegetative', 'Vegetative', 'Flowering', 'Fruiting', 'Ripening'];
const STAGE_META: Record<string, { emoji: string; color: string; bg: string }> = {
  'Early Vegetative': { emoji: '🌱', color: '#10b981', bg: '#f0fdf4' },
  'Vegetative':       { emoji: '🌿', color: '#059669', bg: '#ecfdf5' },
  'Flowering':        { emoji: '🌸', color: '#f59e0b', bg: '#fffbeb' },
  'Fruiting':         { emoji: '🌶️', color: '#f97316', bg: '#fff7ed' },
  'Ripening':         { emoji: '🔥', color: '#dc2626', bg: '#fef2f2' },
};

export default function EnvironmentalInputScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const imageUri = params.imageUri as string;
  const detection = {
    growth_stage: params.growth_stage as string,
    confidence: parseFloat(params.confidence as string),
    leaves_count: parseInt(params.leaves_count as string),
    flowers_count: parseInt(params.flowers_count as string),
    fruits_count: parseInt(params.fruits_count as string),
    plant_height_cm: params.plant_height_cm ? parseFloat(params.plant_height_cm as string) : null,
    plant_id: params.plant_id ? parseInt(params.plant_id as string) : null,
  };

  const [ph, setPh] = useState('6.5');
  const [weather, setWeather] = useState('sunny');
  const [temperature, setTemperature] = useState('28');
  const [loading, setLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [detectedWeather, setDetectedWeather] = useState<WeatherData | null>(null);
  const [userLocation, setUserLocation] = useState<LocationType | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [plantAge, setPlantAge] = useState<string | null>(null);

  const stageKey = STAGES.find(s => detection.growth_stage?.toLowerCase().includes(s.toLowerCase())) || '';
  const meta = STAGE_META[stageKey] || { emoji: '🌱', color: '#10b981', bg: '#f0fdf4' };
  const stageIndex = STAGES.indexOf(stageKey);
  const heightPct = detection.plant_height_cm ? Math.min((detection.plant_height_cm / 90) * 100, 100) : 0;

  useEffect(() => {
    handleAutoDetectWeather();
    if (detection.plant_id) {
      getPlant(detection.plant_id).then(p => {
        if (p) setPlantAge(calcAgeFull(p.startDate));
      });
    }
  }, []);

  const getWeatherIcon = (condition: string) => {
    switch (condition) {
      case 'sunny': return '☀️';
      case 'rainy': return '🌧️';
      case 'cloudy': return '☁️';
      default: return '🌤️';
    }
  };

  const handleAutoDetectWeather = async () => {
    setWeatherLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Permission Required', 'Please allow location permission to enable weather auto-detection.', [{ text: 'OK' }]);
        setWeatherLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const userLoc: LocationType = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setUserLocation(userLoc);
      const weatherData = await getCurrentWeather(userLoc);
      if (weatherData) {
        setDetectedWeather({ ...weatherData });
        setWeather(weatherData.condition);
        setTemperature(weatherData.temperature.toString());
        setAutoDetected(true);
      } else {
        Alert.alert('Weather Detection Failed', 'Unable to auto-detect weather. Please enter values manually.', [{ text: 'OK' }]);
      }
    } catch (error) {
      console.error('Weather detection error:', error);
      Alert.alert('Weather Detection Error', 'Unable to fetch weather data. Please check your internet connection.', [{ text: 'OK' }]);
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!ph) { Alert.alert('Input Required', 'Please enter soil pH value'); return; }
    const phValue = parseFloat(ph);
    if (isNaN(phValue)) { Alert.alert('Invalid Input', 'Please enter a valid pH number'); return; }
    if (phValue < 0 || phValue > 14) { Alert.alert('Invalid pH', 'pH value must be between 0-14'); return; }

    setLoading(true);
    try {
      const userEmail = await AsyncStorage.getItem('userEmail');
      const locationName = detectedWeather?.location || null;
      const result = await getFullAnalysis(
        imageUri, userLocation, autoDetected ? null : weather,
        temperature ? parseFloat(temperature) : null,
        phValue, detectedWeather?.humidity || null, userEmail, locationName
      );
      // Pass plant_id from original camera detection as fallback
      // (full_analysis re-runs detection and may not return plant_id)
      router.push({
        pathname: '/growth/result',
        params: {
          resultData: JSON.stringify(result),
          camera_plant_id: detection.plant_id?.toString() || '',
          camera_plant_height: detection.plant_height_cm?.toString() || '',
        },
      });
    } catch (error) {
      Alert.alert('Analysis Failed', 'Unable to fetch recommendations. Please check your internet connection.', [{ text: 'OK' }]);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

      {/* ── Plant Hero Card ── */}
      <View style={[styles.heroCard, { borderTopColor: meta.color }]}>
        {/* ID + Age row */}
        <View style={styles.heroTopRow}>
          <View style={[styles.idPill, { backgroundColor: meta.color }]}>
            <Text style={styles.idPillText}>{meta.emoji}  Plant #{detection.plant_id ?? '—'}</Text>
          </View>
          {plantAge && (
            <View style={styles.agePill}>
              <Text style={styles.agePillText}>🗓️  {plantAge}</Text>
            </View>
          )}
        </View>

        {/* Stage row */}
        <View style={styles.stageRow}>
          <View style={[styles.stageIconBox, { backgroundColor: meta.bg }]}>
            <Text style={styles.stageIconText}>{meta.emoji}</Text>
          </View>
          <View style={styles.stageInfo}>
            <Text style={[styles.stageName, { color: meta.color }]}>{detection.growth_stage}</Text>
            <Text style={styles.stageConf}>{Math.round(detection.confidence * 100)}% confidence</Text>
            <View style={styles.stageDots}>
              {STAGES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      width: i === stageIndex ? 18 : 8,
                      backgroundColor: i <= stageIndex ? meta.color : '#e5e7eb',
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Height bar */}
        {detection.plant_height_cm != null && (
          <View style={styles.heightSection}>
            <View style={styles.heightLabelRow}>
              <Text style={styles.heightLabel}>📏  Plant Height</Text>
              <Text style={[styles.heightValue, { color: meta.color }]}>
                {Math.floor(detection.plant_height_cm)} cm
              </Text>
            </View>
            <View style={styles.heightBarBg}>
              <View style={[styles.heightBarFill, { width: `${heightPct}%`, backgroundColor: meta.color }]} />
            </View>
            <View style={styles.heightScaleRow}>
              <Text style={styles.heightScaleText}>0 cm</Text>
              <Text style={styles.heightScaleText}>30 cm</Text>
              <Text style={styles.heightScaleText}>60 cm</Text>
              <Text style={styles.heightScaleText}>90 cm</Text>
            </View>
          </View>
        )}

        {/* Count chips */}
        <View style={styles.countsRow}>
          <View style={[styles.countChip, { backgroundColor: '#f0fdf4', borderColor: '#10b981' }]}>
            <Text style={styles.countEmoji}>🍃</Text>
            <Text style={styles.countNum}>{detection.leaves_count}</Text>
            <Text style={styles.countLbl}>Approx. Leaves</Text>
          </View>
          <View style={[styles.countChip, { backgroundColor: '#fdf4ff', borderColor: '#d946ef' }]}>
            <Text style={styles.countEmoji}>🌸</Text>
            <Text style={styles.countNum}>{detection.flowers_count}</Text>
            <Text style={styles.countLbl}>Approx. Flowers</Text>
          </View>
          <View style={[styles.countChip, { backgroundColor: '#fff7ed', borderColor: '#f97316' }]}>
            <Text style={styles.countEmoji}>🌶️</Text>
            <Text style={styles.countNum}>{detection.fruits_count}</Text>
            <Text style={styles.countLbl}>Approx. Fruits</Text>
          </View>
        </View>
      </View>

      {/* ── Soil Parameters ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🌱  Soil Parameters</Text>
        <Text style={styles.sectionDesc}>Enter soil pH to get personalized fertilizer recommendations</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Soil pH</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={ph}
              onChangeText={setPh}
              keyboardType="numeric"
              placeholder="6.5"
            />
            <View style={styles.unitBadge}>
              <Text style={styles.unitText}>pH</Text>
            </View>
          </View>
          <Text style={styles.hint}>Optimal for Scotch Bonnet: 6.0 – 6.8</Text>
        </View>
      </View>

      {/* ── Weather ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>🌤️  Weather</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={handleAutoDetectWeather} disabled={weatherLoading}>
            {weatherLoading
              ? <ActivityIndicator size="small" color="#10b981" />
              : <Text style={styles.refreshBtnText}>📍 {autoDetected ? 'Refresh' : 'Auto-Detect'}</Text>}
          </TouchableOpacity>
        </View>

        {weatherLoading && !detectedWeather && (
          <View style={styles.weatherLoadingCard}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.weatherLoadingText}>Detecting weather...</Text>
            <Text style={styles.weatherLoadingSubtext}>Getting your location</Text>
          </View>
        )}

        {!weatherLoading && detectedWeather && (
          <View style={styles.weatherCard}>
            <View style={styles.weatherTop}>
              <View style={styles.locationRow}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={styles.locationText}>{detectedWeather.location}</Text>
              </View>
              <View style={detectedWeather.description.includes('Demo Mode') ? styles.demoBadge : styles.liveBadge}>
                <Text style={styles.badgeText}>
                  {detectedWeather.description.includes('Demo Mode') ? 'Demo' : '✓ Live'}
                </Text>
              </View>
            </View>
            <View style={styles.weatherMain}>
              <View style={styles.weatherIconBox}>
                <Text style={styles.weatherIconBig}>{getWeatherIcon(detectedWeather.condition)}</Text>
              </View>
              <View>
                <Text style={styles.tempBig}>{detectedWeather.temperature}°C</Text>
                <Text style={styles.weatherDesc}>
                  {detectedWeather.description.replace(' (Demo Mode)', '')}
                </Text>
              </View>
            </View>
            <View style={styles.weatherStats}>
              <View style={styles.weatherStat}>
                <Text style={styles.weatherStatIcon}>💧</Text>
                <Text style={styles.weatherStatLabel}>Humidity</Text>
                <Text style={styles.weatherStatValue}>{detectedWeather.humidity}%</Text>
              </View>
              <View style={styles.weatherStatDivider} />
              <View style={styles.weatherStat}>
                <Text style={styles.weatherStatIcon}>🌡️</Text>
                <Text style={styles.weatherStatLabel}>Condition</Text>
                <Text style={styles.weatherStatValue}>
                  {detectedWeather.condition.charAt(0).toUpperCase() + detectedWeather.condition.slice(1)}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Temperature</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={temperature}
              onChangeText={v => { setTemperature(v); setAutoDetected(false); }}
              keyboardType="numeric"
              placeholder="28"
            />
            <View style={styles.unitBadge}>
              <Text style={styles.unitText}>°C</Text>
            </View>
          </View>
          <Text style={styles.hint}>
            {autoDetected ? '✅ Auto-detected — edit to override' : 'Current temperature'}
          </Text>
        </View>
      </View>

      {/* ── Submit ── */}
      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitBtnText}>📅  Get Fertilizer Plan</Text>}
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡  Tips</Text>
        <Text style={styles.infoText}>• Recommendations are tailored to your plant's growth stage & environment</Text>
        <Text style={styles.infoText}>• Use 📍 auto-detect for accurate real-time humidity</Text>
        <Text style={styles.infoText}>• Optimal pH for Scotch Bonnet: 6.0 – 6.8</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  scrollContent: { paddingBottom: 40 },

  // ── Hero card ──
  heroCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 20,
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  idPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  idPillText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  agePill: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  agePillText: { color: '#374151', fontWeight: '600', fontSize: 13 },

  // Stage
  stageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stageIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stageIconText: { fontSize: 30 },
  stageInfo: { flex: 1 },
  stageName: { fontSize: 17, fontWeight: '700', marginBottom: 3 },
  stageConf: { fontSize: 12, color: '#9ca3af', marginBottom: 8 },
  stageDots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { height: 8, borderRadius: 4 },

  // Height
  heightSection: { marginBottom: 20 },
  heightLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  heightLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  heightValue: { fontSize: 14, fontWeight: '700' },
  heightBarBg: { height: 10, backgroundColor: '#e5e7eb', borderRadius: 5, overflow: 'hidden' },
  heightBarFill: { height: 10, borderRadius: 5 },
  heightScaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  heightScaleText: { fontSize: 10, color: '#9ca3af' },

  // Count chips
  countsRow: { flexDirection: 'row', gap: 8 },
  countChip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  countEmoji: { fontSize: 22, marginBottom: 4 },
  countNum: { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  countLbl: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  // ── Section card ──
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 18,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 18 },

  // Input
  inputGroup: { marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    overflow: 'hidden',
  },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#1f2937' },
  unitBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderLeftWidth: 1.5,
    borderLeftColor: '#d1d5db',
  },
  unitText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 6 },

  // Refresh button
  refreshBtn: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 110,
    alignItems: 'center',
  },
  refreshBtnText: { fontSize: 13, fontWeight: '600', color: '#10b981' },

  // Weather loading
  weatherLoadingCard: {
    backgroundColor: '#f0fdf4',
    padding: 24,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  weatherLoadingText: { fontSize: 15, fontWeight: '600', color: '#059669', marginTop: 10 },
  weatherLoadingSubtext: { fontSize: 13, color: '#6b7280', marginTop: 4 },

  // Weather card
  weatherCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  weatherTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  locationIcon: { fontSize: 16, marginRight: 6 },
  locationText: { fontSize: 15, fontWeight: '700', color: '#1f2937', flex: 1 },
  liveBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  demoBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  weatherMain: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  weatherIconBox: {
    width: 64,
    height: 64,
    backgroundColor: '#f0fdf4',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: '#10b981',
  },
  weatherIconBig: { fontSize: 36 },
  tempBig: { fontSize: 34, fontWeight: '800', color: '#1f2937' },
  weatherDesc: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  weatherStats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  weatherStat: { flex: 1, alignItems: 'center' },
  weatherStatIcon: { fontSize: 20, marginBottom: 4 },
  weatherStatLabel: { fontSize: 11, color: '#9ca3af', fontWeight: '600', marginBottom: 4 },
  weatherStatValue: { fontSize: 14, color: '#1f2937', fontWeight: '700' },
  weatherStatDivider: { width: 1, backgroundColor: '#e5e7eb', marginHorizontal: 8 },

  // Submit
  submitBtn: {
    backgroundColor: '#10b981',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 17,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitBtnText: { fontSize: 17, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  // Info box
  infoBox: {
    backgroundColor: '#fffbeb',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#92400e', marginBottom: 8 },
  infoText: { fontSize: 13, color: '#78350f', marginBottom: 5, lineHeight: 18 },
});
