// app/npk-input.tsx
// NPK input screen for entering soil fertilizer levels

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
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';
import { getFullAnalysis, getCurrentWeather, type WeatherData, type Location as LocationType } from '@/services/api';

export default function NPKInputScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const imageUri = params.imageUri as string;
  const detection = {
    growth_stage: params.growth_stage as string,
    confidence: parseFloat(params.confidence as string),
    leaves_count: parseInt(params.leaves_count as string),
    flowers_count: parseInt(params.flowers_count as string),
    fruits_count: parseInt(params.fruits_count as string),
  };

  const [nitrogen, setNitrogen] = useState('70');
  const [phosphorus, setPhosphorus] = useState('90');
  const [potassium, setPotassium] = useState('170');
  const [ph, setPh] = useState('6.5');
  const [weather, setWeather] = useState('sunny');
  const [temperature, setTemperature] = useState('28');
  const [loading, setLoading] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [detectedWeather, setDetectedWeather] = useState<WeatherData | null>(null);
  const [userLocation, setUserLocation] = useState<LocationType | null>(null);
  const [autoDetected, setAutoDetected] = useState(false);

  // Helper function for weather icons
  const getWeatherIcon = (condition: string): string => {
    switch (condition) {
      case 'sunny':
        return '☀️';
      case 'rainy':
        return '🌧️';
      case 'cloudy':
        return '☁️';
      default:
        return '🌤️';
    }
  };

  // Auto-detect weather on component mount
  useEffect(() => {
    handleAutoDetectWeather();
  }, []);

  const handleAutoDetectWeather = async () => {
    setWeatherLoading(true);
    try {
      // Step 1: Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Location Permission අවශ්‍යයි',
          'Weather auto-detect කරන්න location permission එක allow කරන්න ඕනේ.',
          [{ text: 'හරි' }]
        );
        setWeatherLoading(false);
        return;
      }

      // Step 2: Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const userLoc: LocationType = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(userLoc);

      // Step 3: Get weather data from backend API
      const weatherData = await getCurrentWeather(userLoc);

      if (weatherData) {
        // Try to get location name
        let locationName = 'Your Location';
        try {
          const [address] = await Location.reverseGeocodeAsync({
            latitude: userLoc.latitude,
            longitude: userLoc.longitude,
          });
          locationName = address.city || address.district || address.subregion || 'Your Location';
        } catch (err) {
          console.warn('Could not get location name:', err);
        }

        // Set weather data with location name
        setDetectedWeather({
          ...weatherData,
          location: locationName,
        });
        setWeather(weatherData.condition);
        setTemperature(weatherData.temperature.toString());
        setAutoDetected(true);
      } else {
        Alert.alert(
          'Weather Detection අසමත් විය',
          'Weather automatic detect කරන්න බැහැ. කරුණාකරලා manually select කරන්න.',
          [{ text: 'හරි' }]
        );
      }
    } catch (error) {
      console.error('Weather detection error:', error);
      Alert.alert(
        'Weather Detection Error',
        'Weather data ගන්න බැහැ. Internet connection එක check කරන්න.',
        [{ text: 'හරි' }]
      );
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleSubmit = async () => {
    // Validate inputs
    if (!nitrogen || !phosphorus || !potassium || !ph) {
      Alert.alert('Input Required', 'කරුණාකරලා සියලු NPK සහ pH values enter කරන්න');
      return;
    }

    const n = parseFloat(nitrogen);
    const p = parseFloat(phosphorus);
    const k = parseFloat(potassium);
    const phValue = parseFloat(ph);

    if (isNaN(n) || isNaN(p) || isNaN(k) || isNaN(phValue)) {
      Alert.alert('Invalid Input', 'කරුණාකරලා valid numbers enter කරන්න');
      return;
    }

    // Validate pH range
    if (phValue < 0 || phValue > 14) {
      Alert.alert('Invalid pH', 'pH value 0-14 අතර විය යුතුයි');
      return;
    }

    setLoading(true);
    try {
      const result = await getFullAnalysis(
        imageUri,
        { nitrogen: n, phosphorus: p, potassium: k },
        userLocation, // Pass location for automatic weather detection
        autoDetected ? null : weather, // Only pass manual weather if not auto-detected
        temperature ? parseFloat(temperature) : null,
        phValue,
        detectedWeather?.humidity || null
      );

      router.push({
        pathname: '/growth/result',
        params: {
          resultData: JSON.stringify(result),
        },
      });
    } catch (error) {
      Alert.alert(
        'Analysis Failed',
        'Recommendations ගන්න බැහැ. Internet connection එක check කරන්න.',
        [{ text: 'OK' }]
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Detection Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>📊 Detection Summary</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Growth Stage</Text>
            <Text style={styles.summaryValue}>{detection.growth_stage}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Leaves</Text>
            <Text style={styles.summaryValue}>{detection.leaves_count}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Flowers</Text>
            <Text style={styles.summaryValue}>{detection.flowers_count}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Fruits</Text>
            <Text style={styles.summaryValue}>{detection.fruits_count}</Text>
          </View>
        </View>
      </View>

      {/* NPK Input Section */}
      <View style={styles.inputSection}>
        <Text style={styles.sectionTitle}>🧪 Soil NPK Levels (mg/kg)</Text>
        <Text style={styles.sectionDescription}>
          NPK meter එකෙන් පස test කරලා values enter කරන්න
        </Text>

        {/* Nitrogen Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nitrogen (N)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={nitrogen}
              onChangeText={setNitrogen}
              keyboardType="numeric"
              placeholder="70"
            />
            <Text style={styles.unit}>mg/kg</Text>
          </View>
          <Text style={styles.hint}>පස්වල නයිට්‍රජන් මට්ටම</Text>
        </View>

        {/* Phosphorus Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phosphorus (P)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={phosphorus}
              onChangeText={setPhosphorus}
              keyboardType="numeric"
              placeholder="90"
            />
            <Text style={styles.unit}>mg/kg</Text>
          </View>
          <Text style={styles.hint}>පස්වල පොස්පරස් මට්ටම</Text>
        </View>

        {/* Potassium Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Potassium (K)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={potassium}
              onChangeText={setPotassium}
              keyboardType="numeric"
              placeholder="170"
            />
            <Text style={styles.unit}>mg/kg</Text>
          </View>
          <Text style={styles.hint}>පස්වල පොටෑසියම් මට්ටම</Text>
        </View>

        {/* pH Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Soil pH</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={ph}
              onChangeText={setPh}
              keyboardType="numeric"
              placeholder="6.5"
            />
            <Text style={styles.unit}>pH</Text>
          </View>
          <Text style={styles.hint}>පස්වල pH මට්ටම (5.5-7.0 ideal)</Text>
        </View>
      </View>

      {/* Weather Section */}
      <View style={styles.inputSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>🌤️ Weather Conditions</Text>
          <TouchableOpacity
            style={styles.autoDetectButton}
            onPress={handleAutoDetectWeather}
            disabled={weatherLoading}
          >
            {weatherLoading ? (
              <ActivityIndicator size="small" color="#10b981" />
            ) : (
              <Text style={styles.autoDetectButtonText}>
                📍 {autoDetected ? 'Refresh' : 'Auto-Detect'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Show loading state */}
        {weatherLoading && !detectedWeather && (
          <View style={styles.weatherLoadingCard}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.weatherLoadingText}>🌤️ Detecting weather...</Text>
            <Text style={styles.weatherLoadingSubtext}>Getting your location</Text>
          </View>
        )}

        {/* Show detected weather info */}
        {!weatherLoading && detectedWeather && (
          <View style={styles.detectedWeatherCard}>
            <View style={styles.weatherHeader}>
              <View style={styles.locationRow}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={styles.locationText}>{detectedWeather.location}</Text>
              </View>
              <View style={detectedWeather.description.includes('Demo Mode') ? styles.weatherBadgeDemo : styles.weatherBadge}>
                <Text style={styles.weatherBadgeText}>
                  {detectedWeather.description.includes('Demo Mode') ? 'Demo Mode' : 'Auto-Detected'}
                </Text>
              </View>
            </View>

            <View style={styles.weatherMainInfo}>
              <View style={styles.weatherIconContainer}>
                <Text style={styles.weatherIconLarge}>
                  {getWeatherIcon(detectedWeather.condition)}
                </Text>
              </View>
              <View style={styles.weatherDetails}>
                <Text style={styles.temperatureLarge}>
                  {detectedWeather.temperature}°C
                </Text>
                <Text style={styles.weatherDescription}>
                  {detectedWeather.description.replace(' (Demo Mode)', '').charAt(0).toUpperCase() + detectedWeather.description.replace(' (Demo Mode)', '').slice(1)}
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
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={temperature}
              onChangeText={(value) => {
                setTemperature(value);
                setAutoDetected(false);
              }}
              keyboardType="numeric"
              placeholder="28"
            />
            <Text style={styles.unit}>°C</Text>
          </View>
          <Text style={styles.hint}>
            {autoDetected ? '✅ Auto-detected (can change manually)' : 'දැනට උෂ්ණත්වය'}
          </Text>
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>
            📅 Get Fertilizer Plan
          </Text>
        )}
      </TouchableOpacity>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>💡 Tips:</Text>
        <Text style={styles.infoText}>• NPK meter එකක් නැත්නම් estimate එකක් දාන්න පුළුවන්</Text>
        <Text style={styles.infoText}>• 📍 Weather auto-detect භාවිතා කරන්න - ඔයාගේ location එකෙන් automatic detect වෙනවා</Text>
        <Text style={styles.infoText}>• Location permission allow කරන්න weather detect වෙන්න</Text>
        <Text style={styles.infoText}>• Auto-detected values manually වෙනස් කරන්න පුළුවන්</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  summaryCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  inputSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  autoDetectButton: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10b981',
    minWidth: 100,
    alignItems: 'center',
  },
  autoDetectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10b981',
  },
  weatherLoadingCard: {
    backgroundColor: '#f0fdf4',
    padding: 24,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#10b981',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherLoadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#15803d',
    marginTop: 12,
  },
  weatherLoadingSubtext: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  detectedWeatherCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  weatherHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  weatherBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  weatherBadgeDemo: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  weatherBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#15803d',
  },
  weatherMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
  },
  weatherIconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#f0fdf4',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#10b981',
  },
  weatherIconLarge: {
    fontSize: 48,
  },
  weatherDetails: {
    flex: 1,
  },
  temperatureLarge: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  weatherDescription: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  weatherStats: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  weatherStat: {
    flex: 1,
    alignItems: 'center',
  },
  weatherStatIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  weatherStatLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 4,
    fontWeight: '600',
  },
  weatherStatValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '700',
  },
  weatherStatDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  unit: {
    paddingRight: 12,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    marginLeft: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  picker: {
    height: 50,
  },
  submitButton: {
    backgroundColor: '#10b981',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  infoBox: {
    backgroundColor: '#fef3c7',
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#78350f',
    marginBottom: 4,
    lineHeight: 18,
  },
});
