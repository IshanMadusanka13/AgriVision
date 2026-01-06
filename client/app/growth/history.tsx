import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.8.183:8000';

interface HistoryItem {
  id: string;
  created_at: string;
  growth_stage: string;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  ph: number;
  temperature: number;
  location: string;
  original_image_url: string;
  annotated_image_url: string;
  flower_count: number;
  fruit_count: number;
  leaf_count: number;
}

export default function HistoryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        Alert.alert('Error', 'Please login first');
        router.replace('/(auth)/login');
        return;
      }

      setUserEmail(email);
      await fetchHistory(email);
    } catch (error) {
      console.error('Load history error:', error);
      Alert.alert('Error', 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (email: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/growth/history/${email}`);
      if (response.data.success) {
        setHistory(response.data.sessions);
      }
    } catch (error: any) {
      console.error('Fetch history error:', error);
      if (error.response?.status === 404) {
        setHistory([]);
      } else {
        throw error;
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchHistory(userEmail);
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh history');
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const viewSessionDetails = (sessionId: string) => {
    router.push({
      pathname: '/growth/session-details',
      params: { sessionId },
    });
  };

  const renderHistoryItem = ({ item }: { item: HistoryItem }) => (
    <TouchableOpacity
      style={styles.historyCard}
      onPress={() => viewSessionDetails(item.id)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {item.original_image_url ? (
          <Image
            source={{ uri: item.original_image_url }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.placeholderImage]}>
            <Text style={styles.placeholderText}>🌱</Text>
          </View>
        )}
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.growthStage} numberOfLines={1}>
          {item.growth_stage}
        </Text>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>

        <View style={styles.npkContainer}>
          <View style={styles.npkBadge}>
            <Text style={styles.npkLabel}>N</Text>
            <Text style={styles.npkValue}>{item.nitrogen}</Text>
          </View>
          <View style={styles.npkBadge}>
            <Text style={styles.npkLabel}>P</Text>
            <Text style={styles.npkValue}>{item.phosphorus}</Text>
          </View>
          <View style={styles.npkBadge}>
            <Text style={styles.npkLabel}>K</Text>
            <Text style={styles.npkValue}>{item.potassium}</Text>
          </View>
        </View>

        <View style={styles.countsContainer}>
          {item.flower_count > 0 && (
            <Text style={styles.countBadge}>🌸 {item.flower_count}</Text>
          )}
          {item.fruit_count > 0 && (
            <Text style={styles.countBadge}>🌶️ {item.fruit_count}</Text>
          )}
          {item.leaf_count > 0 && (
            <Text style={styles.countBadge}>🍃 {item.leaf_count}</Text>
          )}
        </View>

        {item.location && (
          <Text style={styles.location} numberOfLines={1}>
            📍 {item.location}
          </Text>
        )}
      </View>

      <View style={styles.arrowContainer}>
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📊</Text>
      <Text style={styles.emptyTitle}>No Analysis History</Text>
      <Text style={styles.emptyText}>
        Start analyzing your plants to see your history here
      </Text>
      <TouchableOpacity
        style={styles.startButton}
        onPress={() => router.push('/growth/camera')}
      >
        <Text style={styles.startButtonText}>Start Analysis</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analysis History</Text>
        <Text style={styles.headerSubtitle}>
          {history.length} {history.length === 1 ? 'analysis' : 'analyses'}
        </Text>
      </View>

      <FlatList
        data={history}
        renderItem={renderHistoryItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  listContent: {
    padding: 16,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    padding: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    marginRight: 12,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  placeholderImage: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 32,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  growthStage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  npkContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 6,
  },
  npkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  npkLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    marginRight: 4,
  },
  npkValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
  },
  countsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  countBadge: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  location: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 8,
  },
  arrow: {
    fontSize: 20,
    color: '#d1d5db',
  },
  emptyContainer: {
    paddingTop: 60,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
