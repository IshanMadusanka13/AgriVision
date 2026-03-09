import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getAllDiseases, updateDisease } from "../../services/api";

interface Disease {
  id: string;
  disease_name: string;
  description: string;
  severity_level: "High" | "Moderate" | "Low" | "None";
  symptoms: string;
  treatment: string;
  treatments?: string[];
  prevention: string;
  updated_at?: string;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  High: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  Moderate: { bg: "#fffbeb", text: "#d97706", border: "#fde68a" },
  Low: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  None: { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb" },
};

const SEVERITY_OPTIONS = ["High", "Moderate", "Low", "None"];

type EditFormType = Omit<Partial<Disease>, "treatments"> & {
  treatments?: string[];
};

export default function EditDiseaseInfo() {
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormType>({});
  const [newTreatment, setNewTreatment] = useState("");
  const newTreatmentRef = useRef<TextInput>(null);

  const fetchDiseases = async () => {
    try {
      const data = await getAllDiseases();
      setDiseases(data.diseases);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to fetch diseases.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDiseases();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDiseases();
  };

  const openEdit = (disease: Disease) => {
    setSelectedDisease(disease);
    setEditForm({
      description: disease.description,
      severity_level: disease.severity_level,
      symptoms: disease.symptoms,
      prevention: disease.prevention,
      treatments: disease.treatments ? [...disease.treatments] : [],
    });
    setNewTreatment("");
    setEditModalVisible(true);
  };

  // Treatment list helpers
  const addTreatment = () => {
    const trimmed = newTreatment.trim();
    if (!trimmed) return;
    setEditForm((f) => ({ ...f, treatments: [...(f.treatments ?? []), trimmed] }));
    setNewTreatment("");
    newTreatmentRef.current?.focus();
  };

  const removeTreatment = (index: number) => {
    setEditForm((f) => ({
      ...f,
      treatments: (f.treatments ?? []).filter((_, i) => i !== index),
    }));
  };

  const editTreatment = (index: number, value: string) => {
    setEditForm((f) => {
      const updated = [...(f.treatments ?? [])];
      updated[index] = value;
      return { ...f, treatments: updated };
    });
  };

  const handleSave = async () => {
    if (!selectedDisease) return;
    setSaving(true);
    try {
      const payload: any = { ...editForm };
      const data = await updateDisease(selectedDisease.id, payload);
      if (data.status === "success") {
        setDiseases((prev) =>
          prev.map((d) => (d.id === selectedDisease.id ? data.disease : d))
        );
        setEditModalVisible(false);
      } else {
        Alert.alert("Error", "Failed to update disease.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update disease.");
    } finally {
      setSaving(false);
    }
  };

  const SeverityBadge = ({ level }: { level: string }) => {
    const colors = SEVERITY_COLORS[level] || SEVERITY_COLORS.None;
    return (
      <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Text style={[styles.badgeText, { color: colors.text }]}>{level}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Loading diseases...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#dc2626", "#ef4444", "#f87171"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Disease Management</Text>
        <Text style={styles.headerSubtitle}>{diseases.length} diseases in database</Text>
      </LinearGradient>

      {/* Disease List */}
      <ScrollView
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ef4444" />
        }
      >
        {diseases.map((disease) => (
          <View key={disease.id} style={styles.diseaseCard}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.diseaseName}>{disease.disease_name}</Text>
              <SeverityBadge level={disease.severity_level} />
            </View>

            {disease.description ? (
              <Text style={styles.diseaseDescription} numberOfLines={2}>
                {disease.description}
              </Text>
            ) : null}

            <View style={styles.cardMeta}>
              {disease.updated_at ? (
                <Text style={styles.metaText}>
                  Updated: {new Date(disease.updated_at).toLocaleDateString()}
                </Text>
              ) : (
                <View />
              )}
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEdit(disease)}
                activeOpacity={0.8}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedDisease?.disease_name}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Severity Selector */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Severity Level</Text>
              <View style={styles.severityRow}>
                {SEVERITY_OPTIONS.map((level) => {
                  const colors = SEVERITY_COLORS[level];
                  const isSelected = editForm.severity_level === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.severityOption,
                        { borderColor: colors.border },
                        isSelected && { backgroundColor: colors.bg, borderColor: colors.text },
                      ]}
                      onPress={() =>
                        setEditForm((f) => ({
                          ...f,
                          severity_level: level as Disease["severity_level"],
                        }))
                      }
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.severityOptionText,
                          { color: isSelected ? colors.text : "#6b7280" },
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editForm.description || ""}
                onChangeText={(text) => setEditForm((f) => ({ ...f, description: text }))}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Enter disease description..."
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Treatments — dynamic list */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Treatments{" "}
                <Text style={styles.fieldCount}>
                  ({editForm.treatments?.length ?? 0})
                </Text>
              </Text>

              {/* Existing treatment items */}
              {(editForm.treatments ?? []).map((item, index) => (
                <View key={index} style={styles.treatmentRow}>
                  <View style={styles.treatmentIndex}>
                    <Text style={styles.treatmentIndexText}>{index + 1}</Text>
                  </View>
                  <TextInput
                    style={styles.treatmentInput}
                    value={item}
                    onChangeText={(text) => editTreatment(index, text)}
                    placeholder={`Treatment ${index + 1}`}
                    placeholderTextColor="#9ca3af"
                    multiline
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeTreatment(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}

              {/* Add new treatment row */}
              <View style={styles.addTreatmentRow}>
                <TextInput
                  ref={newTreatmentRef}
                  style={styles.addTreatmentInput}
                  value={newTreatment}
                  onChangeText={setNewTreatment}
                  placeholder="Add a treatment..."
                  placeholderTextColor="#9ca3af"
                  onSubmitEditing={addTreatment}
                  returnKeyType="done"
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[styles.addBtn, !newTreatment.trim() && styles.addBtnDisabled]}
                  onPress={addTreatment}
                  disabled={!newTreatment.trim()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.bottomPadding} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f9fafb",
  },
  loadingText: { fontSize: 15, color: "#6b7280" },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 24 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 4 },
  headerSubtitle: { fontSize: 15, color: "#fecaca" },
  listContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  diseaseCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  diseaseName: { fontSize: 17, fontWeight: "700", color: "#1f2937", flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  diseaseDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginBottom: 12,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  metaText: { fontSize: 12, color: "#9ca3af" },
  editButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
  },
  editButtonText: { fontSize: 14, fontWeight: "600", color: "#ef4444" },
  // Modal
  modalContainer: { flex: 1, backgroundColor: "#f9fafb" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1f2937",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 4, minWidth: 60 },
  cancelBtnText: { fontSize: 16, color: "#6b7280" },
  saveBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  modalContent: { flex: 1, padding: 20 },
  fieldGroup: { marginBottom: 24 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldCount: { fontWeight: "400", color: "#9ca3af", textTransform: "none" },
  textInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#1f2937",
  },
  textArea: { minHeight: 100, paddingTop: 12 },
  // Treatment list
  treatmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 12,
    gap: 10,
  },
  treatmentIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    flexShrink: 0,
  },
  treatmentIndexText: { fontSize: 12, fontWeight: "700", color: "#ef4444" },
  treatmentInput: {
    flex: 1,
    fontSize: 15,
    color: "#1f2937",
    lineHeight: 22,
    paddingTop: 0,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
    flexShrink: 0,
  },
  removeBtnText: { fontSize: 11, color: "#6b7280", fontWeight: "700" },
  addTreatmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  addTreatmentInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#fecaca",
    borderRadius: 12,
    borderStyle: "dashed",
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: "#1f2937",
  },
  addBtn: {
    backgroundColor: "#ef4444",
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  addBtnDisabled: { backgroundColor: "#fca5a5" },
  addBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  severityRow: { flexDirection: "row", gap: 8 },
  severityOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  severityOptionText: { fontSize: 13, fontWeight: "600" },
  bottomPadding: { height: 40 },
});
