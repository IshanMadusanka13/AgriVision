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
import {
  getGrowthStageConfigAdmin,
  updateGrowthStageConfigAdmin,
  getConditionsConfig,
  updateConditionsConfig,
  GrowthStageConfig,
  ConditionsConfig,
} from '../../services/api';

export default function GrowthAnalysisSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<GrowthStageConfig[]>([]);
  const [conditions, setConditions] = useState<ConditionsConfig>({
    ph_critical_low: 5.5,
    ph_low: 6.0,
    ph_high: 6.8,
    humidity_very_high: 85,
    humidity_high: 75,
    humidity_low: 50,
    temp_very_high: 32,
    temp_high: 28,
    temp_low: 15,
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) return;
      const userData = JSON.parse(userDataString);

      const [stages, cond] = await Promise.all([
        getGrowthStageConfigAdmin(userData.email),
        getConditionsConfig(userData.email),
      ]);
      setConfigs(stages);
      if (cond) setConditions(cond);
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

      await Promise.all([
        updateGrowthStageConfigAdmin(userData.email, configs),
        updateConditionsConfig(userData.email, conditions),
      ]);
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
    newConfigs[index] = { ...newConfigs[index], [field]: numValue };
    setConfigs(newConfigs);
  };

  const updateCondition = (field: keyof ConditionsConfig, value: string) => {
    setConditions(prev => ({ ...prev, [field]: parseFloat(value) || 0 }));
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
          Configure detection thresholds, optimal pH/humidity/temperature ranges, and alert condition thresholds.
        </Text>
      </View>

      {/* Per-stage detection thresholds + optimal env ranges */}
      {configs.map((config, index) => (
        <View key={config.stage} style={styles.stageCard}>
          <Text style={styles.stageTitle}>{getStageName(config.stage)}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detection Thresholds</Text>
            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Min Leaves</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.min_leaves)}
                  onChangeText={(v) => updateConfig(index, 'min_leaves', v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Max Leaves</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.max_leaves)}
                  onChangeText={(v) => updateConfig(index, 'max_leaves', v)}
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
                  onChangeText={(v) => updateConfig(index, 'min_flowers', v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Max Flowers</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.max_flowers)}
                  onChangeText={(v) => updateConfig(index, 'max_flowers', v)}
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
                  onChangeText={(v) => updateConfig(index, 'min_fruits', v)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Max Fruits</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.max_fruits)}
                  onChangeText={(v) => updateConfig(index, 'max_fruits', v)}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Optimal Ranges (this stage)</Text>
            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>pH Min</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.ph_min ?? '')}
                  onChangeText={(v) => updateConfig(index, 'ph_min', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 6.0"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>pH Max</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.ph_max ?? '')}
                  onChangeText={(v) => updateConfig(index, 'ph_max', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 6.8"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Humidity Min (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.humidity_min ?? '')}
                  onChangeText={(v) => updateConfig(index, 'humidity_min', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 50"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Humidity Max (%)</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.humidity_max ?? '')}
                  onChangeText={(v) => updateConfig(index, 'humidity_max', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 85"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Temp Min (°C)</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.temp_min ?? '')}
                  onChangeText={(v) => updateConfig(index, 'temp_min', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 20"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Temp Max (°C)</Text>
                <TextInput
                  style={styles.input}
                  value={String(config.temp_max ?? '')}
                  onChangeText={(v) => updateConfig(index, 'temp_max', v)}
                  keyboardType="numeric"
                  placeholder="e.g. 30"
                />
              </View>
            </View>
          </View>
        </View>
      ))}

      {/* Global alert condition thresholds */}
      <View style={styles.stageCard}>
        <Text style={styles.stageTitle}>Alert Condition Thresholds</Text>
        <Text style={styles.sectionDescription}>
          Define the thresholds that trigger warnings and tips for pH, humidity, and temperature.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>pH Thresholds</Text>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Critical Low</Text>
              <TextInput
                style={styles.input}
                value={String(conditions.ph_critical_low)}
                onChangeText={(v) => updateCondition('ph_critical_low', v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Low</Text>
              <TextInput
                style={styles.input}
                value={String(conditions.ph_low)}
                onChangeText={(v) => updateCondition('ph_low', v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>High</Text>
              <TextInput
                style={styles.input}
                value={String(conditions.ph_high)}
                onChangeText={(v) => updateCondition('ph_high', v)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Humidity Thresholds (%)</Text>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Very High</Text>
              <TextInput
                style={styles.input}
                value={String(conditions.humidity_very_high)}
                onChangeText={(v) => updateCondition('humidity_very_high', v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>High</Text>
              <TextInput
                style={styles.input}
                value={String(conditions.humidity_high)}
                onChangeText={(v) => updateCondition('humidity_high', v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Low</Text>
              <TextInput
                style={styles.input}
                value={String(conditions.humidity_low)}
                onChangeText={(v) => updateCondition('humidity_low', v)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Temperature Thresholds (°C)</Text>
          <View style={styles.row}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Very High</Text>
              <TextInput
                style={styles.input}
                value={String(conditions.temp_very_high)}
                onChangeText={(v) => updateCondition('temp_very_high', v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>High</Text>
              <TextInput
                style={styles.input}
                value={String(conditions.temp_high)}
                onChangeText={(v) => updateCondition('temp_high', v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Low</Text>
              <TextInput
                style={styles.input}
                value={String(conditions.temp_low)}
                onChangeText={(v) => updateCondition('temp_low', v)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      </View>

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
  sectionDescription: {
    fontSize: 13,
    color: '#6b7280',
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
