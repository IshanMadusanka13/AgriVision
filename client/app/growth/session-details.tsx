import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.8.183:8000';

export default function SessionDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    loadSessionDetails();
  }, []);

  const loadSessionDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/growth/session/${sessionId}`);
      if (response.data.success) {
        setSessionData(response.data.analysis);
      }
    } catch (error) {
      console.error('Load session error:', error);
      Alert.alert('Error', 'Failed to load session details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </SafeAreaView>
    );
  }

  if (!sessionData) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Session not found</Text>
      </SafeAreaView>
    );
  }

  const session = sessionData.session;
  const npkStatus = sessionData.npk_status;
  const recommendations = sessionData.fertilizer_recommendations;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Images */}
        {(session.original_image_url) && (
          <View style={styles.imageSection}>
            <Image
              source={{ uri: session.original_image_url }}
              style={styles.mainImage}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Growth Stage */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌱 Growth Stage</Text>
          <Text style={styles.growthStage}>{session.growth_stage}</Text>
          <Text style={styles.confidence}>
            Confidence: {(session.growth_stage_confidence * 100).toFixed(1)}%
          </Text>
        </View>

        {/* Detection Results */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔍 Detection Results</Text>
          <View style={styles.detectionGrid}>
            <View style={styles.detectionItem}>
              <Text style={styles.detectionIcon}>🍃</Text>
              <Text style={styles.detectionLabel}>Leaves</Text>
              <Text style={styles.detectionValue}>{session.leaf_count}</Text>
            </View>
            <View style={styles.detectionItem}>
              <Text style={styles.detectionIcon}>🌸</Text>
              <Text style={styles.detectionLabel}>Flowers</Text>
              <Text style={styles.detectionValue}>{session.flower_count}</Text>
            </View>
            <View style={styles.detectionItem}>
              <Text style={styles.detectionIcon}>🌶️</Text>
              <Text style={styles.detectionLabel}>Fruits</Text>
              <Text style={styles.detectionValue}>{session.fruit_count}</Text>
            </View>
          </View>
        </View>

        {/* NPK Levels */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧪 NPK Levels</Text>
          <View style={styles.npkGrid}>
            <View style={styles.npkItem}>
              <Text style={styles.npkLabel}>Nitrogen (N)</Text>
              <Text style={styles.npkValue}>{session.nitrogen} mg/kg</Text>
              {npkStatus && (
                <Text style={[styles.npkStatus, getStatusColor(npkStatus.nitrogen_level)]}>
                  {npkStatus.nitrogen_level}
                </Text>
              )}
            </View>
            <View style={styles.npkItem}>
              <Text style={styles.npkLabel}>Phosphorus (P)</Text>
              <Text style={styles.npkValue}>{session.phosphorus} mg/kg</Text>
              {npkStatus && (
                <Text style={[styles.npkStatus, getStatusColor(npkStatus.phosphorus_level)]}>
                  {npkStatus.phosphorus_level}
                </Text>
              )}
            </View>
            <View style={styles.npkItem}>
              <Text style={styles.npkLabel}>Potassium (K)</Text>
              <Text style={styles.npkValue}>{session.potassium} mg/kg</Text>
              {npkStatus && (
                <Text style={[styles.npkStatus, getStatusColor(npkStatus.potassium_level)]}>
                  {npkStatus.potassium_level}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Environmental Data */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🌤️ Environmental Data</Text>
          <View style={styles.envGrid}>
            {session.ph && (
              <View style={styles.envItem}>
                <Text style={styles.envLabel}>pH</Text>
                <Text style={styles.envValue}>{session.ph}</Text>
              </View>
            )}
            {session.temperature && (
              <View style={styles.envItem}>
                <Text style={styles.envLabel}>Temperature</Text>
                <Text style={styles.envValue}>{session.temperature}°C</Text>
              </View>
            )}
            {session.humidity && (
              <View style={styles.envItem}>
                <Text style={styles.envLabel}>Humidity</Text>
                <Text style={styles.envValue}>{session.humidity}%</Text>
              </View>
            )}
          </View>
        </View>

        {/* Location & Date */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Details</Text>
          {session.location && (
            <Text style={styles.infoText}>Location: {session.location}</Text>
          )}
          <Text style={styles.infoText}>Date: {formatDate(session.created_at)}</Text>
        </View>

        {/* Fertilizer Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 Fertilizer Plan</Text>
            {recommendations.map((rec: any, index: number) => (
              <View key={index} style={styles.recItem}>
                <Text style={styles.recDay}>{rec.day_name}</Text>
                <Text style={styles.recFertilizer}>{rec.fertilizer_type}</Text>
                <Text style={styles.recAmount}>{rec.amount}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'optimal':
      return { color: '#059669' };
    case 'low':
      return { color: '#dc2626' };
    case 'high':
      return { color: '#f59e0b' };
    default:
      return { color: '#6b7280' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 40,
  },
  scrollView: {
    flex: 1,
  },
  imageSection: {
    backgroundColor: '#000',
    aspectRatio: 4 / 3,
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  growthStage: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 4,
  },
  confidence: {
    fontSize: 14,
    color: '#6b7280',
  },
  detectionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  detectionItem: {
    alignItems: 'center',
  },
  detectionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  detectionLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  detectionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  npkGrid: {
    gap: 12,
  },
  npkItem: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  npkLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  npkValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  npkStatus: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  envGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  envItem: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  envLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  envValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  infoText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 8,
  },
  recItem: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  recDay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  recFertilizer: {
    fontSize: 13,
    color: '#059669',
    marginBottom: 2,
  },
  recAmount: {
    fontSize: 12,
    color: '#6b7280',
  },
});
