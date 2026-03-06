// app/planting/_layout.tsx
import { Stack } from "expo-router";

export default function PlantingLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: "Planting Dashboard" }}
      />
      <Stack.Screen
        name="FieldWalkScreen"
        options={{ title: "Walk Field" }}
      />
      <Stack.Screen
        name="AreaChoiceScreen"
        options={{ title: "Select Area Input" }}
      />
      <Stack.Screen
        name="ManualAreaScreen"
        options={{ title: "Manual Area" }}
      />
      <Stack.Screen
        name="SoilInputScreen"
        options={{ title: "Upload Soil Data" }}
      />
      <Stack.Screen
        name="ResultScreen"
        options={{ title: "Results" }}
      />
    </Stack>
  );
}