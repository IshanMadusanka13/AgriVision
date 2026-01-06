import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FullAnalysisResult } from '@/services/api';

export default function ResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const result: FullAnalysisResult = JSON.parse(params.resultData as string);
  const { detection, recommendation } = result;

  const getNPKStatusColor = (level: string): string => {
    switch (level) {
      case 'optimal':
        return '#10b981';
      case 'low':
        return '#f59e0b';
      case 'high':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getNPKStatusIcon = (level: string): string => {
    switch (level) {
      case 'optimal':
        return '✅';
      case 'low':
        return '⚠️';
      case 'high':
        return '🔴';
      default:
        return '⚪';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🌱 Detection Results</Text>
        <View style={styles.detectionGrid}>
          <View style={styles.detectionItem}>
            <Text style={styles.detectionLabel}>Growth Stage</Text>
            <Text style={styles.detectionValue}>{detection.growth_stage}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧪 NPK Status</Text>
        {Object.entries(recommendation.npk_status).map(([nutrient, status]) => (
          <View key={nutrient} style={styles.npkItem}>
            <View style={styles.npkHeader}>
              <Text style={styles.npkTitle}>
                {getNPKStatusIcon(status.level)} {nutrient}
              </Text>
              <Text style={[styles.npkLevel, { color: getNPKStatusColor(status.level) }]}>
                {status.level.toUpperCase()}
              </Text>
            </View>
            <View style={styles.npkDetails}>
              <Text style={styles.npkText}>Current: {status.current} mg/kg</Text>
              <Text style={styles.npkText}>Optimal: {status.optimal} mg/kg</Text>
            </View>
          </View>
        ))}
      </View>

      {recommendation.warnings && recommendation.warnings.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⚠️ Warnings</Text>
          {recommendation.warnings.map((warning, index) => (
            <View key={index} style={styles.warningItem}>
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📅 Weekly Fertilizer Plan</Text>
        {recommendation.week_plan.map((day, index) => (
          <View key={index} style={styles.dayCard}>
            <Text style={styles.dayTitle}>{day.day}</Text>
            <View style={styles.dayDetails}>
              <Text style={styles.fertilizer}>🌿 {day.fertilizer_type}</Text>
              <Text style={styles.amount}>📊 Amount: {day.amount}</Text>
              {day.amount_adjusted && (
                <Text style={styles.amountAdjusted}>⚖️ {day.amount_adjusted}</Text>
              )}
              <Text style={styles.method}>🎯 Method: {day.method}</Text>
              <Text style={styles.watering}>💧 {day.watering}</Text>
            </View>
          </View>
        ))}
      </View>

      {recommendation.tips && recommendation.tips.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>💡 Tips</Text>
          {recommendation.tips.map((tip, index) => (
            <View key={index} style={styles.tipItem}>
              <Text style={styles.tipText}>• {tip}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/(tabs)')}>
          <Text style={styles.buttonText}>🏠 Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => router.push('/growth/camera')}
        >
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            📸 New Analysis
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  card: {
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
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  detectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detectionItem: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  detectionLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  detectionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
  },
  npkItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  npkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  npkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  npkLevel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  npkDetails: {
    gap: 4,
  },
  npkText: {
    fontSize: 14,
    color: '#6b7280',
  },
  warningItem: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  warningText: {
    fontSize: 14,
    color: '#78350f',
    lineHeight: 20,
  },
  dayCard: {
    backgroundColor: '#f9fafb',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 10,
  },
  dayDetails: {
    gap: 6,
  },
  fertilizer: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  amount: {
    fontSize: 14,
    color: '#374151',
  },
  amountAdjusted: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  method: {
    fontSize: 14,
    color: '#374151',
  },
  watering: {
    fontSize: 14,
    color: '#2563eb',
  },
  tipItem: {
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
  },
  button: {
    flex: 1,
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  primaryButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  primaryButtonText: {
    color: '#fff',
  },
});
