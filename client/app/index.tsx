import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('User');

  // No authentication check
  useEffect(() => {
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const menuItems = [
    {
      title: 'Growth Analysis',
      description: 'Plant growth stage detection',
      icon: '🌱',
      route: '/growth/growth',
      color: '#10b981',
    },
    {
      title: 'Disease Detection',
      description: 'Identify plant diseases',
      icon: '🔬',
      route: '/disease/disease',
      color: '#f59e0b',
    },
    {
      title: 'Quality Grading',
      description: 'Detect the quality of scotch bonnet',
      icon: '🧺',
      route: '/quality/quality',
      color: '#105a0cff',
    },
    {
      title: 'Planting',
      description: 'Feature in development',
      icon: '📈',
      route: '/planting',
      color: '#6b7280',
    },
    {
      title: 'Analysis History',
      description: 'View past analyses',
      icon: '📊',
      route: '/growth/history',
      color: '#3b82f6',
    },
  ];

  const handleNavigation = (route: string) => {
    if (route === '/') {
      alert('This feature is coming soon!');
      return;
    }
    router.push(route as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>AgriVision</Text>
              <Text style={styles.subtitle}>
                AI-Powered Agriculture Assistant
              </Text>
            </View>
          </View>

          <Text style={styles.welcomeUser}>
            Welcome back, {userName}!
          </Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.welcomeText}>
            Select a feature to get started.
          </Text>

          <View style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuCard,
                  { borderTopColor: item.color },
                ]}
                onPress={() => handleNavigation(item.route)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.iconContainer,
                    { backgroundColor: `${item.color}15` },
                  ]}
                >
                  <Text style={styles.icon}>{item.icon}</Text>
                </View>

                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuDescription}>
                  {item.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#374151',
  },
  header: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#d1fae5',
  },
  welcomeUser: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  content: {
    padding: 20,
  },
  welcomeText: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 16,
  },
  menuGrid: {
    gap: 12,
  },
  menuCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderTopWidth: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  icon: {
    fontSize: 22,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  menuDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});