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

// =============================================================
// TYPES
// =============================================================

interface Disease {
  id: string;
  disease_name: string;
  description: string;
  severity_level: "High" | "Moderate" | "Low" | "None" | "Severe";
  severity_max_score: number | null;
  treatments: string[];
  updated_at?: string;
}

interface DiseaseGroup {
  disease_name: string;
  rows: Disease[];
}

type EditFormType = {
  description: string;
  severity_max_score: string; // string for TextInput, parsed on save
  treatments: string[];
};

// =============================================================
// CONSTANTS
// =============================================================

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Severe:   { bg: "#fff1f2", text: "#b91c1c", border: "#fecdd3", dot: "#e11d48" },
  High:     { bg: "#fef2f2", text: "#dc2626", border: "#fecaca", dot: "#ef4444" },
  Moderate: { bg: "#fffbeb", text: "#d97706", border: "#fde68a", dot: "#f59e0b" },
  Low:      { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0", dot: "#22c55e" },
  None:     { bg: "#f9fafb", text: "#6b7280", border: "#e5e7eb", dot: "#9ca3af" },
};

// Ordered for display within a group
const SEVERITY_ORDER = ["Low", "Moderate", "High", "Severe", "None"];

// =============================================================
// HELPERS
// =============================================================

function groupDiseases(diseases: Disease[]): DiseaseGroup[] {
  const map = new Map<string, Disease[]>();
  for (const d of diseases) {
    if (!map.has(d.disease_name)) map.set(d.disease_name, []);
    map.get(d.disease_name)!.push(d);
  }
  return Array.from(map.entries()).map(([disease_name, rows]) => ({
    disease_name,
    rows: rows.sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(a.severity_level) -
        SEVERITY_ORDER.indexOf(b.severity_level)
    ),
  }));
}

function formatDiseaseName(name: string) {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// =============================================================
// SUB-COMPONENTS
// =============================================================

function SeverityBadge({ level }: { level: string }) {
  const c = SEVERITY_COLORS[level] ?? SEVERITY_COLORS.None;
  return (
    <View style={[badge.wrap, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={[badge.dot, { backgroundColor: c.dot }]} />
      <Text style={[badge.text, { color: c.text }]}>{level}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: "700" },
});

// =============================================================
// MAIN SCREEN
// =============================================================

export default function EditDiseaseInfo() {
  const [groups, setGroups] = useState<DiseaseGroup[]>([]);
  const [allDiseases, setAllDiseases] = useState<Disease[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<Disease | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormType>({
    description: "",
    severity_max_score: "",
    treatments: [],
  });
  const [newTreatment, setNewTreatment] = useState("");
  const newTreatmentRef = useRef<TextInput>(null);

  // ── Data fetching ────────────────────────────────────────────

  const fetchDiseases = async () => {
    try {
      const data = await getAllDiseases();
      const diseases: Disease[] = data.diseases.map((d: any) => ({
        ...d,
        severity_max_score: d.severity_max_score ?? null,
        treatments: d.treatments ?? [],
      }));
      setAllDiseases(diseases);
      setGroups(groupDiseases(diseases));
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to fetch diseases.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchDiseases(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchDiseases(); };

  // ── Edit modal ───────────────────────────────────────────────

  const openEdit = (disease: Disease) => {
    setSelectedDisease(disease);
    setEditForm({
      description: disease.description ?? "",
      severity_max_score:
        disease.severity_max_score != null
          ? String(disease.severity_max_score)
          : "",
      treatments: disease.treatments ? [...disease.treatments] : [],
    });
    setNewTreatment("");
    setEditModalVisible(true);
  };

  // ── Treatment helpers ────────────────────────────────────────

  const addTreatment = () => {
    const trimmed = newTreatment.trim();
    if (!trimmed) return;
    setEditForm((f) => ({ ...f, treatments: [...f.treatments, trimmed] }));
    setNewTreatment("");
    newTreatmentRef.current?.focus();
  };

  const removeTreatment = (index: number) =>
    setEditForm((f) => ({
      ...f,
      treatments: f.treatments.filter((_, i) => i !== index),
    }));

  const editTreatment = (index: number, value: string) =>
    setEditForm((f) => {
      const updated = [...f.treatments];
      updated[index] = value;
      return { ...f, treatments: updated };
    });

  // ── Save ─────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!selectedDisease) return;

    // Validate severity_max_score
    const scoreRaw = editForm.severity_max_score.trim();
    let severity_max_score: number | null = null;
    if (scoreRaw !== "") {
      const parsed = parseFloat(scoreRaw);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        Alert.alert("Invalid Score", "Severity max score must be a number between 0 and 100.");
        return;
      }
      severity_max_score = parsed;
    }

    setSaving(true);
    try {
      const payload = {
        description: editForm.description,
        treatments: editForm.treatments,
        severity_max_score,
      };

      const data = await updateDisease(selectedDisease.id, payload);

      if (data.status === "success") {
        const updated: Disease = {
          ...selectedDisease,
          ...data.disease,
          severity_max_score: severity_max_score,
          treatments: editForm.treatments,
        };

        // Update flat list and re-group
        setAllDiseases((prev) =>
          prev.map((d) => (d.id === updated.id ? updated : d))
        );
        setGroups((prev) =>
          groupDiseases(
            allDiseases.map((d) => (d.id === updated.id ? updated : d))
          )
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

  // ── Loading state ────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ef4444" />
        <Text style={styles.loadingText}>Loading diseases...</Text>
      </View>
    );
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* Header */}
      {/* <LinearGradient
        colors={["#dc2626", "#ef4444", "#f87171"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Disease Management</Text>
        <Text style={styles.headerSubtitle}>
          {groups.length} disease{groups.length !== 1 ? "s" : ""} ·{" "}
          {allDiseases.length} total rows
        </Text>
      </LinearGradient> */}

      {/* Disease Groups */}
      <ScrollView
        style={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ef4444"
          />
        }
      >
        {groups.map((group) => (
          <View key={group.disease_name} style={styles.groupCard}>

            {/* Group header */}
            <View style={styles.groupHeader}>
              <Text style={styles.groupName}>
                {formatDiseaseName(group.disease_name)}
              </Text>
              <View style={styles.groupRowCount}>
                <Text style={styles.groupRowCountText}>
                  {group.rows.length} {group.rows.length === 1 ? "tier" : "tiers"}
                </Text>
              </View>
            </View>

            {/* Severity rows */}
            {group.rows.map((row, idx) => {
              const c = SEVERITY_COLORS[row.severity_level] ?? SEVERITY_COLORS.None;
              const isLast = idx === group.rows.length - 1;
              return (
                <View
                  key={row.id}
                  style={[
                    styles.severityRow,
                    !isLast && styles.severityRowBorder,
                  ]}
                >
                  {/* Left: badge + score */}
                  <View style={styles.severityRowLeft}>
                    <SeverityBadge level={row.severity_level} />
                    {row.severity_max_score != null && (
                      <Text style={styles.maxScore}>
                        ≤ {row.severity_max_score}%
                      </Text>
                    )}
                  </View>

                  {/* Right: treatment count + edit */}
                  <View style={styles.severityRowRight}>
                    <Text style={styles.treatmentCount}>
                      {row.treatments?.length ?? 0} treatments
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.editButton,
                        { backgroundColor: c.bg, borderColor: c.border },
                      ]}
                      onPress={() => openEdit(row)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.editButtonText, { color: c.text }]}>
                        Edit
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* ── Edit Modal ─────────────────────────────────────── */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>

          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setEditModalVisible(false)}
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <View style={styles.modalTitleBlock}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {selectedDisease
                  ? formatDiseaseName(selectedDisease.disease_name)
                  : ""}
              </Text>
              {selectedDisease && (
                <SeverityBadge level={selectedDisease.severity_level} />
              )}
            </View>

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
            {/* Read-only identity info */}
            <View style={styles.identityBanner}>
              <Text style={styles.identityLabel}>SEVERITY TIER</Text>
              <Text style={styles.identityNote}>
                Severity level is fixed for this row. To change thresholds,
                edit the max score below.
              </Text>
            </View>

            {/* Severity Max Score */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Severity Max Score{" "}
                <Text style={styles.fieldHint}>(0 – 100, % of leaf affected)</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={editForm.severity_max_score}
                onChangeText={(t) =>
                  setEditForm((f) => ({ ...f, severity_max_score: t }))
                }
                keyboardType="decimal-pad"
                placeholder="e.g. 25"
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={editForm.description}
                onChangeText={(text) =>
                  setEditForm((f) => ({ ...f, description: text }))
                }
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Enter disease description..."
                placeholderTextColor="#9ca3af"
              />
            </View>

            {/* Treatments */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Treatments{" "}
                <Text style={styles.fieldCount}>
                  ({editForm.treatments.length})
                </Text>
              </Text>

              {editForm.treatments.map((item, index) => (
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

              {/* Add new treatment */}
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
                  style={[
                    styles.addBtn,
                    !newTreatment.trim() && styles.addBtnDisabled,
                  ]}
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

// =============================================================
// STYLES
// =============================================================

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

  // Header
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 24 },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#fff", marginBottom: 4 },
  headerSubtitle: { fontSize: 15, color: "#fecaca" },

  listContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // Group card
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fafafa",
  },
  groupName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.3,
  },
  groupRowCount: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  groupRowCountText: { fontSize: 12, fontWeight: "600", color: "#6b7280" },

  // Severity row inside group
  severityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  severityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  severityRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  maxScore: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "500",
  },
  severityRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  treatmentCount: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
  },
  editButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  editButtonText: { fontSize: 13, fontWeight: "700" },

  bottomPadding: { height: 40 },

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
  modalTitleBlock: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    marginHorizontal: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2937",
    textAlign: "center",
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

  // Identity banner
  identityBanner: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  identityLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#d97706",
    letterSpacing: 1,
    marginBottom: 4,
  },
  identityNote: {
    fontSize: 13,
    color: "#92400e",
    lineHeight: 19,
  },

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
  fieldHint: {
    fontWeight: "400",
    color: "#9ca3af",
    textTransform: "none",
    letterSpacing: 0,
  },
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
});