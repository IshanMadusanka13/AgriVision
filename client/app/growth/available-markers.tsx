import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAvailableMarkerIds, getUserMarkers } from '@/services/api';

export default function AvailableMarkersScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableIds, setAvailableIds] = useState<number[]>([]);
  const [userEmail, setUserEmail] = useState('');
  const [statistics, setStatistics] = useState({
    total_generated: 0,
    assigned_to_plants: 0,
    available: 0,
  });

  const fetchAvailableMarkers = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) {
        Alert.alert('Error', 'Please login first');
        return;
      }
      setUserEmail(email);

      const [ids, { statistics: stats }] = await Promise.all([
        getAvailableMarkerIds(email, 100),
        getUserMarkers(email),
      ]);

      setAvailableIds(ids);
      if (stats) setStatistics(stats);
    } catch (error) {
      console.error('Error fetching markers:', error);
      Alert.alert('Error', 'Failed to fetch marker information');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAvailableMarkers();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAvailableMarkers();
  };

  const renderIdGrid = () => {
    // Group IDs into ranges for better visualization
    const ranges: { start: number; end: number }[] = [];
    let currentRange: { start: number; end: number } | null = null;

    availableIds.forEach((id, index) => {
      if (currentRange === null) {
        currentRange = { start: id, end: id };
      } else if (id === currentRange.end + 1) {
        currentRange.end = id;
      } else {
        ranges.push(currentRange);
        currentRange = { start: id, end: id };
      }

      if (index === availableIds.length - 1 && currentRange) {
        ranges.push(currentRange);
      }
    });

    return (
      <View style={styles.rangesContainer}>
        {ranges.map((range, index) => (
          <View key={index} style={styles.rangeCard}>
            {range.start === range.end ? (
              <View style={styles.singleIdContainer}>
                <Text style={styles.singleIdNumber}>{range.start}</Text>
                <Text style={styles.singleIdLabel}>Available</Text>
              </View>
            ) : (
              <View style={styles.rangeContainer}>
                <View style={styles.rangeRow}>
                  <Text style={styles.rangeNumber}>{range.start}</Text>
                  <Text style={styles.rangeSeparator}>→</Text>
                  <Text style={styles.rangeNumber}>{range.end}</Text>
                </View>
                <Text style={styles.rangeCount}>
                  {range.end - range.start + 1} markers
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Loading available markers...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>📋 Available Marker IDs</Text>
        <Text style={styles.subtitle}>Ready to print</Text>
      </View>

      {/* Statistics Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.totalCard]}>
          <Text style={styles.statNumber}>{statistics.total_generated}</Text>
          <Text style={styles.statLabel}>Total Generated</Text>
        </View>
        <View style={[styles.statCard, styles.assignedCard]}>
          <Text style={styles.statNumber}>{statistics.assigned_to_plants}</Text>
          <Text style={styles.statLabel}>Assigned</Text>
        </View>
        <View style={[styles.statCard, styles.availableCard]}>
          <Text style={styles.statNumber}>{availableIds.length}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${
                  statistics.total_generated > 0
                    ? (statistics.total_generated / 1000) * 100
                    : 0
                }%`,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {statistics.total_generated} / 1000 IDs used
        </Text>
      </View>

      {/* Available IDs Display */}
      {availableIds.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>✨ Available ID Ranges</Text>
            <Text style={styles.sectionSubtitle}>
              Select from these ranges when generating new markers
            </Text>
          </View>
          {renderIdGrid()}

          {/* Next Available Quick Info */}
          <View style={styles.quickInfoCard}>
            <View style={styles.quickInfoIcon}>
              <Text style={styles.quickInfoIconText}>⚡</Text>
            </View>
            <View style={styles.quickInfoContent}>
              <Text style={styles.quickInfoLabel}>Next Available ID</Text>
              <Text style={styles.quickInfoValue}>{availableIds[0]}</Text>
            </View>
          </View>

          {/* Suggested Ranges */}
          <View style={styles.suggestionsCard}>
            <Text style={styles.suggestionsTitle}>💡 Quick Start Suggestions</Text>
            <View style={styles.suggestionsList}>
              <TouchableOpacity style={styles.suggestionItem}>
                <Text style={styles.suggestionLabel}>Next 5 markers</Text>
                <Text style={styles.suggestionRange}>
                  {availableIds[0]} - {availableIds[Math.min(4, availableIds.length - 1)]}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.suggestionItem}>
                <Text style={styles.suggestionLabel}>Next 10 markers</Text>
                <Text style={styles.suggestionRange}>
                  {availableIds[0]} - {availableIds[Math.min(9, availableIds.length - 1)]}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.suggestionItem}>
                <Text style={styles.suggestionLabel}>Next 20 markers</Text>
                <Text style={styles.suggestionRange}>
                  {availableIds[0]} - {availableIds[Math.min(19, availableIds.length - 1)]}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>All Markers Generated!</Text>
          <Text style={styles.emptyText}>
            You've generated all 1000 available marker IDs
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    backgroundColor: '#0ea5e9',
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#e0f2fe',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalCard: {
    backgroundColor: '#dbeafe',
  },
  assignedCard: {
    backgroundColor: '#dcfce7',
  },
  availableCard: {
    backgroundColor: '#fef3c7',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0ea5e9',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  rangesContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  rangeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: '#0ea5e9',
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  singleIdContainer: {
    alignItems: 'center',
  },
  singleIdNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#0ea5e9',
    marginBottom: 4,
  },
  singleIdLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  rangeContainer: {
    alignItems: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  rangeNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  rangeSeparator: {
    fontSize: 24,
    color: '#94a3b8',
  },
  rangeCount: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  quickInfoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    gap: 16,
  },
  quickInfoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickInfoIconText: {
    fontSize: 24,
  },
  quickInfoContent: {
    flex: 1,
  },
  quickInfoLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  quickInfoValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f59e0b',
  },
  suggestionsCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  suggestionsList: {
    gap: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  suggestionLabel: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  suggestionRange: {
    fontSize: 14,
    color: '#0ea5e9',
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
});
