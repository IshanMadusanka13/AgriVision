import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";

export default function ManualAreaScreen() {
  const [area, setArea] = useState("");
  const router = useRouter();

  const handleSubmit = () => {
    const value = parseFloat(area);

    if (isNaN(value) || value <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid positive number.");
      return;
    }

    router.push({
      pathname: "/planting/SoilInputScreen",
      params: { manualArea: value },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Field Area (m²)</Text>

      <TextInput
        style={styles.input}
        keyboardType="numeric"
        placeholder="e.g., 120.5"
        value={area}
        onChangeText={setArea}
      />

      <TouchableOpacity style={styles.btn} onPress={handleSubmit}>
        <Text style={styles.btnText}>Submit</Text>
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
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    width: "100%",
    padding: 14,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  btn: {
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});