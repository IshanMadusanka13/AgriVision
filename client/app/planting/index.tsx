// planting/HomeScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

export default function PlantingHomeScreen() {
  const router = useRouter();

  const handleStartFieldMapping = () => {
    router.push('/planting/FieldWalkScreen');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <LinearGradient
        colors={['#2e7d32', '#4caf50', '#81c784']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroSection}
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroEmoji}>🌱</Text>
          <Text style={styles.heroTitle}>Field Planting</Text>
          <Text style={styles.heroSubtitle}>Precision Agriculture</Text>
          <Text style={styles.heroDescription}>
            Map your field, analyze soil samples, and optimize planting zones for maximum yield
          </Text>
        </View>

        <View style={styles.heroWave}>
          <Text style={styles.waveText}>～～～～～～～～～～～～</Text>
        </View>
      </LinearGradient>

      {/* Start Mapping Button */}
      <View style={styles.statusContainer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartFieldMapping}
          activeOpacity={0.9}
        >
          <Text style={styles.startButtonText}>🗺️ Start Field Mapping</Text>
          <Text style={styles.startButtonArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Features Grid */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Features</Text>

        <View style={styles.featuresGrid}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: '#e3f2fd' }]}>
              <Text style={styles.featureItemIcon}>🗺️</Text>
            </View>
            <Text style={styles.featureItemTitle}>Draw Boundaries</Text>
            <Text style={styles.featureItemDescription}>
              Walk or draw field perimeter to calculate exact area
            </Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: '#e8f5e8' }]}>
              <Text style={styles.featureItemIcon}>🧪</Text>
            </View>
            <Text style={styles.featureItemTitle}>Soil Sampling</Text>
            <Text style={styles.featureItemDescription}>
              Tap map to add soil test points with N, P, K values
            </Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: '#fff3e0' }]}>
              <Text style={styles.featureItemIcon}>🎨</Text>
            </View>
            <Text style={styles.featureItemTitle}>Zone Mapping</Text>
            <Text style={styles.featureItemDescription}>
              Color-coded zones based on soil fertility levels
            </Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: '#f3e5f5' }]}>
              <Text style={styles.featureItemIcon}>📊</Text>
            </View>
            <Text style={styles.featureItemTitle}>Yield Prediction</Text>
            <Text style={styles.featureItemDescription}>
              Calculate plant count and expected harvest
            </Text>
          </View>
        </View>
      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <View style={styles.ctaCard}>
          <Text style={styles.ctaEmoji}>🌶️</Text>
          <Text style={styles.ctaTitle}>Plan Your Planting Season</Text>
          <Text style={styles.ctaDescription}>
            Create precision planting zones based on soil variability and optimize your crop spacing.
          </Text>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleStartFieldMapping}
            activeOpacity={0.9}
          >
            <Text style={styles.ctaButtonText}>Start Mapping</Text>
            <Text style={styles.ctaButtonIcon}>→</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* How It Works */}
      <View style={styles.howItWorksSection}>
        <Text style={styles.sectionTitle}>How It Works</Text>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Draw Field Boundary</Text>
            <Text style={styles.stepDescription}>
              Walk the field perimeter or draw on interactive map
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add Soil Samples</Text>
            <Text style={styles.stepDescription}>
              Tap on map to add soil test points with nutrient values
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Generate Zones</Text>
            <Text style={styles.stepDescription}>
              System creates fertility zones with color coding
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>4</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Get Recommendations</Text>
            <Text style={styles.stepDescription}>
              View plant spacing, count, and expected yield per zone
            </Text>
          </View>
        </View>
      </View>

      {/* Tips Section */}
      <View style={styles.tipsSection}>
        <Text style={styles.sectionTitle}>📌 Mapping Tips</Text>

        <View style={styles.tipsList}>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>✓</Text>
            <Text style={styles.tipText}>Walk field boundaries slowly for accurate GPS</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>✓</Text>
            <Text style={styles.tipText}>Take soil samples at different field locations</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>✓</Text>
            <Text style={styles.tipText}>Minimum 5-7 sample points for good interpolation</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>✓</Text>
            <Text style={styles.tipText}>Include all necessary nutrients (N, P, K, pH)</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>🌱 Smart farming for better yields</Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  heroSection: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    position: 'relative',
  },
  heroContent: { alignItems: 'center' },
  heroEmoji: { fontSize: 72, marginBottom: 16 },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 17,
    color: '#e0f2e0',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroWave: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  waveText: { fontSize: 24, color: '#81c784', textAlign: 'center', opacity: 0.3 },

  statusContainer: {
    paddingHorizontal: 16,
    marginTop: -20,
    marginBottom: 16,
  },

  startButton: {
    flexDirection: 'row',
    backgroundColor: '#2e7d32',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  startButtonText: { fontSize: 20, fontWeight: '800', color: '#fff', marginRight: 8 },
  startButtonArrow: { fontSize: 22, color: '#fff', fontWeight: '800' },

  featuresSection: { padding: 24, marginTop: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#1f2937', marginBottom: 20 },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  featureItem: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  featureIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureItemIcon: { fontSize: 32 },
  featureItemTitle: { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 6, textAlign: 'center' },
  featureItemDescription: { fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 18 },

  ctaSection: { paddingHorizontal: 24, marginTop: 24 },
  ctaCard: {
    backgroundColor: '#f1f8e9',
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#a5d6a7',
  },
  ctaEmoji: { fontSize: 56, marginBottom: 16 },
  ctaTitle: { fontSize: 22, fontWeight: '800', color: '#1f2937', marginBottom: 12, textAlign: 'center' },
  ctaDescription: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24, maxWidth: 300 },
  ctaButton: {
    flexDirection: 'row',
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaButtonText: { fontSize: 17, fontWeight: '700', color: '#fff', marginRight: 8 },
  ctaButtonIcon: { fontSize: 20, color: '#fff', fontWeight: '700' },

  howItWorksSection: { paddingHorizontal: 24, marginTop: 24 },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNumberText: { fontSize: 18, fontWeight: '800', color: '#2e7d32' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 6 },
  stepDescription: { fontSize: 14, color: '#6b7280', lineHeight: 20 },

  tipsSection: { paddingHorizontal: 24, marginTop: 24 },
  tipsList: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  tipItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  tipBullet: { fontSize: 16, color: '#2e7d32', fontWeight: '700', marginRight: 12, marginTop: 2 },
  tipText: { flex: 1, fontSize: 15, color: '#374151', lineHeight: 22 },

  footer: { alignItems: 'center', padding: 24 },
  footerText: { fontSize: 13, color: '#9ca3af' },

  bottomPadding: { height: 40 },
});