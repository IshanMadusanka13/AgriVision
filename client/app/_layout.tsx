import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="planting" options={{ headerShown: false }} />
        <Stack.Screen name="disease/disease" options={{ headerShown: false }} />
        <Stack.Screen name="growth/growth" options={{ headerShown: false }} />
        <Stack.Screen name="quality/quality" options={{ headerShown: false }} />
        <Stack.Screen
          name="growth/history"
          options={{
            title: 'Analysis History',
            headerStyle: { backgroundColor: '#10b981' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
        <Stack.Screen
          name="growth/session-details"
          options={{
            title: 'Session Details',
            headerStyle: { backgroundColor: '#10b981' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}