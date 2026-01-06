// app/planting/step3.tsx - UPDATED VERSION (No Map)
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const mockAPI = {
  generateLayout: async (area: number, spacing: any, boundary: any[]) => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const plantCount = Math.floor((area * 4046.86) / (spacing.row * spacing.plant));
    const rows = Math.floor(Math.sqrt(plantCount) * 0.8);
    const plantsPerRow = Math.floor(plantCount / rows);
    
    return {
      plantCount,
      rows,
      plantsPerRow,
      efficiency: Math.floor((plantCount / (area * 100)) * 100),
      spacing: {
        betweenRows: spacing.row.toFixed(2) + 'm',
        betweenPlants: spacing.plant.toFixed(2) + 'm',
      },
    };
  },
};

// Plant Grid Visualization Component
const PlantGridVisualization = ({ rows, plantsPerRow }: { rows: number; plantsPerRow: number }) => {
  // Limit visualization for performance
  const maxRows = Math.min(rows, 10);
  const maxPlantsPerRow = Math.min(plantsPerRow, 10);
  
  return (
    <View style={styles.gridContainer}>
      <Text style={styles.gridTitle}>Planting Pattern (Sample)</Text>
      <Text style={styles.gridSubtitle}>Rows: {rows} × Plants per row: {plantsPerRow}</Text>
      
      <View style={styles.grid}>
        {Array.from({ length: maxRows }).map((_, rowIndex) => (
          <View key={`row-${rowIndex}`} style={styles.gridRow}>
            {Array.from({ length: maxPlantsPerRow }).map((_, plantIndex) => (
              <View key={`plant-${rowIndex}-${plantIndex}`} style={styles.plantDot}>
                <Ionicons name="leaf" size={12} color="#4CAF50" />
              </View>
            ))}
            {plantsPerRow > maxPlantsPerRow && (
              <Text style={styles.ellipsis}>... +{plantsPerRow - maxPlantsPerRow} more</Text>
            )}
          </View>
        ))}
        {rows > maxRows && (
          <View style={styles.moreRows}>
            <Text style={styles.ellipsis}>... +{rows - maxRows} more rows</Text>
          </View>
        )}
      </View>
      
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={styles.legendText}>Plant position</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: '#E0E0E0' }]} />
          <Text style={styles.legendText}>Row spacing: 0.9m</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={styles.legendText}>Plant spacing: 0.6m</Text>
        </View>
      </View>
    </View>
  );
};

export default function Step3Screen() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [layoutResult, setLayoutResult] = useState<any>(null);
  const [fertilizerRecommendation, setFertilizerRecommendation] = useState<any>(null);
  const [fieldArea, setFieldArea] = useState<number>(1); // in acres

  const generateLayout = async () => {
    setLoading(true);
    try {
      // In a real app, these would come from previous steps
      const mockSpacing = { row: 0.9, plant: 0.6 };
      const mockBoundary: any[] = []; // Not used in visualization
      
      const layout = await mockAPI.generateLayout(
        fieldArea,
        mockSpacing,
        mockBoundary
      );
      setLayoutResult(layout);
      
      // Generate fertilizer recommendation based on field area
      const fertilizer = generateFertilizerRecommendation(fieldArea);
      setFertilizerRecommendation(fertilizer);
      
      Alert.alert(
        'Layout Generated',
        `Successfully generated optimal layout for ${layout.plantCount.toLocaleString()} plants`
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to generate layout');
    } finally {
      setLoading(false);
    }
  };

  const generateFertilizerRecommendation = (area: number) => {
    // Simple recommendation based on area
    const amountPerHectare = 500;
    const totalAmount = (area * 0.404686 * amountPerHectare).toFixed(0);
    
    return {
      type: 'Enhanced',
      npk: '12-24-12',
      amount: `${totalAmount} kg (500 kg/ha)`,
      timing: 'Apply at planting, 3 weeks, and 6 weeks after',
      notes: 'Consider adding compost to improve organic matter',
      area: `${area} acres (${(area * 0.404686).toFixed(2)} ha)`,
    };
  };

  const resetField = () => {
    setLayoutResult(null);
    setFertilizerRecommendation(null);
    router.push('/planting/planting');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Step 3: Planting Layout</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.stepContainer}>
          {/* Field Area Input */}
          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Field Area</Text>
            <View style={styles.areaInputContainer}>
              <View style={styles.areaInput}>
                <Text style={styles.areaValue}>{fieldArea}</Text>
                <Text style={styles.areaUnit}>acres</Text>
              </View>
              <View style={styles.areaButtons}>
                <TouchableOpacity
                  style={styles.areaButton}
                  onPress={() => setFieldArea(Math.max(0.1, fieldArea - 0.5))}
                >
                  <Ionicons name="remove" size={20} color="#333" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.areaButton}
                  onPress={() => setFieldArea(fieldArea + 0.5)}
                >
                  <Ionicons name="add" size={20} color="#333" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.areaNote}>
              Approx. {(fieldArea * 0.404686).toFixed(2)} hectares
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={generateLayout}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="grid" size={20} color="#FFF" />
                <Text style={styles.buttonText}>Generate Optimal Planting Layout</Text>
              </>
            )}
          </TouchableOpacity>
          
          {layoutResult && (
            <>
              {/* Layout Statistics */}
              <View style={styles.layoutResults}>
                <View style={styles.statCard}>
                  <Ionicons name="leaf" size={30} color="#4CAF50" />
                  <Text style={styles.statNumber}>{layoutResult.plantCount.toLocaleString()}</Text>
                  <Text style={styles.statLabel}>Total Plants</Text>
                </View>
                
                <View style={styles.statCard}>
                  <Ionicons name="trending-up" size={30} color="#2196F3" />
                  <Text style={styles.statNumber}>{layoutResult.efficiency}%</Text>
                  <Text style={styles.statLabel}>Field Efficiency</Text>
                </View>
                
                <View style={styles.statCard}>
                  <Ionicons name="layers" size={30} color="#FF9800" />
                  <Text style={styles.statNumber}>{layoutResult.rows}</Text>
                  <Text style={styles.statLabel}>Rows</Text>
                </View>
                
                <View style={styles.statCard}>
                  <Ionicons name="analytics" size={30} color="#9C27B0" />
                  <Text style={styles.statNumber}>{layoutResult.plantsPerRow}</Text>
                  <Text style={styles.statLabel}>Plants/Row</Text>
                </View>
              </View>
              
              {/* Spacing Information */}
              <View style={styles.spacingCard}>
                <Text style={styles.cardTitle}>Recommended Spacing</Text>
                <View style={styles.spacingGrid}>
                  <View style={styles.spacingItem}>
                    <MaterialCommunityIcons name="arrow-expand-horizontal" size={24} color="#4CAF50" />
                    <Text style={styles.spacingValue}>{layoutResult.spacing.betweenRows}</Text>
                    <Text style={styles.spacingLabel}>Between rows</Text>
                  </View>
                  <View style={styles.spacingItem}>
                    <MaterialCommunityIcons name="arrow-expand-vertical" size={24} color="#2196F3" />
                    <Text style={styles.spacingValue}>{layoutResult.spacing.betweenPlants}</Text>
                    <Text style={styles.spacingLabel}>Between plants</Text>
                  </View>
                </View>
              </View>
              
              {/* Plant Grid Visualization */}
              <PlantGridVisualization 
                rows={layoutResult.rows} 
                plantsPerRow={layoutResult.plantsPerRow} 
              />
              
              {/* AI Algorithm Button */}
              <TouchableOpacity
                style={styles.aiButton}
                onPress={() => router.push('/planting/algorithm-visualizer')}
              >
                <View style={styles.aiButtonContent}>
                  <MaterialCommunityIcons name="robot-outline" size={24} color="#9C27B0" />
                  <View style={styles.aiButtonTextContainer}>
                    <Text style={styles.aiButtonTitle}>See How AI Found This Layout</Text>
                    <Text style={styles.aiButtonSubtitle}>
                      Watch the genetic algorithm optimization process
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </View>
              </TouchableOpacity>
            </>
          )}
          
          {fertilizerRecommendation && (
            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationTitle}>🌱 Fertilizer Advisory</Text>
              
              <View style={styles.fieldAreaDisplay}>
                <Ionicons name="location" size={16} color="#666" />
                <Text style={styles.fieldAreaText}>
                  Field Area: {fertilizerRecommendation.area}
                </Text>
              </View>
              
              <View style={styles.fertilizerGrid}>
                <View style={styles.fertilizerItem}>
                  <Text style={styles.fertilizerLabel}>Type</Text>
                  <Text style={styles.fertilizerValue}>{fertilizerRecommendation.type}</Text>
                </View>
                <View style={styles.fertilizerItem}>
                  <Text style={styles.fertilizerLabel}>NPK Ratio</Text>
                  <Text style={styles.fertilizerValue}>{fertilizerRecommendation.npk}</Text>
                </View>
                <View style={styles.fertilizerItem}>
                  <Text style={styles.fertilizerLabel}>Amount</Text>
                  <Text style={styles.fertilizerValue}>{fertilizerRecommendation.amount}</Text>
                </View>
              </View>
              
              <View style={styles.timingCard}>
                <Ionicons name="calendar" size={16} color="#FF9800" />
                <Text style={styles.fertilizerTiming}>
                  Timing: {fertilizerRecommendation.timing}
                </Text>
              </View>
              
              <View style={styles.notesCard}>
                <Ionicons name="bulb" size={16} color="#4CAF50" />
                <Text style={styles.fertilizerNotes}>
                  Notes: {fertilizerRecommendation.notes}
                </Text>
              </View>
            </View>
          )}
          
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, { flex: 1, marginRight: 10 }]}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryButtonText}>Back to Analysis</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, styles.successButton, { flex: 1 }]}
              onPress={resetField}
            >
              <Ionicons name="refresh" size={20} color="#FFF" />
              <Text style={styles.buttonText}>New Field</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Optimizing planting layout...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 16,
  },
  inputCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  areaInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  areaInput: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  areaValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
  },
  areaUnit: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  areaButtons: {
    flexDirection: 'row',
  },
  areaButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  areaNote: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
  },
  secondaryButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  successButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  layoutResults: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  spacingCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  spacingGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  spacingItem: {
    alignItems: 'center',
  },
  spacingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  spacingLabel: {
    fontSize: 14,
    color: '#666',
  },
  gridContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  gridSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  grid: {
    alignItems: 'center',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  plantDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0F9F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  ellipsis: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  moreRows: {
    alignItems: 'center',
    marginTop: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  legendItem: {
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  legendLine: {
    width: 24,
    height: 2,
    marginBottom: 4,
  },
  legendText: {
    fontSize: 10,
    color: '#666',
  },
  aiButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  aiButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiButtonTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  aiButtonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  aiButtonSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  recommendationCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recommendationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  fieldAreaDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 8,
    borderRadius: 6,
    marginBottom: 16,
  },
  fieldAreaText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  fertilizerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  fertilizerItem: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fertilizerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  fertilizerValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  notesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    padding: 12,
    borderRadius: 8,
  },
  fertilizerTiming: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  fertilizerNotes: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#333',
  },
});