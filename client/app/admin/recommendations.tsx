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
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getRecommendationsMetadata,
  updateRecommendationsMetadata,
  getFertilizerConfig,
  updateFertilizerConfig,
  getStageTipsConfig,
  updateStageTipsConfig,
  getConditionMessagesConfig,
  updateConditionMessagesConfig,
  FertilizerStageConfig,
  FertilizerDayPlan,
  StageTipsConfig,
  ConditionKeyConfig,
} from '../../services/api';

const STAGE_LABELS: { [key: string]: string } = {
  early_vegetative: 'Early Vegetative',
  vegetative: 'Vegetative',
  flowering: 'Flowering',
  fruiting: 'Fruiting',
  ripening: 'Ripening',
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const emptyDayPlan = (): FertilizerDayPlan => ({
  day: 'Monday',
  fertilizer_type: '',
  amount: '',
  method: '',
  watering: '',
});

export default function EditRecommendations() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Global warnings & tips
  const [warnings, setWarnings] = useState<string[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  const [newWarning, setNewWarning] = useState('');
  const [newTip, setNewTip] = useState('');

  // Fertilizer config
  const [fertilizerStages, setFertilizerStages] = useState<FertilizerStageConfig[]>([]);
  const [expandedFertStage, setExpandedFertStage] = useState<string | null>(null);
  const [addingPlanFor, setAddingPlanFor] = useState<string | null>(null);
  const [newPlan, setNewPlan] = useState<FertilizerDayPlan>(emptyDayPlan());

  // Stage tips config
  const [stageTips, setStageTips] = useState<StageTipsConfig[]>([]);
  const [expandedTipsStage, setExpandedTipsStage] = useState<string | null>(null);
  const [newTipInputs, setNewTipInputs] = useState<{ [stage: string]: string }>({});

  // Condition messages
  const [conditionMsgs, setConditionMsgs] = useState<ConditionKeyConfig[]>([]);
  const [expandedCondKey, setExpandedCondKey] = useState<string | null>(null);
  const [newCondInputs, setNewCondInputs] = useState<{ [key: string]: { warning: string; tip: string } }>({});

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) return;
      const userData = JSON.parse(userDataString);

          const [meta, fertilizers, stageT, condMsgs] = await Promise.all([
        getRecommendationsMetadata(userData.email),
        getFertilizerConfig(userData.email),
        getStageTipsConfig(userData.email),
        getConditionMessagesConfig(userData.email),
      ]);

      setWarnings(meta.warnings || []);
      setTips(meta.tips || []);
      setFertilizerStages(fertilizers);
      setStageTips(stageT);
      setConditionMsgs(condMsgs);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      Alert.alert('Error', 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const saveAll = async () => {
    try {
      setSaving(true);
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) return;
      const userData = JSON.parse(userDataString);

      await Promise.all([
        updateRecommendationsMetadata(userData.email, warnings, tips),
        updateFertilizerConfig(userData.email, fertilizerStages),
        updateStageTipsConfig(userData.email, stageTips),
        updateConditionMessagesConfig(userData.email, conditionMsgs),
      ]);
      Alert.alert('Success', 'All recommendations updated successfully');
    } catch (error) {
      console.error('Error saving recommendations:', error);
      Alert.alert('Error', 'Failed to save recommendations');
    } finally {
      setSaving(false);
    }
  };

  // Global warnings helpers
  const addWarning = () => {
    if (newWarning.trim()) { setWarnings([...warnings, newWarning.trim()]); setNewWarning(''); }
  };
  const removeWarning = (i: number) => setWarnings(warnings.filter((_, idx) => idx !== i));

  // Global tips helpers
  const addGlobalTip = () => {
    if (newTip.trim()) { setTips([...tips, newTip.trim()]); setNewTip(''); }
  };
  const removeGlobalTip = (i: number) => setTips(tips.filter((_, idx) => idx !== i));

  // Fertilizer helpers
  const removeDayPlan = (stageKey: string, planIndex: number) => {
    setFertilizerStages(prev =>
      prev.map(s => s.stage === stageKey ? { ...s, plan: s.plan.filter((_, i) => i !== planIndex) } : s)
    );
  };

  const updateDayPlan = (stageKey: string, planIndex: number, field: keyof FertilizerDayPlan, value: string) => {
    setFertilizerStages(prev =>
      prev.map(s =>
        s.stage === stageKey
          ? { ...s, plan: s.plan.map((p, i) => i === planIndex ? { ...p, [field]: value } : p) }
          : s
      )
    );
  };

  const startAddPlan = (stageKey: string) => {
    setAddingPlanFor(stageKey);
    setNewPlan(emptyDayPlan());
  };

  const confirmAddPlan = () => {
    if (!addingPlanFor || !newPlan.fertilizer_type.trim()) {
      Alert.alert('Error', 'Please fill in at least the fertilizer type.');
      return;
    }
    setFertilizerStages(prev =>
      prev.map(s => s.stage === addingPlanFor ? { ...s, plan: [...s.plan, { ...newPlan }] } : s)
    );
    setAddingPlanFor(null);
    setNewPlan(emptyDayPlan());
  };

  // Stage tips helpers
  const removeStageTip = (stageKey: string, tipIndex: number) => {
    setStageTips(prev =>
      prev.map(s => s.stage === stageKey ? { ...s, tips: s.tips.filter((_, i) => i !== tipIndex) } : s)
    );
  };

  const addStageTip = (stageKey: string) => {
    const text = (newTipInputs[stageKey] || '').trim();
    if (!text) return;
    setStageTips(prev =>
      prev.map(s => s.stage === stageKey ? { ...s, tips: [...s.tips, text] } : s)
    );
    setNewTipInputs(prev => ({ ...prev, [stageKey]: '' }));
  };

  // Condition messages helpers
  const removeCondMsg = (condKey: string, type: 'warning' | 'tip', idx: number) => {
    setConditionMsgs(prev =>
      prev.map(c =>
        c.condition_key === condKey
          ? { ...c, [type === 'warning' ? 'warnings' : 'tips']: c[type === 'warning' ? 'warnings' : 'tips'].filter((_, i) => i !== idx) }
          : c
      )
    );
  };

  const addCondMsg = (condKey: string, type: 'warning' | 'tip') => {
    const field = type === 'warning' ? 'warning' : 'tip';
    const text = (newCondInputs[condKey]?.[field] || '').trim();
    if (!text) return;
    setConditionMsgs(prev =>
      prev.map(c =>
        c.condition_key === condKey
          ? { ...c, [type === 'warning' ? 'warnings' : 'tips']: [...c[type === 'warning' ? 'warnings' : 'tips'], text] }
          : c
      )
    );
    setNewCondInputs(prev => ({ ...prev, [condKey]: { ...prev[condKey], [field]: '' } }));
  };

  const getCondInput = (condKey: string, field: 'warning' | 'tip') =>
    newCondInputs[condKey]?.[field] || '';

  const setCondInput = (condKey: string, field: 'warning' | 'tip', value: string) =>
    setNewCondInputs(prev => ({ ...prev, [condKey]: { ...(prev[condKey] || { warning: '', tip: '' }), [field]: value } }));

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

      {/* ---- Fertilizer Plans ---- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fertilizer Plans</Text>
        <Text style={styles.sectionDescription}>Manage the weekly fertilizer schedule for each growth stage.</Text>

        {fertilizerStages.map((stage) => (
          <View key={stage.stage} style={styles.stageCard}>
            <TouchableOpacity
              style={styles.stageHeader}
              onPress={() => setExpandedFertStage(expandedFertStage === stage.stage ? null : stage.stage)}
            >
              <Text style={styles.stageName}>{STAGE_LABELS[stage.stage] || stage.stage}</Text>
              <Text style={styles.stageChevron}>{expandedFertStage === stage.stage ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {expandedFertStage === stage.stage && (
              <View style={styles.stagePlans}>
                {stage.plan.map((plan, pIdx) => (
                  <View key={pIdx} style={styles.planCard}>
                    <View style={styles.planHeader}>
                      <Text style={styles.planDay}>{plan.day}</Text>
                      <TouchableOpacity onPress={() => removeDayPlan(stage.stage, pIdx)} style={styles.removeButton}>
                        <Text style={styles.removeButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.planFieldLabel}>Fertilizer Type</Text>
                    <TextInput style={styles.planInput} value={plan.fertilizer_type}
                      onChangeText={(v) => updateDayPlan(stage.stage, pIdx, 'fertilizer_type', v)}
                      placeholder="e.g. Urea (46-0-0)" />

                    <Text style={styles.planFieldLabel}>Amount</Text>
                    <TextInput style={styles.planInput} value={plan.amount}
                      onChangeText={(v) => updateDayPlan(stage.stage, pIdx, 'amount', v)}
                      placeholder="e.g. 8-10 grams per plant" />

                    <Text style={styles.planFieldLabel}>Method</Text>
                    <TextInput style={[styles.planInput, styles.multiline]} value={plan.method}
                      onChangeText={(v) => updateDayPlan(stage.stage, pIdx, 'method', v)}
                      placeholder="Application method" multiline />

                    <Text style={styles.planFieldLabel}>Watering</Text>
                    <TextInput style={styles.planInput} value={plan.watering}
                      onChangeText={(v) => updateDayPlan(stage.stage, pIdx, 'watering', v)}
                      placeholder="Watering instructions" />

                    <Text style={styles.planFieldLabel}>Day</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPicker}>
                      {DAYS_OF_WEEK.map(d => (
                        <TouchableOpacity key={d}
                          style={[styles.dayChip, plan.day === d && styles.dayChipActive]}
                          onPress={() => updateDayPlan(stage.stage, pIdx, 'day', d)}>
                          <Text style={[styles.dayChipText, plan.day === d && styles.dayChipTextActive]}>{d.slice(0, 3)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ))}

                {addingPlanFor === stage.stage ? (
                  <View style={styles.planCard}>
                    <Text style={styles.planDay}>New Entry</Text>

                    <Text style={styles.planFieldLabel}>Day</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayPicker}>
                      {DAYS_OF_WEEK.map(d => (
                        <TouchableOpacity key={d}
                          style={[styles.dayChip, newPlan.day === d && styles.dayChipActive]}
                          onPress={() => setNewPlan(p => ({ ...p, day: d }))}>
                          <Text style={[styles.dayChipText, newPlan.day === d && styles.dayChipTextActive]}>{d.slice(0, 3)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.planFieldLabel}>Fertilizer Type</Text>
                    <TextInput style={styles.planInput} value={newPlan.fertilizer_type}
                      onChangeText={(v) => setNewPlan(p => ({ ...p, fertilizer_type: v }))} placeholder="e.g. Urea (46-0-0)" />

                    <Text style={styles.planFieldLabel}>Amount</Text>
                    <TextInput style={styles.planInput} value={newPlan.amount}
                      onChangeText={(v) => setNewPlan(p => ({ ...p, amount: v }))} placeholder="e.g. 8-10 grams per plant" />

                    <Text style={styles.planFieldLabel}>Method</Text>
                    <TextInput style={[styles.planInput, styles.multiline]} value={newPlan.method}
                      onChangeText={(v) => setNewPlan(p => ({ ...p, method: v }))} placeholder="Application method" multiline />

                    <Text style={styles.planFieldLabel}>Watering</Text>
                    <TextInput style={styles.planInput} value={newPlan.watering}
                      onChangeText={(v) => setNewPlan(p => ({ ...p, watering: v }))} placeholder="Watering instructions" />

                    <View style={styles.addPlanActions}>
                      <TouchableOpacity style={styles.confirmButton} onPress={confirmAddPlan}>
                        <Text style={styles.confirmButtonText}>Add Entry</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.cancelButton} onPress={() => setAddingPlanFor(null)}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addPlanButton} onPress={() => startAddPlan(stage.stage)}>
                    <Text style={styles.addPlanButtonText}>+ Add Day Entry</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* ---- Stage-Specific Tips ---- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stage-Specific Tips</Text>
        <Text style={styles.sectionDescription}>Tips shown to users based on the detected growth stage.</Text>

        {stageTips.map((stage) => (
          <View key={stage.stage} style={styles.stageCard}>
            <TouchableOpacity
              style={styles.stageHeader}
              onPress={() => setExpandedTipsStage(expandedTipsStage === stage.stage ? null : stage.stage)}
            >
              <Text style={styles.stageName}>{STAGE_LABELS[stage.stage] || stage.stage}</Text>
              <Text style={styles.stageChevron}>{expandedTipsStage === stage.stage ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {expandedTipsStage === stage.stage && (
              <View style={styles.stagePlans}>
                {stage.tips.map((tip, tIdx) => (
                  <View key={tIdx} style={styles.itemCard}>
                    <Text style={styles.itemText}>{tip}</Text>
                    <TouchableOpacity style={styles.removeButton} onPress={() => removeStageTip(stage.stage, tIdx)}>
                      <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={styles.inlineAddRow}>
                  <TextInput
                    style={styles.inlineInput}
                    placeholder="Add new tip..."
                    value={newTipInputs[stage.stage] || ''}
                    onChangeText={(v) => setNewTipInputs(prev => ({ ...prev, [stage.stage]: v }))}
                    multiline
                  />
                  <TouchableOpacity style={styles.addButton} onPress={() => addStageTip(stage.stage)}>
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* ---- Condition Messages ---- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Condition Messages</Text>
        <Text style={styles.sectionDescription}>
          Warnings and tips shown based on pH, humidity, temperature, and weather.{'\n'}
          Use {'{ph}'}, {'{humidity}'}, {'{temperature}'}, {'{rainy_days}'}, {'{day}'} as placeholders.
        </Text>

        {conditionMsgs.map((cond) => (
          <View key={cond.condition_key} style={styles.stageCard}>
            <TouchableOpacity
              style={styles.stageHeader}
              onPress={() => setExpandedCondKey(expandedCondKey === cond.condition_key ? null : cond.condition_key)}
            >
              <Text style={styles.stageName}>{cond.condition_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Text>
              <Text style={styles.stageChevron}>{expandedCondKey === cond.condition_key ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {expandedCondKey === cond.condition_key && (
              <View style={styles.stagePlans}>
                {/* Warnings */}
                <Text style={styles.condSubLabel}>Warnings</Text>
                {cond.warnings.map((w, i) => (
                  <View key={i} style={[styles.itemCard, styles.warningCard]}>
                    <Text style={styles.itemText}>{w}</Text>
                    <TouchableOpacity style={styles.removeButton} onPress={() => removeCondMsg(cond.condition_key, 'warning', i)}>
                      <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.inlineAddRow}>
                  <TextInput style={styles.inlineInput} placeholder="Add warning..." multiline
                    value={getCondInput(cond.condition_key, 'warning')}
                    onChangeText={(v) => setCondInput(cond.condition_key, 'warning', v)} />
                  <TouchableOpacity style={[styles.addButton, styles.warningAddButton]} onPress={() => addCondMsg(cond.condition_key, 'warning')}>
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {/* Tips */}
                <Text style={[styles.condSubLabel, { marginTop: 12 }]}>Tips</Text>
                {cond.tips.map((t, i) => (
                  <View key={i} style={styles.itemCard}>
                    <Text style={styles.itemText}>{t}</Text>
                    <TouchableOpacity style={styles.removeButton} onPress={() => removeCondMsg(cond.condition_key, 'tip', i)}>
                      <Text style={styles.removeButtonText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.inlineAddRow}>
                  <TextInput style={styles.inlineInput} placeholder="Add tip..." multiline
                    value={getCondInput(cond.condition_key, 'tip')}
                    onChangeText={(v) => setCondInput(cond.condition_key, 'tip', v)} />
                  <TouchableOpacity style={styles.addButton} onPress={() => addCondMsg(cond.condition_key, 'tip')}>
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* ---- Global Warnings ---- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Global Warnings</Text>
        <Text style={styles.sectionDescription}>Warnings shown to users based on their plant conditions.</Text>

        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="Add new warning..." value={newWarning}
            onChangeText={setNewWarning} multiline />
          <TouchableOpacity style={styles.addButton} onPress={addWarning}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {warnings.map((warning, index) => (
          <View key={index} style={styles.itemCard}>
            <Text style={styles.itemText}>{warning}</Text>
            <TouchableOpacity style={styles.removeButton} onPress={() => removeWarning(index)}>
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* ---- Global Tips ---- */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Global Tips</Text>
        <Text style={styles.sectionDescription}>Helpful tips shown to all users for plant care.</Text>

        <View style={styles.inputContainer}>
          <TextInput style={styles.input} placeholder="Add new tip..." value={newTip}
            onChangeText={setNewTip} multiline />
          <TouchableOpacity style={styles.addButton} onPress={addGlobalTip}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {tips.map((tip, index) => (
          <View key={index} style={styles.itemCard}>
            <Text style={styles.itemText}>{tip}</Text>
            <TouchableOpacity style={styles.removeButton} onPress={() => removeGlobalTip(index)}>
              <Text style={styles.removeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={saveAll}
        disabled={saving}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save All Changes</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6b7280' },
  section: { padding: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#1f2937', marginBottom: 8 },
  sectionDescription: { fontSize: 14, color: '#6b7280', marginBottom: 16 },

  stageCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f0fdf4',
  },
  stageName: { fontSize: 16, fontWeight: '700', color: '#10b981' },
  stageChevron: { fontSize: 14, color: '#10b981' },
  stagePlans: { padding: 12 },

  planCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  planDay: { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  planFieldLabel: { fontSize: 12, color: '#6b7280', marginTop: 8, marginBottom: 2, fontWeight: '600' },
  planInput: {
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 8,
    fontSize: 13,
    color: '#1f2937',
  },
  multiline: { minHeight: 56, textAlignVertical: 'top' },

  dayPicker: { marginVertical: 6 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#e5e7eb', marginRight: 6 },
  dayChipActive: { backgroundColor: '#10b981' },
  dayChipText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  dayChipTextActive: { color: '#fff' },

  addPlanActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  confirmButton: { flex: 1, backgroundColor: '#10b981', padding: 10, borderRadius: 8, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancelButton: { flex: 1, backgroundColor: '#fee2e2', padding: 10, borderRadius: 8, alignItems: 'center' },
  cancelButtonText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },

  addPlanButton: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addPlanButtonText: { color: '#10b981', fontWeight: '700', fontSize: 14 },

  inlineAddRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  inlineInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 44,
  },

  inputContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
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
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
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
  itemText: { flex: 1, fontSize: 14, color: '#1f2937', lineHeight: 20 },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  removeButtonText: { color: '#ef4444', fontSize: 18, fontWeight: 'bold' },

  saveButton: {
    margin: 16, marginTop: 0, marginBottom: 32,
    backgroundColor: '#10b981', padding: 16, borderRadius: 10, alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: '#9ca3af' },
  saveButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  condSubLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, marginTop: 4 },
  warningCard: { borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  warningAddButton: { backgroundColor: '#f59e0b' },
});
