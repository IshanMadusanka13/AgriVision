import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export default function AdminLayout() {
  const router = useRouter();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (!userDataString) {
        Alert.alert('Access Denied', 'Please login first');
        router.replace('/(auth)/login');
        return;
      }

      const userData = JSON.parse(userDataString);
      if (userData.role !== 'admin') {
        Alert.alert('Access Denied', 'Admin access required');
        router.replace('/');
        return;
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      router.replace('/(auth)/login');
    }
  };

  return (
    <Stack>
      <Stack.Screen
        name="dashboard"
        options={{
          title: 'Admin Dashboard',
          headerStyle: { backgroundColor: '#10b981' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="recommendations"
        options={{
          title: 'Edit Recommendations',
          headerStyle: { backgroundColor: '#10b981' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Growth Analysis Settings',
          headerStyle: { backgroundColor: '#10b981' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
    </Stack>
  );
}
