// app/planting/step2.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; // Fixed spacing here

const { width } = Dimensions.get('window');

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
      'sandy loam': {
        'tropical': { row: 0.85, plant: 0.55 },
        'temperate': { row: 0.95, plant: 0.65 },
        'arid': { row: 1.05, plant: 0.75 },
      },
      'clay loam': {
        'tropical': { row: 0.95, plant: 0.65 },
        'temperate': { row: 1.05, plant: 0.75 },
        'arid': { row: 1.15, plant: 0.85 },
      },
    };
    
    await new Promise(resolve => setTimeout(resolve, 500));
    return spacingMap[soilType]?.[climate] || { row: 0.9, plant: 0.6 };
  },

  analyzeSoil: async (ph: number, organicMatter: number, soilType: string) => {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    let score = 0;
    if (ph >= 6.0 && ph <= 7.0) score += 40;
    else if (ph >= 5.5 && ph <= 7.5) score += 20;
    
    if (organicMatter >= 3.0) score += 40;
    else if (organicMatter >= 1.5) score += 20;
    
    if (soilType === 'loam') score += 20;
    else if (soilType === 'sandy loam') score += 15;
    else if (soilType === 'clay loam') score += 10;
    else if (soilType === 'sandy') score += 5;
    
    const suitability = score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low';
    
    return {
      score,
      suitability,
      recommendations: [
        score < 60 ? 'Consider soil amendment before planting' : '',
        ph < 6.0 ? 'Add lime to raise pH' : ph > 7.0 ? 'Add sulfur to lower pH' : '',
        organicMatter < 3.0 ? 'Add compost or organic fertilizer' : '',
      ].filter(rec => rec !== ''),
    };
  },
};

// Soil type options
const SOIL_TYPES = [
  { label: 'Sandy', value: 'sandy' },
  { label: 'Loam', value: 'loam' },
  { label: 'Clay', value: 'clay' },
  { label: 'Sandy Loam', value: 'sandy loam' },
  { label: 'Clay Loam', value: 'clay loam' },
];

export default function Step2Screen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [soilPH, setSoilPH] = useState('6.5');
  const [soilType, setSoilType] = useState('loam');
  const [organicMatter, setOrganicMatter] = useState('3.5');
  const [climateZone, setClimateZone] = useState('tropical');
  const [spacingResult, setSpacingResult] = useState<any>(null);
  const [soilAnalysis, setSoilAnalysis] = useState<any>(null);
  const [showSoilTypeModal, setShowSoilTypeModal] = useState(false);

  const calculateSpacing = async () => {
    setLoading(true);
    try {
      const spacing = await mockAPI.calculateSpacing(soilType, climateZone);
      setSpacingResult(spacing);
      
      Alert.alert(
        'Spacing Calculated',
        `Recommended spacing: ${spacing.row}m between rows, ${spacing.plant}m between plants`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to calculate spacing');
    } finally {
      setLoading(false);
    }
  };

  const analyzeSoil = async () => {
    if (!soilPH || !organicMatter) {
      Alert.alert('Error', 'Please enter all soil parameters');
      return;
    }
    
    setLoading(true);
    try {
      const analysis = await mockAPI.analyzeSoil(
        parseFloat(soilPH),
        parseFloat(organicMatter),
        soilType
      );
      setSoilAnalysis(analysis);
      
      Alert.alert(
        'Soil Analysis Complete',
        `Suitability: ${analysis.suitability}\nScore: ${analysis.score}/100`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to analyze soil');
    } finally {
      setLoading(false);
    }
  };

  const getSoilTypeLabel = () => {
    const soil = SOIL_TYPES.find(st => st.value === soilType);
    return soil ? soil.label : 'Select Soil Type';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Step 2: Soil Analysis</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Soil Parameters Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Soil Parameters</Text>
          
          <View style={styles.inputRow}>
            <View style={styles.inputColumn}>
              <Text style={styles.label}>Soil pH</Text>
              <TextInput
                style={styles.input}
                value={soilPH}
                onChangeText={setSoilPH}
                keyboardType="decimal-pad"
                placeholder="6.5"
                placeholderTextColor="#999"
              />
            </View>
            
            <View style={styles.inputColumn}>
              <Text style={styles.label}>Organic Matter (%)</Text>
              <TextInput
                style={styles.input}
                value={organicMatter}
                onChangeText={setOrganicMatter}
                keyboardType="decimal-pad"
                placeholder="3.5"
                placeholderTextColor="#999"
              />
            </View>
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Soil Type</Text>
            <TouchableOpacity 
              style={styles.dropdownButton}
              onPress={() => setShowSoilTypeModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownButtonText}>{getSoilTypeLabel()}</Text>
              <Ionicons name="chevron-down" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Climate Zone Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Climate Zone</Text>
          <View style={styles.climateButtons}>
            {['tropical', 'temperate', 'arid'].map((zone) => (
              <TouchableOpacity
                key={zone}
                style={[
                  styles.climateButton,
                  climateZone === zone && styles.climateButtonActive,
                ]}
                onPress={() => setClimateZone(zone)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.climateButtonText,
                  climateZone === zone && styles.climateButtonTextActive,
                ]}>
                  {zone.charAt(0).toUpperCase() + zone.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={analyzeSoil}
              disabled={loading}
              activeOpacity={0.7}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="flask-outline" size={24} color="#4CAF50" />
                <Text style={styles.actionButtonText}>Analyze Soil</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={calculateSpacing}
              disabled={loading}
              activeOpacity={0.7}
            >
              <View style={styles.actionButtonContent}>
                <Ionicons name="calculator-outline" size={24} color="#4CAF50" />
                <Text style={styles.actionButtonText}>Calculate Spacing</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Results Section */}
        {soilAnalysis && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Soil Analysis Results</Text>
            <View style={styles.resultCard}>
              <View style={styles.scoreContainer}>
                <View style={styles.scoreCircle}>
                  <Text style={styles.scoreText}>{soilAnalysis.score}</Text>
                  <Text style={styles.scoreLabel}>/100</Text>
                </View>
                <View style={styles.scoreDetails}>
                  <Text style={styles.suitabilityText}>
                    Suitability: <Text style={styles.suitabilityValue}>{soilAnalysis.suitability}</Text>
                  </Text>
                  <Text style={styles.soilTypeText}>
                    Soil Type: {getSoilTypeLabel()}
                  </Text>
                </View>
              </View>
              
              {soilAnalysis.recommendations.length > 0 && (
                <View style={styles.recommendations}>
                  <Text style={styles.recommendationsTitle}>Recommendations:</Text>
                  {soilAnalysis.recommendations.map((rec: string, index: number) => (
                    <View key={index} style={styles.recommendationItem}>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#4CAF50" />
                      <Text style={styles.recommendationText}>{rec}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Spacing Results */}
        {spacingResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Spacing Recommendations</Text>
            <View style={styles.resultCard}>
              <View style={styles.spacingContainer}>
                <View style={styles.spacingItem}>
                  <MaterialCommunityIcons name="arrow-split-vertical" size={28} color="#4CAF50" />
                  <View style={styles.spacingDetails}>
                    <Text style={styles.spacingLabel}>Row Spacing</Text>
                    <Text style={styles.spacingValue}>{spacingResult.row}m</Text>
                  </View>
                </View>
                
                <View style={styles.spacingDivider} />
                
                <View style={styles.spacingItem}>
                  <MaterialCommunityIcons name="arrow-expand-vertical" size={28} color="#4CAF50" />
                  <View style={styles.spacingDetails}>
                    <Text style={styles.spacingLabel}>Plant Spacing</Text>
                    <Text style={styles.spacingValue}>{spacingResult.plant}m</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.spacingNote}>
                Optimal for Scotch Bonnet peppers in {climateZone} climate
              </Text>
            </View>
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonSecondary]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.navButtonSecondaryText}>Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.navButton, styles.navButtonPrimary, (!soilAnalysis || !spacingResult) && styles.buttonDisabled]}
            onPress={() => router.push('/planting/step3')}
            disabled={!soilAnalysis || !spacingResult}
            activeOpacity={0.7}
          >
            <Text style={styles.navButtonPrimaryText}>Generate Layout</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Soil Type Modal */}
      <Modal
        visible={showSoilTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSoilTypeModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowSoilTypeModal(false)}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Soil Type</Text>
                <TouchableOpacity 
                  onPress={() => setShowSoilTypeModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalList}>
                {SOIL_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.modalOption,
                      soilType === type.value && styles.modalOptionSelected,
                    ]}
                    onPress={() => {
                      setSoilType(type.value);
                      setShowSoilTypeModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.modalOptionText,
                      soilType === type.value && styles.modalOptionTextSelected,
                    ]}>
                      {type.label}
                    </Text>
                    {soilType === type.value && (
                      <Ionicons name="checkmark" size={20} color="#4CAF50" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
  },
  headerRightSpacer: {
    width: 32,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inputColumn: {
    flex: 1,
    marginHorizontal: 4,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555555',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333333',
    minHeight: 50,
  },
  dropdownButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 50,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333333',
  },
  climateButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  climateButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  climateButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  climateButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
  },
  climateButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 16,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 20,
  },
  scoreText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#666666',
    marginTop: -6,
  },
  scoreDetails: {
    flex: 1,
  },
  suitabilityText: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 4,
  },
  suitabilityValue: {
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  soilTypeText: {
    fontSize: 14,
    color: '#666666',
  },
  recommendations: {
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    paddingTop: 16,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  spacingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  spacingItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacingDetails: {
    marginLeft: 12,
  },
  spacingLabel: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  spacingValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  spacingDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#EEEEEE',
    marginHorizontal: 20,
  },
  spacingNote: {
    fontSize: 14,
    color: '#666666',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 10,
  },
  navButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  navButtonPrimary: {
    backgroundColor: '#4CAF50',
  },
  navButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  navButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonSecondaryText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalList: {
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modalOptionSelected: {
    backgroundColor: '#F0F9F0',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333333',
  },
  modalOptionTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333333',
    fontWeight: '500',
  },
});