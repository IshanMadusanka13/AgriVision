import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Types
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

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://172.20.10.4:8000';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper: Create file object from URI
const createFileFromUri = (imageUri: string) => {
  const filename = imageUri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';
  
  return { uri: imageUri, name: filename, type } as any;
};

// Helper: Create FormData with image
const createImageFormData = (imageUri: string): FormData => {
  const formData = new FormData();
  formData.append('file', createFileFromUri(imageUri));
  return formData;
};

// Helper: Append optional fields to FormData
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

// Helper: Handle API errors
const handleApiError = (error: any, context: string): never => {
  console.error(`${context} error:`, error);
  throw error;
};

export const detectPlant = async (imageUri: string): Promise<DetectionResult> => {
  try {
    const formData = createImageFormData(imageUri);
    const response = await api.post<DetectionResult>('/api/growth/detect', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Detection');
  }
};

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
    const formData = createImageFormData(imageUri);
    
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

    const response = await api.post<FullAnalysisResult>('/api/growth/full_analysis', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Full analysis');
  }
};

export const getCurrentWeather = async (
  location: Location
): Promise<WeatherData> => {
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
    const response = await api.get<{
      success: boolean;
      data: ForecastDay[];
      days: number;
    }>('/api/growth/forecast', {
      params: { ...location, days: Math.min(days, 7) },
    });
    return response.data.data;
  } catch (error) {
    return handleApiError(error, 'Forecast API');
  }
};


export const checkAPIStatus = async (): Promise<boolean> => {
  try {
    const response = await api.get('/');
    return response.status === 200;
  } catch (error) {
    return false;
  }
};


export const uploadImage = async (imageUri: string): Promise<any> => {
  try {
    console.log("Uploading image:", imageUri);
    const formData = new FormData();
    const filename = imageUri.split('/').pop() || 'upload.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    if (Platform.OS === 'web') {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      formData.append('file', blob, filename);
    } else {
      formData.append('file', createFileFromUri(imageUri));
    }

    const response = await api.post('/api/disease/predict', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Upload');
  }
};

export default {
  detectPlant,
  getRecommendation,
  getFullAnalysis,
  getCurrentWeather,
  getWeatherForecast,
  checkAPIStatus,
  uploadImage,
};