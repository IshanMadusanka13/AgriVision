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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🌱 Detection Results</Text>
        <View style={styles.detectionGrid}>
          <View style={styles.detectionItem}>
            <Text style={styles.detectionLabel}>Growth Stage</Text>
            <Text style={styles.detectionValue}>{detection.growth_stage}</Text>
          </View>
          {detection.plant_id && (
            <View style={styles.detectionItem}>
              <Text style={styles.detectionLabel}>Plant ID</Text>
              <Text style={styles.detectionValue}>#{detection.plant_id}</Text>
            </View>
          )}
          {detection.plant_height_cm && (
            <View style={styles.detectionItem}>
              <Text style={styles.detectionLabel}>Plant Height</Text>
              <Text style={styles.detectionValue}>{detection.plant_height_cm} cm</Text>
            </View>
          )}
          <View style={styles.detectionItem}>
            <Text style={styles.detectionLabel}>Leaves</Text>
            <Text style={styles.detectionValue}>{detection.leaves_count}</Text>
          </View>
          <View style={styles.detectionItem}>
            <Text style={styles.detectionLabel}>Flowers</Text>
            <Text style={styles.detectionValue}>{detection.flowers_count}</Text>
          </View>
          <View style={styles.detectionItem}>
            <Text style={styles.detectionLabel}>Fruits</Text>
            <Text style={styles.detectionValue}>{detection.fruits_count}</Text>
          </View>
        </View>
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
        <TouchableOpacity style={styles.button} onPress={() => router.push('/')}>
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
