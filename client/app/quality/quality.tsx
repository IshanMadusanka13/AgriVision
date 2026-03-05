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

export default function QualityScreen() {
  const router = useRouter();

  const handleStartGrading = () => {
    router.push('/quality/uploadquality');
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <LinearGradient
        colors={['#10b981', '#34d399', '#6ee7b7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroSection}
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroEmoji}>🧺</Text>
          <Text style={styles.heroTitle}>Scotch Bonnet</Text>
          <Text style={styles.heroSubtitle}>Quality Grading</Text>
          <Text style={styles.heroDescription}>
            Automatic grading and sorting system for Scotch Bonnet peppers
          </Text>
        </View>

        <View style={styles.heroWave}>
          <Text style={styles.waveText}>～～～～～～～～～～～～</Text>
        </View>
      </LinearGradient>

      {/* Start Grading Button */}
      <View style={styles.statusContainer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartGrading}
          activeOpacity={0.9}
        >
          <Text style={styles.startButtonText}>📤 Start Quality Grading</Text>
          <Text style={styles.startButtonArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Features Grid */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>Features</Text>

        <View style={styles.featuresGrid}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: '#fef3c7' }]}>
              <Text style={styles.featureItemIcon}>📸</Text>
            </View>
            <Text style={styles.featureItemTitle}>Image Upload</Text>
            <Text style={styles.featureItemDescription}>
              Upload photos to perform quality checks
            </Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: '#dbeafe' }]}>
              <Text style={styles.featureItemIcon}>🎯</Text>
            </View>
            <Text style={styles.featureItemTitle}>Grade Classification</Text>
            <Text style={styles.featureItemDescription}>
              Classifies peppers into Grade A, B, C, or D
            </Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: '#fce7f3' }]}>
              <Text style={styles.featureItemIcon}>🔍</Text>
            </View>
            <Text style={styles.featureItemTitle}>Visual Sorting</Text>
            <Text style={styles.featureItemDescription}>
              Sort peppers based on their grade automatically
            </Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: '#dcfce7' }]}>
              <Text style={styles.featureItemIcon}>📊</Text>
            </View>
            <Text style={styles.featureItemTitle}>Category Analysis</Text>
            <Text style={styles.featureItemDescription}>
              Scotch bonnet grade comparison
            </Text>
          </View>
        </View>
      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <View style={styles.ctaCard}>
          <Text style={styles.ctaEmoji}>🌶️</Text>
          <Text style={styles.ctaTitle}>Start Grading Your Peppers</Text>
          <Text style={styles.ctaDescription}>
            Automatically classify and sort your Scotch Bonnet peppers to ensure top quality.
          </Text>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleStartGrading}
            activeOpacity={0.9}
          >
            <Text style={styles.ctaButtonText}>Start Grading</Text>
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
            <Text style={styles.stepTitle}>Upload Images</Text>
            <Text style={styles.stepDescription}>
              Upload clear photos of Scotch Bonnet peppers
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Quality Grading</Text>
            <Text style={styles.stepDescription}>
              Our model classifies each pepper automatically
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Visual Grading</Text>
            <Text style={styles.stepDescription}>
              Provides visual sorting guidance
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>4</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Category Analysis</Text>
            <Text style={styles.stepDescription}>
              See scotch bonnet grade comparison
            </Text>
          </View>
        </View>
      </View>

      {/* Tips Section */}
      <View style={styles.tipsSection}>
        <Text style={styles.sectionTitle}>📸 Photo Tips</Text>

        <View style={styles.tipsList}>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>✓</Text>
            <Text style={styles.tipText}>Use natural daylight for best results</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>✓</Text>
            <Text style={styles.tipText}>Focus on the affected peppers clearly</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>✓</Text>
            <Text style={styles.tipText}>Avoid shadows and reflections</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>✓</Text>
            <Text style={styles.tipText}>Capture multiple angles for accuracy</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>🇱🇰 Designed for Sri Lankan agriculture</Text>
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
    color: '#d4fcdc',
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 320,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  heroWave: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  waveText: { fontSize: 24, color: '#6ee7b7', textAlign: 'center', opacity: 0.3 },

  statusContainer: {
    paddingHorizontal: 16,
    marginTop: -20,
    marginBottom: 16,
  },

  startButton: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
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
    backgroundColor: '#fef2f2',
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#a7f3d0',
  },
  ctaEmoji: { fontSize: 56, marginBottom: 16 },
  ctaTitle: { fontSize: 22, fontWeight: '800', color: '#1f2937', marginBottom: 12, textAlign: 'center' },
  ctaDescription: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 24, maxWidth: 300 },
  ctaButton: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#10b981',
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
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  stepNumberText: { fontSize: 18, fontWeight: '800', color: '#10b981' },
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
  tipBullet: { fontSize: 16, color: '#10b981', fontWeight: '700', marginRight: 12, marginTop: 2 },
  tipText: { flex: 1, fontSize: 15, color: '#374151', lineHeight: 22 },

  footer: { alignItems: 'center', padding: 24 },
  footerText: { fontSize: 13, color: '#9ca3af' },

  bottomPadding: { height: 40 },
});