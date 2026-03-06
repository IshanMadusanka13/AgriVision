import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function AreaChoiceScreen() {

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Area Input Method</Text>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.push("/planting/FieldWalkScreen")}
      >
        <Text style={styles.btnText}>📍 Measure by Walking (GPS)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.manualBtn]}
        onPress={() => router.push("/planting/ManualAreaScreen")}
      >
        <Text style={styles.btnText}>✏️ Enter Area Manually</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 30,
  },
  btn: {
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 10,
    marginVertical: 10,
    width: "100%",
    alignItems: "center",
  },
  manualBtn: {
    backgroundColor: "#2196F3",
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});