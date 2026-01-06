import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function DiseaseScreen() {
  const router = useRouter();

  const handleStartAnalysis = () => {
    router.push("/disease/camera" as any);
  };

  const goToHistory = () => {
    router.push("/disease/disease-history");
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <LinearGradient
        colors={["#dc2626", "#ef4444", "#f87171"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroSection}
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroEmoji}>🌶️</Text>
          <Text style={styles.heroTitle}>Scotch Bonnet</Text>
          <Text style={styles.heroSubtitle}>Disease Detection</Text>
          <Text style={styles.heroDescription}>
            AI-powered health monitoring for your Scotch Bonnet peppers
          </Text>
        </View>
        
        <View style={styles.heroWave}>
          <Text style={styles.waveText}>～～～～～～～～～～～～</Text>
        </View>
      </LinearGradient>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <TouchableOpacity
          style={[styles.quickActionCard, styles.primaryCard]}
          onPress={handleStartAnalysis}
          activeOpacity={0.8}
        >
          <View style={styles.quickActionIconContainer}>
            <Text style={styles.quickActionIcon}>📸</Text>
          </View>
          <View style={styles.quickActionContent}>
            <Text style={styles.quickActionTitle}>New Scan</Text>
            <Text style={styles.quickActionSubtitle}>
              Detect diseases instantly
            </Text>
          </View>
          <Text style={styles.quickActionArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionCard, styles.secondaryCard]}
          onPress={goToHistory}
          activeOpacity={0.8}
        >
          <View style={styles.quickActionIconContainer}>
            <Text style={styles.quickActionIcon}>📋</Text>
          </View>
          <View style={styles.quickActionContent}>
            <Text style={styles.quickActionTitle}>Scan History</Text>
            <Text style={styles.quickActionSubtitle}>
              View past analyses
            </Text>
          </View>
          <Text style={styles.quickActionArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Features Grid */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>What We Detect</Text>
        
        <View style={styles.featuresGrid}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: "#fef3c7" }]}>
              <Text style={styles.featureItemIcon}>🔬</Text>
            </View>
            <Text style={styles.featureItemTitle}>Bacterial Spot</Text>
            <Text style={styles.featureItemDescription}>
              Dark lesions on leaves and fruits
            </Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: "#dbeafe" }]}>
              <Text style={styles.featureItemIcon}>🍃</Text>
            </View>
            <Text style={styles.featureItemTitle}>Leaf Curl</Text>
            <Text style={styles.featureItemDescription}>
              Distorted and curled foliage
            </Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: "#fce7f3" }]}>
              <Text style={styles.featureItemIcon}>☁️</Text>
            </View>
            <Text style={styles.featureItemTitle}>Powdery Mildew</Text>
            <Text style={styles.featureItemDescription}>
              White powdery coating
            </Text>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconCircle, { backgroundColor: "#dcfce7" }]}>
              <Text style={styles.featureItemIcon}>⭕</Text>
            </View>
            <Text style={styles.featureItemTitle}>Cercospora</Text>
            <Text style={styles.featureItemDescription}>
              Circular leaf spots
            </Text>
          </View>
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
            <Text style={styles.stepTitle}>Capture Image</Text>
            <Text style={styles.stepDescription}>
              Take a clear photo of the affected leaves or stems in good lighting
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>AI Analysis</Text>
            <Text style={styles.stepDescription}>
              Our advanced AI model analyzes the image and detects diseases
            </Text>
          </View>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Get Results</Text>
            <Text style={styles.stepDescription}>
              Receive detailed diagnosis with severity level and treatment recommendations
            </Text>
          </View>
        </View>
      </View>

      {/* Benefits */}
      <View style={styles.benefitsSection}>
        <Text style={styles.sectionTitle}>Why Use Our Scanner?</Text>
        
        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>⚡</Text>
          <View style={styles.benefitContent}>
            <Text style={styles.benefitTitle}>Instant Results</Text>
            <Text style={styles.benefitDescription}>
              Get diagnosis in seconds, not days
            </Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>🎯</Text>
          <View style={styles.benefitContent}>
            <Text style={styles.benefitTitle}>High Accuracy</Text>
            <Text style={styles.benefitDescription}>
              Trained on thousands of Scotch Bonnet images
            </Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>💊</Text>
          <View style={styles.benefitContent}>
            <Text style={styles.benefitTitle}>Treatment Plans</Text>
            <Text style={styles.benefitDescription}>
              Receive actionable treatment recommendations
            </Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <Text style={styles.benefitIcon}>📊</Text>
          <View style={styles.benefitContent}>
            <Text style={styles.benefitTitle}>Track Progress</Text>
            <Text style={styles.benefitDescription}>
              Save and compare scans over time
            </Text>
          </View>
        </View>
      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <View style={styles.ctaCard}>
          <Text style={styles.ctaEmoji}>🌱</Text>
          <Text style={styles.ctaTitle}>Keep Your Peppers Healthy</Text>
          <Text style={styles.ctaDescription}>
            Early detection is key to preventing disease spread and maintaining a healthy crop
          </Text>
          
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleStartAnalysis}
            activeOpacity={0.9}
          >
            <Text style={styles.ctaButtonText}>Start Your First Scan</Text>
            <Text style={styles.ctaButtonIcon}>→</Text>
          </TouchableOpacity>
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
            <Text style={styles.tipText}>Focus on the affected areas clearly</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>✓</Text>
            <Text style={styles.tipText}>Avoid shadows and reflections</Text>
          </View>
          <View style={styles.tipItem}>
            <Text style={styles.tipBullet}>✓</Text>
            <Text style={styles.tipText}>Capture both top and bottom of leaves</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  heroSection: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
    position: "relative",
  },
  heroContent: {
    alignItems: "center",
  },
  heroEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 24,
    fontWeight: "600",
    color: "#fee2e2",
    marginBottom: 12,
  },
  heroDescription: {
    fontSize: 16,
    color: "#fecaca",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  heroWave: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  waveText: {
    fontSize: 24,
    color: "#f87171",
    textAlign: "center",
    opacity: 0.3,
  },
  quickActionsContainer: {
    paddingHorizontal: 16,
    marginTop: -20,
    gap: 12,
  },
  quickActionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryCard: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#ef4444",
  },
  secondaryCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  quickActionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  quickActionIcon: {
    fontSize: 28,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  quickActionArrow: {
    fontSize: 24,
    color: "#ef4444",
    fontWeight: "600",
  },
  featuresSection: {
    padding: 24,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 20,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  featureItem: {
    width: "48%",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  featureIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  featureItemIcon: {
    fontSize: 32,
  },
  featureItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 6,
    textAlign: "center",
  },
  featureItemDescription: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 18,
  },
  howItWorksSection: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  stepCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ef4444",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  benefitsSection: {
    paddingHorizontal: 24,
    marginTop: 16,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  benefitIcon: {
    fontSize: 28,
    marginRight: 16,
    marginTop: 2,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  ctaSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  ctaCard: {
    backgroundColor: "#fef2f2",
    padding: 28,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fecaca",
  },
  ctaEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  ctaTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 12,
    textAlign: "center",
  },
  ctaDescription: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 300,
  },
  ctaButton: {
    flexDirection: "row",
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#ef4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#fff",
    marginRight: 8,
  },
  ctaButtonIcon: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "700",
  },
  tipsSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  tipsList: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  tipItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  tipBullet: {
    fontSize: 16,
    color: "#10b981",
    fontWeight: "700",
    marginRight: 12,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
  },
  bottomPadding: {
    height: 40,
  },
});