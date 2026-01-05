import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

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
        <Stack.Screen
          name="growth/history"
          options={{
            title: 'Analysis History',
            headerStyle: {
              backgroundColor: '#10b981',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <Stack.Screen
          name="growth/session-details"
          options={{
            title: 'Session Details',
            headerStyle: {
              backgroundColor: '#10b981',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
