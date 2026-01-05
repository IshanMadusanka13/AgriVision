import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GrowthStageConfig {
  stage: string;
  min_leaves: number;
  max_leaves: number;
  min_flowers: number;
  max_flowers: number;
  min_fruits: number;
  max_fruits: number;
  nitrogen_min: number;
  nitrogen_max: number;
  phosphorus_min: number;
  phosphorus_max: number;
  potassium_min: number;
  potassium_max: number;
}

export default function GrowthAnalysisSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<GrowthStageConfig[]>([]);

  useEffect(() => {
    fetchGrowthStageConfig();
  }, []);

  const fetchGrowthStageConfig = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) return;

      const userData = JSON.parse(userDataString);
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.8.167:8000';

      const response = await fetch(`${API_URL}/api/admin/growth-stage/config`, {
        headers: {
          'X-User-Email': userData.email,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch config');
      }

      const data = await response.json();
      setConfigs(data.config.stages || []);
    } catch (error) {
      console.error('Error fetching config:', error);
      Alert.alert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) return;

      const userData = JSON.parse(userDataString);
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.8.167:8000';

      const response = await fetch(`${API_URL}/api/admin/growth-stage/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Email': userData.email,
        },
        body: JSON.stringify({
          configs,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save config');
      }

      Alert.alert('Success', 'Settings updated successfully');
    } catch (error) {
      console.error('Error saving config:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (index: number, field: keyof GrowthStageConfig, value: string) => {
    const newConfigs = [...configs];
    const numValue = parseFloat(value) || 0;
    newConfigs[index] = {
      ...newConfigs[index],
      [field]: numValue,
    };
    setConfigs(newConfigs);
  };

  const getStageName = (stage: string): string => {
    const stageNames: { [key: string]: string } = {
      early_vegetative: 'Early Vegetative',
      vegetative: 'Vegetative',
      flowering: 'Flowering',
      fruiting: 'Fruiting',
      ripening: 'Ripening',
    };
    return stageNames[stage] || stage;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Growth Stage Configuration</Text>
        <Text style={styles.headerDescription}>
          Configure NPK levels and detection thresholds for each growth stage
        </Text>
      </View>

      {configs.map((config, index) => (
        <View key={config.stage} style={styles.stageCard}>
          <Text style={styles.stageTitle}>{getStageName(config.stage)}</Text>

          {/* Detection Thresholds */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detection Thresholds</Text>
            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Min Leaves</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.min_leaves)}
                  onChangeText={(value) => updateConfig(index, 'min_leaves', value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Max Leaves</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.max_leaves)}
                  onChangeText={(value) => updateConfig(index, 'max_leaves', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Min Flowers</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.min_flowers)}
                  onChangeText={(value) => updateConfig(index, 'min_flowers', value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Max Flowers</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.max_flowers)}
                  onChangeText={(value) => updateConfig(index, 'max_flowers', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Min Fruits</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.min_fruits)}
                  onChangeText={(value) => updateConfig(index, 'min_fruits', value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Max Fruits</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.max_fruits)}
                  onChangeText={(value) => updateConfig(index, 'max_fruits', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* NPK Levels */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Optimal NPK Levels (mg/kg)</Text>
            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>N Min</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.nitrogen_min)}
                  onChangeText={(value) => updateConfig(index, 'nitrogen_min', value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>N Max</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.nitrogen_max)}
                  onChangeText={(value) => updateConfig(index, 'nitrogen_max', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>P Min</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.phosphorus_min)}
                  onChangeText={(value) => updateConfig(index, 'phosphorus_min', value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>P Max</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.phosphorus_max)}
                  onChangeText={(value) => updateConfig(index, 'phosphorus_max', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>K Min</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.potassium_min)}
                  onChangeText={(value) => updateConfig(index, 'potassium_min', value)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>K Max</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.potassium_max)}
                  onChangeText={(value) => updateConfig(index, 'potassium_max', value)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        </View>
      ))}

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveConfig}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  stageCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  stageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  saveButton: {
    margin: 16,
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 32,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
