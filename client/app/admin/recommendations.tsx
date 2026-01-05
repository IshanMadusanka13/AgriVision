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
  getRecommendationsMetadata,
  updateRecommendationsMetadata,
} from '../../services/api';

export default function EditRecommendations() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [newWarning, setNewWarning] = useState('');
  const [newTip, setNewTip] = useState('');

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) return;

      const userData = JSON.parse(userDataString);
      const data = await getRecommendationsMetadata(userData.email);
      setWarnings(data.warnings || []);
      setTips(data.tips || []);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      Alert.alert('Error', 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const saveRecommendations = async () => {
    try {
      setSaving(true);
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) return;

      const userData = JSON.parse(userDataString);
      await updateRecommendationsMetadata(userData.email, warnings, tips);
      Alert.alert('Success', 'Recommendations updated successfully');
    } catch (error) {
      console.error('Error saving recommendations:', error);
      Alert.alert('Error', 'Failed to save recommendations');
    } finally {
      setSaving(false);
    }
  };

  const addWarning = () => {
    if (newWarning.trim()) {
      setWarnings([...warnings, newWarning.trim()]);
      setNewWarning('');
    }
  };

  const removeWarning = (index: number) => {
    setWarnings(warnings.filter((_, i) => i !== index));
  };

  const addTip = () => {
    if (newTip.trim()) {
      setTips([...tips, newTip.trim()]);
      setNewTip('');
    }
  };

  const removeTip = (index: number) => {
    setTips(tips.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading recommendations...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Warnings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚠️ Warnings</Text>
        <Text style={styles.sectionDescription}>
          Warnings shown to users based on their plant conditions
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add new warning..."
            value={newWarning}
            onChangeText={setNewWarning}
            multiline
          />
          <TouchableOpacity style={styles.addButton} onPress={addWarning}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {warnings.map((warning, index) => (
          <View key={index} style={styles.itemCard}>
            <Text style={styles.itemText}>{warning}</Text>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeWarning(index)}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Tips Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 Tips</Text>
        <Text style={styles.sectionDescription}>
          Helpful tips shown to users for plant care
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Add new tip..."
            value={newTip}
            onChangeText={setNewTip}
            multiline
          />
          <TouchableOpacity style={styles.addButton} onPress={addTip}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {tips.map((tip, index) => (
          <View key={index} style={styles.itemCard}>
            <Text style={styles.itemText}>{tip}</Text>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeTip(index)}
            >
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveRecommendations}
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
  section: {
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 50,
  },
  addButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  itemCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  removeButtonText: {
    color: '#ef4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    margin: 16,
    marginTop: 0,
    marginBottom: 32,
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
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
