import axios, { AxiosInstance } from 'axios';
import { Platform } from 'react-native';

// -----------------------
// Types
// -----------------------
export interface DetectionResult {
  growth_stage: string;
  confidence: number;
  leaves_count: number;
  flowers_count: number;
  fruits_count: number;
}

export interface NPKStatus {
  level: 'optimal' | 'low' | 'high';
  current: number;
  optimal: number;
}

export interface WeekPlanDay {
  day: string;
  fertilizer_type: string;
  amount: string;
  amount_adjusted?: string;
  method: string;
  watering: string;
}

export interface Recommendation {
  npk_status: {
    nitrogen: NPKStatus;
    phosphorus: NPKStatus;
    potassium: NPKStatus;
  };
  warnings?: string[];
  week_plan: WeekPlanDay[];
  tips?: string[];
}

export interface FullAnalysisResult {
  detection: DetectionResult;
  recommendation: Recommendation;
}

export interface NPKData {
  nitrogen: number;
  phosphorus: number;
  potassium: number;
}

export interface WeatherData {
  condition: string;
  temperature: number;
  humidity: number;
  description: string;
  timestamp: string;
  location?: string;
}

export interface ForecastDay {
  date: string;
  condition: string;
  temperature: number;
  temp_min: number;
  temp_max: number;
  humidity: number;
}

export interface Location {
  latitude: number;
  longitude: number;
}

// -----------------------
// API Setup
// -----------------------
const API_URL = 'http://172.20.10.4:8000';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// -----------------------
// Helpers
// -----------------------
const createFileFromUri = (imageUri: string) => {
  const filename = imageUri.split('/').pop() || 'photo.jpg';
  return {
    uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
    name: filename,
    type: 'image/jpeg', // Supports .jpg, .jpeg, .png (backend should accept)
  } as any;
};

const appendOptionalFields = (
  formData: FormData,
  fields: Record<string, any>
): void => {
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, value.toString());
    }
  });
};

const handleApiError = (error: any, context: string): never => {
  console.error(`${context} error:`, error);
  throw error;
};

// -----------------------
// Image-based API calls
// -----------------------
export const detectPlant = async (imageUri: string): Promise<DetectionResult> => {
  try {
    const formData = new FormData();
    formData.append('file', createFileFromUri(imageUri));

    const response = await fetch(`${API_URL}/api/growth/detect`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    return handleApiError(error, 'Detection');
  }
};

export const uploadImage = async (imageUri: string): Promise<any> => {
  try {
    const formData = new FormData();
    formData.append('file', createFileFromUri(imageUri));

    const response = await fetch(`${API_URL}/api/disease`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    return handleApiError(error, 'Upload');
  }
};

export const getFullAnalysis = async (
  imageUri: string,
  npkData: NPKData,
  location?: Location | null,
  weather?: string | null,
  temperature?: number | null,
  ph?: number | null,
  humidity?: number | null
): Promise<FullAnalysisResult> => {
  try {
    const formData = new FormData();

    formData.append('file', createFileFromUri(imageUri));

    Object.entries(npkData).forEach(([key, value]) => {
      formData.append(key, value.toString());
    });

    appendOptionalFields(formData, {
      latitude: location?.latitude,
      longitude: location?.longitude,
      weather,
      temperature,
      ph,
      humidity,
    });

    const response = await fetch(`${API_URL}/api/growth/full_analysis`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    return handleApiError(error, 'Full analysis');
  }
};

// -----------------------
// NEW: Grade Quality API
// -----------------------
export const gradeQuality = async (imageUris: string[]): Promise<any> => {
  try {
    const formData = new FormData();
    imageUris.forEach((uri, i) => {
      formData.append('files', createFileFromUri(uri));
    });

    const response = await fetch(`${API_URL}/api/quality/grade`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
  } catch (error) {
    return handleApiError(error, 'Grade Quality');
  }
};

// -----------------------
// JSON-based API calls
// -----------------------
export const getRecommendation = async (
  data: {
    growth_stage: string;
    npk_levels: NPKData;
    latitude?: number | null;
    longitude?: number | null;
    weather_condition?: string | null;
    temperature?: number | null;
    ph?: number | null;
    humidity?: number | null;
  }
): Promise<Recommendation> => {
  try {
    const response = await api.post<Recommendation>('/api/growth/recommend', data);
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Recommendation');
  }
};

export const getCurrentWeather = async (location: Location): Promise<WeatherData> => {
  try {
    const response = await api.get<{ success: boolean; data: WeatherData }>(
      '/api/growth/weather',
      { params: location }
    );
    return response.data.data;
  } catch (error) {
    return handleApiError(error, 'Weather API');
  }
};

export const getWeatherForecast = async (
  location: Location,
  days: number = 7
): Promise<ForecastDay[]> => {
  try {
    const response = await api.get<{ success: boolean; data: ForecastDay[]; days: number }>(
      '/api/growth/forecast',
      { params: { ...location, days: Math.min(days, 7) } }
    );
    return response.data.data;
  } catch (error) {
    return handleApiError(error, 'Forecast API');
  }
};

// -----------------------
// Health Check
// -----------------------
export const checkAPIStatus = async (): Promise<boolean> => {
  try {
    const response = await api.get('/');
    return response.status === 200;
  } catch {
    return false;
  }
};

// -----------------------
// Export Default
// -----------------------
export default {
  detectPlant,
  uploadImage,
  getFullAnalysis,
  gradeQuality,
  getRecommendation,
  getCurrentWeather,
  getWeatherForecast,
  checkAPIStatus,
};
