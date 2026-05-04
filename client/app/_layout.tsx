import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

const hdr = (bg: string) => ({
  headerStyle: { backgroundColor: bg },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' as const },
});

const gh = hdr('#10b981'); // growth — green
const dh = hdr('#1c1917'); // disease — dark
const qh = hdr('#2e7d32'); // quality — dark green
const ph = hdr('#2e7d32'); // planting — green

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="disease" options={{ headerShown: false }} />
        <Stack.Screen name="growth" options={{ headerShown: false }} />
        <Stack.Screen name="quality" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />

        <Stack.Screen name="growth/camera"              options={{ title: 'Scan Plant',          ...gh }} />
        <Stack.Screen name="growth/growth"              options={{ title: 'Growth Monitor',      ...gh }} />
        <Stack.Screen name="growth/environmental-input" options={{ title: 'Environmental Data',  ...gh }} />
        <Stack.Screen name="growth/result"              options={{ title: 'Analysis Result',     ...gh }} />
        <Stack.Screen name="growth/history"             options={{ title: 'Analysis History',    ...gh }} />
        <Stack.Screen name="growth/session-details"     options={{ title: 'Session Details',     ...gh }} />
        <Stack.Screen name="growth/available-markers"   options={{ title: 'Available Markers',   ...gh }} />
        <Stack.Screen name="growth/marker-generator"    options={{ title: 'Marker Generator',    ...gh }} />

        <Stack.Screen name="disease/camera"          options={{ title: 'Scan Disease',           ...dh }} />
        <Stack.Screen name="disease/disease"         options={{ title: 'Disease Detection',      ...dh }} />
        <Stack.Screen name="disease/disease-results" options={{ title: 'Disease Results',        ...dh }} />
        <Stack.Screen name="disease/disease-history" options={{ title: 'Disease History',        ...dh }} />
        <Stack.Screen name="disease/disease-details" options={{ title: 'Disease Details',        ...dh }} />

        <Stack.Screen name="quality/quality"         options={{ title: 'Quality Check',          ...qh }} />
        <Stack.Screen name="quality/uploadquality"   options={{ title: 'Upload for Quality',     ...qh }} />
        <Stack.Screen name="quality/gradingquality"  options={{ title: 'Quality Grading',        ...qh }} />
        <Stack.Screen name="quality/sortingquality"  options={{ title: 'Quality Sorting',        ...qh }} />
        <Stack.Screen name="quality/batchanalysis"   options={{ title: 'Batch Analysis',         ...qh }} />

        <Stack.Screen name="planting/index"             options={{ title: 'Planting Dashboard',  ...ph }} />
        <Stack.Screen name="planting/FieldWalkScreen"   options={{ title: 'Walk Field',          ...ph }} />
        <Stack.Screen name="planting/SoilInputScreen"   options={{ title: 'Upload Soil Data',    ...ph }} />
        <Stack.Screen name="planting/ResultScreen"      options={{ title: 'Results',             ...ph }} />
      </Stack>
    </ThemeProvider>
  );
}
