import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  generateMarkers,
  getAvailableMarkerIds,
  getUserMarkers,
  getMarkerPreview,
  GeneratedMarker,
  SavedMarkerMeta,
} from '@/services/api';

export default function MarkerGeneratorScreen() {
  const [startId, setStartId] = useState('0');
  const [endId, setEndId] = useState('11');
  const [markerSize, setMarkerSize] = useState('5.0');
  const [withLabel, setWithLabel] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [generatedMarkers, setGeneratedMarkers] = useState<GeneratedMarker[]>([]);
  const [savedMarkers, setSavedMarkers] = useState<SavedMarkerMeta[]>([]);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [availableIds, setAvailableIds] = useState<number[]>([]);
  const [statistics, setStatistics] = useState({
    total_generated: 0,
    assigned_to_plants: 0,
    available: 0,
  });
  const [showAvailableIds, setShowAvailableIds] = useState(true);
  const [showSavedMarkers, setShowSavedMarkers] = useState(true);

  const handleGenerateMarkers = async () => {
    const start = parseInt(startId);
    const end = parseInt(endId);
    const size = parseFloat(markerSize);

    if (isNaN(start) || isNaN(end) || isNaN(size)) {
      Alert.alert('Invalid Input', 'Please enter valid numbers');
      return;
    }

    if (start < 0 || end > 1000) {
      Alert.alert('Invalid Range', 'Marker IDs must be between 0 and 1000');
      return;
    }

    if (start > end) {
      Alert.alert('Invalid Range', 'Start ID must be less than or equal to End ID');
      return;
    }

    if (end - start > 100) {
      Alert.alert('Too Many Markers', 'Cannot generate more than 100 markers at once');
      return;
    }

    setLoading(true);

    try {
      const userEmail = await AsyncStorage.getItem('userEmail');

      const data = await generateMarkers({
        start_id: start,
        end_id: end,
        marker_size_cm: size,
        with_label: withLabel,
        user_email: userEmail,
      });

      if (data.success) {
        setGeneratedMarkers(data.markers);
        Alert.alert('Success', `Successfully generated ${data.total_generated} markers!`, [{ text: 'OK' }]);
        fetchAvailableMarkers();
      }
    } catch (error) {
      console.error('Generation error:', error);
      Alert.alert('Error', 'Failed to generate markers. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableMarkers = async () => {
    try {
      const email = await AsyncStorage.getItem('userEmail');
      if (!email) return;

      const [ids, { markers, statistics: stats }] = await Promise.all([
        getAvailableMarkerIds(email, 50),
        getUserMarkers(email),
      ]);

      setAvailableIds(ids);
      if (stats) setStatistics(stats);
      if (markers) setSavedMarkers(markers);
    } catch (error) {
      console.error('Error fetching available markers:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch image on-demand and print a saved marker
  const handlePrintSaved = async (meta: SavedMarkerMeta) => {
    try {
      setPrintingId(meta.marker_id);
      const marker = await getMarkerPreview(meta.marker_id, meta.size_cm);
      if (marker.image_base64) {
        await handlePrintMarker(marker);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load marker image for printing');
    } finally {
      setPrintingId(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAvailableMarkers();
  };

  const useSuggestedRange = (count: number) => {
    if (availableIds.length > 0) {
      setStartId(availableIds[0].toString());
      setEndId(availableIds[Math.min(count - 1, availableIds.length - 1)].toString());
    }
  };

  useEffect(() => {
    fetchAvailableMarkers();
  }, []);

  const handlePrintMarker = async (marker: GeneratedMarker) => {
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=210mm, initial-scale=1.0">
            <style>
              @page {
                size: A4 portrait;
                margin: 15mm;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 210mm;
                font-family: Arial, sans-serif;
              }
              .page {
                width: 180mm;
                min-height: 267mm;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
              }
              .marker-box {
                border: 2px dashed #333;
                padding: 5mm;
                display: inline-block;
              }
              img {
                display: block;
                width: ${marker.size_cm}cm;
                height: ${marker.size_cm}cm;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
              }
              .label {
                margin-top: 6mm;
                text-align: center;
              }
              .label h2 {
                margin: 0 0 2mm 0;
                font-size: 14pt;
                font-weight: bold;
                color: #000;
              }
              .label p {
                margin: 1mm 0;
                font-size: 10pt;
                color: #333;
              }
              .caution {
                margin-top: 8mm;
                border: 1px solid #e55;
                background: #fff8f8;
                padding: 3mm 5mm;
                font-size: 9pt;
                color: #c00;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="page">
              <div class="marker-box">
                <img src="data:image/png;base64,${marker.image_base64}" alt="ArUco Marker ${marker.marker_id}" />
              </div>
              <div class="label">
                <h2>Plant ID: ${marker.marker_id}</h2>
                <p>Actual size: ${marker.size_cm} cm x ${marker.size_cm} cm</p>
              </div>
              <div class="caution">
                Print at 100% scale &mdash; Do NOT fit to page or scale to paper
              </div>
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Success', 'Marker saved successfully!');
      }
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Error', 'Failed to print marker');
    }
  };

  const handlePrintAll = async () => {
    if (generatedMarkers.length === 0) {
      Alert.alert('No Markers', 'Please generate markers first');
      return;
    }

    try {
      // A4 usable width = 180mm, fit markers per row based on size
      const firstSize = generatedMarkers[0].size_cm;
      // Each cell = marker size + 4mm padding (2mm each side)
      const cellSizeMm = firstSize * 10 + 4;
      const usableWidthMm = 180;
      const markersPerRow = Math.max(1, Math.floor(usableWidthMm / cellSizeMm));

      const rows: GeneratedMarker[][] = [];
      for (let i = 0; i < generatedMarkers.length; i += markersPerRow) {
        rows.push(generatedMarkers.slice(i, i + markersPerRow));
      }

      const markerHtml = rows.map(row => `
        <tr>
          ${row.map(marker => `
            <td>
              <div class="cell">
                <img src="data:image/png;base64,${marker.image_base64}"
                     alt="Marker ${marker.marker_id}" />
                <div class="cell-label">ID: ${marker.marker_id}</div>
              </div>
            </td>
          `).join('')}
        </tr>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=210mm, initial-scale=1.0">
            <style>
              @page {
                size: A4 portrait;
                margin: 15mm;
              }
              * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                box-sizing: border-box;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 210mm;
                font-family: Arial, sans-serif;
              }
              .doc-header {
                text-align: center;
                margin-bottom: 5mm;
                border-bottom: 1px solid #999;
                padding-bottom: 3mm;
              }
              .doc-header h3 {
                margin: 0 0 1mm 0;
                font-size: 12pt;
                color: #000;
              }
              .doc-header p {
                margin: 0;
                font-size: 8pt;
                color: #c00;
                font-weight: bold;
              }
              table {
                width: 180mm;
                border-collapse: collapse;
              }
              td {
                border: 1px dashed #aaa;
                padding: 2mm;
                text-align: center;
                vertical-align: middle;
              }
              .cell {
                display: flex;
                flex-direction: column;
                align-items: center;
              }
              img {
                display: block;
                width: ${firstSize}cm;
                height: ${firstSize}cm;
                image-rendering: pixelated;
                image-rendering: -moz-crisp-edges;
                image-rendering: crisp-edges;
              }
              .cell-label {
                margin-top: 1mm;
                font-size: 7pt;
                color: #333;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            <div class="doc-header">
              <h3>ArUco Markers &mdash; Plant IDs ${startId} to ${endId}</h3>
              <p>Print at 100% scale &mdash; Do NOT fit to page or scale to paper</p>
            </div>
            <table>
              ${markerHtml}
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Success', 'Marker sheet saved successfully!');
      }
    } catch (error) {
      console.error('Print all error:', error);
      Alert.alert('Error', 'Failed to print markers');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>🏷️ ArUco Marker Generator</Text>
        <Text style={styles.subtitle}>Generate markers for plant tracking</Text>
      </View>

      {/* Statistics Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.totalCard]}>
          <Text style={styles.statNumber}>{statistics.total_generated}</Text>
          <Text style={styles.statLabel}>Generated</Text>
        </View>
        <View style={[styles.statCard, styles.nextAvailableCard]}>
          <Text style={styles.statNumber}>
            {availableIds.length > 0 ? availableIds[0] : '1000'}
          </Text>
          <Text style={styles.statLabel}>Next Available</Text>
        </View>
      </View>

      {/* Saved Markers from DB */}
      {savedMarkers.length > 0 && (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeaderButton}
            onPress={() => setShowSavedMarkers(!showSavedMarkers)}
          >
            <Text style={styles.cardTitle}>🗂️ Saved Markers ({savedMarkers.length})</Text>
            <Text style={styles.toggleIcon}>{showSavedMarkers ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {showSavedMarkers && (
            <View style={styles.savedMarkersList}>
              {savedMarkers.map((meta) => (
                <View key={meta.marker_id} style={styles.savedMarkerRow}>
                  <View>
                    <Text style={styles.savedMarkerId}>ID: #{meta.marker_id}</Text>
                    <Text style={styles.savedMarkerMeta}>{meta.size_cm}cm · {meta.status}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.printButton, printingId === meta.marker_id && styles.printButtonDisabled]}
                    onPress={() => handlePrintSaved(meta)}
                    disabled={printingId === meta.marker_id}
                  >
                    {printingId === meta.marker_id
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.printButtonText}>🖨️ Print</Text>
                    }
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Available IDs Section */}
      {availableIds.length > 0 && (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeaderButton}
            onPress={() => setShowAvailableIds(!showAvailableIds)}
          >
            <Text style={styles.cardTitle}>📋 Available Marker IDs</Text>
            <Text style={styles.toggleIcon}>{showAvailableIds ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {showAvailableIds && (
            <>
              <View style={styles.quickInfoCard}>
                <Text style={styles.quickInfoLabel}>Next Available:</Text>
                <Text style={styles.quickInfoValue}>{availableIds[0]}</Text>
              </View>

              <Text style={styles.sectionSubtitle}>Quick Start Suggestions:</Text>
              <View style={styles.suggestionsList}>
                <TouchableOpacity
                  style={styles.suggestionButton}
                  onPress={() => useSuggestedRange(5)}
                >
                  <Text style={styles.suggestionText}>Next 5 markers</Text>
                  <Text style={styles.suggestionRange}>
                    {availableIds[0]} - {availableIds[Math.min(4, availableIds.length - 1)]}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.suggestionButton}
                  onPress={() => useSuggestedRange(10)}
                >
                  <Text style={styles.suggestionText}>Next 10 markers</Text>
                  <Text style={styles.suggestionRange}>
                    {availableIds[0]} - {availableIds[Math.min(9, availableIds.length - 1)]}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.suggestionButton}
                  onPress={() => useSuggestedRange(20)}
                >
                  <Text style={styles.suggestionText}>Next 20 markers</Text>
                  <Text style={styles.suggestionRange}>
                    {availableIds[0]} - {availableIds[Math.min(19, availableIds.length - 1)]}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ Generation Settings</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Start ID (0-1000)</Text>
          <TextInput
            style={styles.input}
            value={startId}
            onChangeText={setStartId}
            keyboardType="numeric"
            placeholder="1"
          />
          <Text style={styles.hint}>Range: 0-1000 (up to 1001 unique markers)</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>End ID (0-1000)</Text>
          <TextInput
            style={styles.input}
            value={endId}
            onChangeText={setEndId}
            keyboardType="numeric"
            placeholder="5"
          />
          <Text style={styles.hint}>Duplicates will be automatically skipped</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Marker Size (cm)</Text>
          <TextInput
            style={styles.input}
            value={markerSize}
            onChangeText={setMarkerSize}
            keyboardType="numeric"
            placeholder="5.0"
          />
          <Text style={styles.hint}>Standard: 5.0 cm (recommended)</Text>
        </View>

        <View style={styles.checkboxContainer}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => setWithLabel(!withLabel)}
          >
            <View style={[styles.checkboxBox, withLabel && styles.checkboxChecked]}>
              {withLabel && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Include Plant ID Label</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateMarkers}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.generateButtonText}>🎨 Generate Markers</Text>
          )}
        </TouchableOpacity>
      </View>

      {generatedMarkers.length > 0 && (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                ✅ Generated Markers ({generatedMarkers.length})
              </Text>
              <TouchableOpacity style={styles.printAllButton} onPress={handlePrintAll}>
                <Text style={styles.printAllButtonText}>🖨️ Print All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {generatedMarkers.map((marker) => (
            <View key={marker.marker_id} style={styles.markerCard}>
              <View style={styles.markerHeader}>
                <Text style={styles.markerTitle}>Plant ID: #{marker.marker_id}</Text>
                <TouchableOpacity
                  style={styles.printButton}
                  onPress={() => handlePrintMarker(marker)}
                >
                  <Text style={styles.printButtonText}>🖨️ Print</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.markerPreview}>
                <Image
                  source={{ uri: `data:image/png;base64,${marker.image_base64}` }}
                  style={styles.markerImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.markerInfo}>
                <Text style={styles.infoText}>Size: {marker.size_cm}cm x {marker.size_cm}cm</Text>
                <Text style={styles.infoText}>Created: {new Date(marker.created_at).toLocaleString()}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>📌 Important Instructions:</Text>
        <Text style={styles.infoText}>• Print markers at exactly 300 DPI</Text>
        <Text style={styles.infoText}>• Do NOT scale when printing</Text>
        <Text style={styles.infoText}>• Use white paper for best results</Text>
        <Text style={styles.infoText}>• Laminate markers for durability</Text>
        <Text style={styles.infoText}>• Place marker at soil level of plant</Text>
        <Text style={styles.infoText}>• Ensure marker faces camera</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#10b981',
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
    color: '#d1fae5',
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10b981',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
  },
  generateButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  printAllButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  printAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  markerCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  markerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  markerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  printButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  printButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  markerPreview: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  markerImage: {
    width: 200,
    height: 200,
  },
  markerInfo: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  infoBox: {
    backgroundColor: '#fef3c7',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#78350f',
    marginBottom: 4,
    lineHeight: 18,
  },
  // Available IDs styles
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
  nextAvailableCard: {
    backgroundColor: '#fef3c7',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  cardHeaderButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleIcon: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  quickInfoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  quickInfoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  quickInfoValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0ea5e9',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    fontWeight: '600',
  },
  suggestionsList: {
    gap: 10,
  },
  suggestionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  suggestionText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  suggestionRange: {
    fontSize: 14,
    color: '#0ea5e9',
    fontWeight: 'bold',
  },
  savedMarkersList: {
    gap: 8,
  },
  savedMarkerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  savedMarkerId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  savedMarkerMeta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  printButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
});
