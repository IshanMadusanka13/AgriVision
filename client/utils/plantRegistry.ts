import AsyncStorage from '@react-native-async-storage/async-storage';
import { savePlantStartDate, getPlantInfo, getPlantsInfo } from '@/services/api';

export interface PlantRecord {
  id: number;        // = ArUco marker_id
  startDate: string; // YYYY-MM-DD
}

/** Get a single plant record by marker/plant ID */
export async function getPlant(id: number): Promise<PlantRecord | null> {
  try {
    const email = await AsyncStorage.getItem('userEmail');
    if (!email) return null;
    const plant = await getPlantInfo(email, id);
    if (!plant || !plant.start_date) return null;
    return { id: plant.marker_id, startDate: plant.start_date };
  } catch { return null; }
}

/** Save (or update) a plant's start date in Supabase aruco_markers table */
export async function savePlant(record: PlantRecord): Promise<void> {
  const email = await AsyncStorage.getItem('userEmail');
  if (!email) return;
  await savePlantStartDate(email, record.id, record.startDate);
}

/** Get all plants (markers with start_date set) as a registry map keyed by marker_id */
export async function getRegistry(): Promise<Record<string, PlantRecord>> {
  try {
    const email = await AsyncStorage.getItem('userEmail');
    if (!email) return {};
    const plants = await getPlantsInfo(email);
    const reg: Record<string, PlantRecord> = {};
    for (const p of plants) {
      if (p.start_date) {
        reg[String(p.marker_id)] = { id: p.marker_id, startDate: p.start_date };
      }
    }
    return reg;
  } catch { return {}; }
}

/** Short age string e.g. "3mo old" */
export function calcAge(startDate: string): string {
  const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000);
  if (days < 1)   return 'Today';
  if (days < 7)   return `${days}d old`;
  if (days < 30)  return `${Math.floor(days / 7)}w old`;
  if (days < 365) return `${Math.floor(days / 30)}mo old`;
  return `${(days / 365).toFixed(1)}yr old`;
}

/** Full age string e.g. "3 months old" */
export function calcAgeFull(startDate: string): string {
  const days = Math.floor((Date.now() - new Date(startDate).getTime()) / 86_400_000);
  if (days < 1)   return 'Today';
  if (days < 7)   return `${days} day${days !== 1 ? 's' : ''} old`;
  if (days < 30)  return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''} old`;
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''} old`;
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''} old`;
}
