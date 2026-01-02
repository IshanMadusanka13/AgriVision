// app/(tabs)/index.tsx
// Home screen with navigation options

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { checkAPIStatus } from '@/services/api';

export default function HomeScreen() {
  const router = useRouter();
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    checkAPI();
  }, []);

  const checkAPI = async () => {
    try {
      const isOnline = await checkAPIStatus();
      setApiStatus(isOnline ? 'online' : 'offline');
    } catch (error) {
      setApiStatus('offline');
    }
  };

  const handleStartAnalysis = () => {
    if (apiStatus === 'offline') {
      Alert.alert(
        'API Offline',
        'Backend server is not running. Please start the backend:\n\ncd server\npython -m uvicorn main:app --reload',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push('/growth/camera');
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🌶️</Text>
        <Text style={styles.subtitle}>Scotch Bonnet Monitor</Text>
        <Text style={styles.description}>
          AI-powered plant health monitoring
        </Text>
      </View>

      {/* API Status */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusBadge, apiStatus === 'online' && styles.statusOnline]}>
          <View style={[styles.statusDot, apiStatus === 'online' && styles.dotOnline]} />
          <Text style={styles.statusText}>
            {apiStatus === 'checking' ? 'Checking...' : apiStatus === 'online' ? 'API Online' : 'API Offline'}
          </Text>
        </View>
        <TouchableOpacity onPress={checkAPI} style={styles.refreshButton}>
          <Text style={styles.refreshText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Features */}
      <View style={styles.featuresContainer}>
        <Text style={styles.sectionTitle}>Features</Text>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>📸</Text>
          <Text style={styles.featureTitle}>Plant Detection</Text>
          <Text style={styles.featureDescription}>
            Detects leaves, flowers, and fruits using YOLOv8 AI model
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>🌱</Text>
          <Text style={styles.featureTitle}>Growth Stage</Text>
          <Text style={styles.featureDescription}>
            Identifies vegetative, flowering, fruiting, and ripening stages
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>🧪</Text>
          <Text style={styles.featureTitle}>NPK Analysis</Text>
          <Text style={styles.featureDescription}>
            Analyzes soil fertilizer levels and provides recommendations
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureIcon}>📅</Text>
          <Text style={styles.featureTitle}>Weekly Plan</Text>
          <Text style={styles.featureDescription}>
            Generates weather-adjusted fertilizer schedule
          </Text>
        </View>
      </View>

      {/* Start Button */}
      <TouchableOpacity
        style={[styles.startButton, apiStatus === 'offline' && styles.buttonDisabled]}
        onPress={handleStartAnalysis}
      >
        <Text style={styles.startButtonText}>
          {apiStatus === 'offline' ? '⚠️ API Offline' : '📸 Start Analysis'}
        </Text>
      </TouchableOpacity>

      {/* Instructions */}
      <View style={styles.instructionsContainer}>
        <Text style={styles.sectionTitle}>How to Use</Text>
        <Text style={styles.instructionText}>1. Take a clear photo of your plant</Text>
        <Text style={styles.instructionText}>2. AI detects leaves, flowers, and fruits</Text>
        <Text style={styles.instructionText}>3. Enter NPK meter readings</Text>
        <Text style={styles.instructionText}>4. Get personalized fertilizer plan</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Built with YOLOv8 & FastAPI
        </Text>
        <Text style={styles.footerText}>
          🇱🇰 Made for Sri Lankan farmers
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#10b981',
  },
  title: {
    fontSize: 64,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  description: {
    fontSize: 16,
    color: '#d1fae5',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 20,
  },
  statusOnline: {
    backgroundColor: '#d1fae5',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  dotOnline: {
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
  featuresContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  featureCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: '#10b981',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  instructionsContainer: {
    padding: 16,
    marginTop: 16,
  },
  instructionText: {
    fontSize: 15,
    color: '#4b5563',
    marginBottom: 8,
    paddingLeft: 8,
  },
  footer: {
    alignItems: 'center',
    padding: 24,
    marginTop: 16,
  },
  footerText: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 4,
  },
});
