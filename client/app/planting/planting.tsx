// app/planting/index.tsx - FIXED VERSION WITH BACK BUTTON
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router';
import { Ionicons, MaterialIcons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';

export default function PlantingIndex() {
  const router = useRouter();
  const { width } = Dimensions.get('window');

  const features = [
    {
      id: 'feature-1',
      icon: '🎯',
      title: 'Adaptive Spacing',
      description: 'Adjusts to your soil & climate',
      color: '#4CAF50',
    },
    {
      id: 'feature-2',
      icon: '📈',
      title: 'AI based Optimization',
      description: 'Test different planting strategies',
      color: '#607D8B',
    },
    
    {
      id: 'feature-3',
      icon: '🧪',
      title: 'Soil-Based Rules',
      description: 'pH, moisture, fertility analysis',
      color: '#FF9800',
    },
    
    
    {
      id: 'feature-4',
      icon: '💡',
      title: 'Advisories',
      description: 'Soil management & spacing tips',
      color: '#795548',
    },
    
  ];

  const steps = [
    {
      id: 'step-1',
      number: 1,
      icon: '🗺️',
      title: 'Define Your Field',
      description: 'Draw on map or upload GeoJSON',
      details: 'Define field boundary & soil data',
      color: '#4CAF50',
    },
    {
      id: 'step-2',
      number: 2,
      icon: '🌱',
      title: 'Get Optimal Layout',
      description: 'AI calculates based on conditions',
      details: 'Optimal spacing & plant layout',
      color: '#2196F3',
    },
    {
      id: 'step-3',
      number: 3,
      icon: '📈',
      title: 'View Growth Simulation',
      description: '6-month yield forecast',
      details: 'Expert advice included',
      color: '#FF9800',
    },
  ];

  const benefits = [
    'Increase yield by up to 25% with optimal spacing',
    'Reduce resource waste and plant competition',
    'Get soil-specific recommendations',
    'Simulate before you plant',
    'Free for small-scale farmers',
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.headerWithBack}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()} // Or router.push('/') if you want to go to root
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitleText}>Planting Advisor</Text>
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Text style={styles.headerIconText}>🌶️</Text>
            </View>
            <Text style={styles.heroTitle}>SCOTCH BONNET</Text>
            <Text style={styles.heroSubtitle}>Smart Planting Layouts for Maximum Yield</Text>
          </View>

          <Text style={styles.heroDescription}>
            Plan your Scotch Bonnet plantation with AI-powered optimization
          </Text>
          
          <View style={styles.heroButtons}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => router.push('/planting/step1')}
            >
              <Ionicons name="rocket" size={20} color="#FFF" />
              <Text style={styles.primaryButtonText}>Create New Field</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={() => router.push('/planting/step1')}
            >
              <Ionicons name="stats-chart" size={20} color="#4CAF50" />
              <Text style={styles.secondaryButtonText}>View Demo</Text>
            </TouchableOpacity>
          </View>

          {/* Visualization Placeholder */}
          <View style={styles.visualizationContainer}>
            <View style={styles.visualization}>
              <View style={styles.plantVisualization}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <View key={`plant-row-${i}`} style={styles.plantRow}>
                    {[1, 2, 3, 4, 5].map((j) => (
                      <View key={`plant-dot-${i}-${j}`} style={styles.plantDot} />
                    ))}
                  </View>
                ))}
              </View>
              <View style={styles.analyticsOverlay}>
                <View style={styles.analyticsItem}>
                  <Text style={styles.analyticsLabel}>Yield</Text>
                  <Text style={styles.analyticsValue}>+25%</Text>
                </View>
                <View style={styles.analyticsItem}>
                  <Text style={styles.analyticsLabel}>Efficiency</Text>
                  <Text style={styles.analyticsValue}>92%</Text>
                </View>
              </View>
            </View>
            <Text style={styles.visualizationCaption}>
              Growing from soil with analytics overlay
            </Text>
          </View>
        </View>

        {/* How It Works Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HOW IT WORKS (3 Steps)</Text>
          <View style={styles.stepsContainer}>
            {steps.map((step) => (
              <TouchableOpacity 
                key={step.id}
                style={[styles.stepCard, { borderTopColor: step.color }]}
                onPress={() => router.push(`/planting/step${step.number}` as any)}
              >
                <View style={styles.stepHeader}>
                  <Text style={styles.stepIcon}>{step.icon}</Text>
                  <Text style={styles.stepNumber}>Step {step.number}</Text>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.details}</Text>
                <Text style={styles.stepDetail}>{step.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Key Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>KEY FEATURES</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature) => (
              <View key={feature.id} style={styles.featureCard}>
                <Text style={styles.featureIcon}>{feature.icon}</Text>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Why Choose Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHY CHOOSE OUR SYSTEM?</Text>
          <View style={styles.benefitsContainer}>
            {benefits.map((benefit, index) => (
              <View key={`benefit-${index}`} style={styles.benefitItem}>
                <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
          
          <TouchableOpacity 
            style={styles.ctaButton}
            onPress={() => router.push('/planting/step1')}
          >
            <Text style={styles.ctaButtonText}>Get Started Free →</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>Quick Access</Text>
          <View style={styles.footerGrid}>
            <TouchableOpacity 
              style={styles.footerCard}
              onPress={() => router.push('/planting/step1')}
            >
              <MaterialIcons name="add-location" size={24} color="#4CAF50" />
              <Text style={styles.footerCardText}>New Field</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.footerCard}
              onPress={() => router.push('/planting/step2')}
            >
              <Ionicons name="analytics" size={24} color="#2196F3" />
              <Text style={styles.footerCardText}>Analyze Soil</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.footerCard}
              onPress={() => router.push('/planting/step3')}
            >
              <FontAwesome5 name="seedling" size={24} color="#FF9800" />
              <Text style={styles.footerCardText}>Layout</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.footerCard}
              onPress={() => router.push('/planting/planting')}
            >
              <MaterialCommunityIcons name="history" size={24} color="#9C27B0" />
              <Text style={styles.footerCardText}>History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  // Header with Back Button
  headerWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRightPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFEBEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerIconText: {
    fontSize: 32,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    letterSpacing: 1,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  heroSection: {
    padding: 20,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  heroDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  heroButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  visualizationContainer: {
    alignItems: 'center',
  },
  visualization: {
    width: '100%',
    height: 200,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  plantVisualization: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  plantRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  plantDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  analyticsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  analyticsItem: {
    alignItems: 'center',
  },
  analyticsLabel: {
    fontSize: 12,
    color: '#666',
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  visualizationCaption: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    padding: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  stepsContainer: {
    gap: 16,
  },
  stepCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  stepNumber: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  stepDetail: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  benefitsContainer: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
  ctaButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 20,
    backgroundColor: '#FFF',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  footerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerCard: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    width: '23%',
  },
  footerCardText: {
    fontSize: 12,
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
});