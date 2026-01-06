// app/planting/algorithm-visualizer.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons ,MaterialCommunityIcons } from '@expo/vector-icons';

export default function AlgorithmVisualizer() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const steps = [
    {
      title: 'Random Layouts',
      description: 'Start with 5 different planting layouts',
      icon: 'shuffle',
      color: '#4CAF50',
      layouts: [
        { row: '0.7m', plant: '0.5m', score: '30%' },
        { row: '0.9m', plant: '0.7m', score: '35%' },
        { row: '0.6m', plant: '0.4m', score: '25%' },
        { row: '0.8m', plant: '0.6m', score: '40%' },
        { row: '0.5m', plant: '0.3m', score: '15%' },
      ],
      bestIndex: 3,
    },
    {
      title: 'Select Best',
      description: 'Pick the 3 best layouts',
      icon: 'star',
      color: '#FF9800',
      layouts: [
        { row: '0.9m', plant: '0.7m', score: '35%' },
        { row: '0.8m', plant: '0.6m', score: '40%' },
        { row: '0.7m', plant: '0.5m', score: '30%' },
      ],
      bestIndex: 1,
    },
    {
      title: 'Combine & Improve',
      description: 'Mix best layouts to create better ones',
      icon: 'git-branch',
      color: '#2196F3',
      layouts: [
        { row: '0.85m', plant: '0.65m', score: '52%' },
        { row: '0.9m', plant: '0.7m', score: '68%' },
        { row: '0.75m', plant: '0.55m', score: '38%' },
      ],
      bestIndex: 1,
    },
    {
      title: 'Optimal Layout Found',
      description: 'Best planting layout after optimization',
      icon: 'trophy',
      color: '#9C27B0',
      layouts: [
        { row: '0.9m', plant: '0.7m', score: '68%' },
      ],
      bestIndex: 0,
    },
  ];

  useEffect(() => {
    if (isPlaying && step < steps.length - 1) {
      const timer = setTimeout(() => {
        setStep(prev => prev + 1);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (isPlaying) {
      setIsPlaying(false);
    }
  }, [isPlaying, step]);

  const currentStep = steps[step];

  const handlePlayPause = () => {
    if (step === steps.length - 1) {
      setStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setStep(0);
    setIsPlaying(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Algorithm Demo</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.stepContainer}>
          {/* Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              {steps.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index <= step && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
            <Text style={styles.stepText}>
              Step {step + 1}: {currentStep.title}
            </Text>
          </View>

          {/* Current Step */}
          <View style={styles.currentStep}>
            <View style={[styles.iconContainer, { backgroundColor: currentStep.color }]}>
               

            </View>
            
            <Text style={styles.stepTitle}>{currentStep.title}</Text>
            <Text style={styles.stepDescription}>{currentStep.description}</Text>

            {/* Layout Visualization */}
            <View style={styles.layoutsContainer}>
              <Text style={styles.layoutsTitle}>
                {step === 3 ? 'Optimal Layout' : 'Current Layouts'}
              </Text>
              
              <View style={styles.layoutsGrid}>
                {currentStep.layouts.map((layout, index) => (
                  <View
                    key={index}
                    style={[
                      styles.layoutCard,
                      index === currentStep.bestIndex && styles.bestLayoutCard,
                    ]}
                  >
                    <View style={styles.layoutHeader}>
                      <Text style={styles.layoutTitle}>Layout {index + 1}</Text>
                      {index === currentStep.bestIndex && (
                        <Ionicons name="star" size={16} color="#FFD700" />
                      )}
                    </View>
                    
                    <View style={styles.layoutDetails}>
                      <View style={styles.layoutItem}>
                        <Text style={styles.layoutLabel}>Row:</Text>
                        <Text style={styles.layoutValue}>{layout.row}</Text>
                      </View>
                      <View style={styles.layoutItem}>
                        <Text style={styles.layoutLabel}>Plant:</Text>
                        <Text style={styles.layoutValue}>{layout.plant}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.scoreContainer}>
                      <Text style={styles.scoreLabel}>Quality Score</Text>
                      <Text style={styles.scoreValue}>{layout.score}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Explanation */}
            <View style={styles.explanationBox}>
              <Ionicons name="bulb-outline" size={20} color="#FF9800" />
              <Text style={styles.explanationText}>
                {step === 0 && "Starting with random layouts to explore possibilities"}
                {step === 1 && "Selecting the best performers to build upon"}
                {step === 2 && "Mixing traits from best layouts to create improved versions"}
                {step === 3 && "Found the optimal layout for maximum yield!"}
              </Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={handleReset}>
              <Ionicons name="refresh" size={20} color="#666" />
              <Text style={styles.controlText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.playButton} 
              onPress={handlePlayPause}
            >
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={24} 
                color="#FFF" 
              />
              <Text style={styles.playText}>
                {isPlaying ? 'Pause' : step === steps.length - 1 ? 'Restart' : 'Play Demo'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.controlButton}
              onPress={() => {
                if (step < steps.length - 1) setStep(prev => prev + 1);
              }}
              disabled={step === steps.length - 1}
            >
              <Ionicons 
                name="chevron-forward" 
                size={20} 
                color={step === steps.length - 1 ? '#CCC' : '#666'} 
              />
              <Text style={[
                styles.controlText,
                step === steps.length - 1 && styles.controlTextDisabled
              ]}>
                Next
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.stats}>
            <Text style={styles.statsTitle}>Results</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>+25%</Text>
                <Text style={styles.statLabel}>Yield Increase</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>-40%</Text>
                <Text style={styles.statLabel}>Disease Risk</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>92%</Text>
                <Text style={styles.statLabel}>AI Accuracy</Text>
              </View>
            </View>
          </View>
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
  progressContainer: {
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
    marginBottom: 10,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e9ecef',
  },
  progressDotActive: {
    backgroundColor: '#4CAF50',
  },
  stepText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  currentStep: {
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  layoutsContainer: {
    width: '100%',
    marginBottom: 20,
  },
  layoutsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  layoutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  layoutCard: {
    width: '45%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  bestLayoutCard: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  layoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  layoutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  layoutDetails: {
    marginBottom: 10,
  },
  layoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  layoutLabel: {
    fontSize: 12,
    color: '#666',
  },
  layoutValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  scoreContainer: {
    backgroundColor: '#FFF',
    padding: 8,
    borderRadius: 5,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  explanationBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  explanationText: {
    flex: 1,
    fontSize: 14,
    color: '#FF8F00',
    marginLeft: 10,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  controlButton: {
    alignItems: 'center',
    padding: 10,
    minWidth: 60,
  },
  controlText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  controlTextDisabled: {
    color: '#CCC',
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    marginHorizontal: 20,
  },
  playText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  stats: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 10,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
});