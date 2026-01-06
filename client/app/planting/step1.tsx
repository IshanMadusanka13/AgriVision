// app/planting/step1.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

// Conditionally import MapView to avoid issues
let MapView: any = null;
let Polygon: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

try {
  const maps = require('react-native-maps');
  MapView = maps.default || maps;
  Polygon = maps.Polygon;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} catch (error) {
  console.warn('react-native-maps not available');
}

const mockAPI = {
  calculateSpacing: async (soilType: string, climate: string) => {
    const spacingMap: Record<string, Record<string, { row: number; plant: number }>> = {
      'sandy': {
        'tropical': { row: 0.9, plant: 0.6 },
        'temperate': { row: 1.0, plant: 0.7 },
        'arid': { row: 1.1, plant: 0.8 },
      },
      'loam': {
        'tropical': { row: 0.8, plant: 0.5 },
        'temperate': { row: 0.9, plant: 0.6 },
        'arid': { row: 1.0, plant: 0.7 },
      },
      'clay': {
        'tropical': { row: 1.0, plant: 0.7 },
        'temperate': { row: 1.1, plant: 0.8 },
        'arid': { row: 1.2, plant: 0.9 },
      },
    };
    
    await new Promise(resolve => setTimeout(resolve, 500));
    return spacingMap[soilType]?.[climate] || { row: 0.9, plant: 0.6 };
  },
};

export default function Step1Screen() {
  const router = useRouter();
  const { width, height } = Dimensions.get('window');
  
  const [location, setLocation] = useState<any>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldArea, setFieldArea] = useState('');
  const [coordinates, setCoordinates] = useState<any[]>([]);
  const [soilType, setSoilType] = useState('loam');
  const [climateZone, setClimateZone] = useState('tropical');
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to use this feature');
        return;
      }
      
      try {
        const location = await Location.getCurrentPositionAsync({});
        setLocation(location.coords);
        
        const defaultCoords = [
          {
            latitude: location.coords.latitude - 0.001,
            longitude: location.coords.longitude - 0.001,
          },
          {
            latitude: location.coords.latitude - 0.001,
            longitude: location.coords.longitude + 0.001,
          },
          {
            latitude: location.coords.latitude + 0.001,
            longitude: location.coords.longitude + 0.001,
          },
          {
            latitude: location.coords.latitude + 0.001,
            longitude: location.coords.longitude - 0.001,
          },
        ];
        setCoordinates(defaultCoords);
      } catch (error) {
        Alert.alert('Error', 'Failed to get location');
      }
    })();
  }, []);

  const handleMapPress = (e: any) => {
    const newCoord = e.nativeEvent.coordinate;
    setCoordinates([...coordinates, newCoord]);
  };

  const calculateSpacing = async () => {
    try {
      const spacing = await mockAPI.calculateSpacing(soilType, climateZone);
      Alert.alert(
        'Spacing Calculated',
        `Recommended spacing: ${spacing.row}m between rows, ${spacing.plant}m between plants`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to calculate spacing');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Step 1: Field Setup</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.stepContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Field Name</Text>
            <TextInput
              style={styles.input}
              value={fieldName}
              onChangeText={setFieldName}
              placeholder="Enter field name"
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Field Area</Text>
            <TextInput
              style={styles.input}
              value={fieldArea}
              onChangeText={setFieldArea}
              placeholder="Enter area in acres"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.mapContainer}>
            <Text style={styles.label}>Draw Field Boundary</Text>
            {location && MapView && !mapError ? (
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={handleMapPress}
                provider={PROVIDER_GOOGLE}
                onError={(error: any) => {
                  console.error('Map error:', error);
                  setMapError(true);
                }}
              >
                {coordinates.length > 0 && Polygon && (
                  <Polygon
                    coordinates={coordinates}
                    strokeColor="#4CAF50"
                    fillColor="rgba(76, 175, 80, 0.2)"
                    strokeWidth={2}
                  />
                )}
                {coordinates.map((coord, index) => (
                  <Marker
                    key={index}
                    coordinate={coord}
                    title={`Point ${index + 1}`}
                  />
                ))}
              </MapView>
            ) : (
              <View style={styles.mapFallback}>
                <Ionicons name="map-outline" size={50} color="#CCC" />
                <Text style={styles.mapFallbackText}>
                  Map not available. Check your internet connection or map configuration.
                </Text>
              </View>
            )}
            <Text style={styles.mapHint}>
              Tap on the map to add boundary points. {coordinates.length} points added.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, coordinates.length < 3 && styles.buttonDisabled]}
            onPress={() => router.push('/planting/step2')}
            disabled={coordinates.length < 3}
          >
            <Text style={styles.buttonText}>Next: Soil Analysis</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  mapContainer: {
    marginBottom: 20,
  },
  map: {
    width: '100%',
    height: 250,
    borderRadius: 8,
  },
  mapFallback: {
    height: 250,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  mapFallbackText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 12,
    fontSize: 14,
  },
  mapHint: {
    fontSize: 12,
    color: '#13191fff',
    marginTop: 8,
    fontStyle: 'italic',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});