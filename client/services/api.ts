// services/api.ts
// API service for communicating with FastAPI backend

import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';

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
  location?: string; // Added for display purposes in UI
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

// Get API URL from environment or use default
const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://172.20.10.4:8000';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

/**
 * Detect plant from image
 * @param imageUri - URI of the image
 * @returns Detection results
 */
export const detectPlant = async (imageUri: string): Promise<DetectionResult> => {
  try {
    const formData = new FormData();

    // Create file object from URI
    const filename = imageUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri: imageUri,
      name: filename,
      type: type,
    } as any);

    const response = await api.post<DetectionResult>('/api/detect', formData);
    return response.data;
  } catch (error) {
    console.error('Detection error:', error);
    throw error;
  }
};

/**
 * Get fertilizer recommendation
 * @param data - { growth_stage, npk_levels, location (optional), weather_condition (optional), temperature (optional) }
 * @returns Fertilizer recommendations
 */
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
    const response = await api.post<Recommendation>('/api/recommend', data, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Recommendation error:', error);
    throw error;
  }
};

/**
 * Get full analysis (detection + recommendation)
 * @param imageUri - URI of the image
 * @param npkData - { nitrogen, phosphorus, potassium }
 * @param location - { latitude, longitude } for auto weather (optional)
 * @param weather - Weather condition (optional - auto-fetched if location provided)
 * @param temperature - Temperature (optional - auto-fetched if location provided)
 * @param ph - Soil pH value (optional)
 * @param humidity - Humidity percentage (optional - auto-fetched if location provided)
 * @returns Full analysis results
 */
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

    // Add image
    const filename = imageUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri: imageUri,
      name: filename,
      type: type,
    } as any);

    // Add NPK data
    formData.append('nitrogen', npkData.nitrogen.toString());
    formData.append('phosphorus', npkData.phosphorus.toString());
    formData.append('potassium', npkData.potassium.toString());

    // Add location if provided
    if (location) {
      formData.append('latitude', location.latitude.toString());
      formData.append('longitude', location.longitude.toString());
    }

    // Add manual weather data (optional - will override auto-fetched data)
    if (weather) {
      formData.append('weather', weather);
    }

    if (temperature) {
      formData.append('temperature', temperature.toString());
    }

    if (ph) {
      formData.append('ph', ph.toString());
    }

    if (humidity) {
      formData.append('humidity', humidity.toString());
    }

    const response = await api.post<FullAnalysisResult>('/api/full_analysis', formData);
    return response.data;
  } catch (error) {
    console.error('Full analysis error:', error);
    throw error;
  }
};

/**
 * Get current weather data
 * @param location - { latitude, longitude }
 * @returns Current weather data
 */
export const getCurrentWeather = async (
  location: Location
): Promise<WeatherData> => {
  try {
    const response = await api.get<{ success: boolean; data: WeatherData }>(
      '/api/weather',
      {
        params: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data.data;
  } catch (error) {
    console.error('Weather API error:', error);
    throw error;
  }
};

/**
 * Get weather forecast for upcoming days
 * @param location - { latitude, longitude }
 * @param days - Number of days (default 7, max 7)
 * @returns Daily weather forecast
 */
export const getWeatherForecast = async (
  location: Location,
  days: number = 7
): Promise<ForecastDay[]> => {
  try {
    const response = await api.get<{
      success: boolean;
      data: ForecastDay[];
      days: number;
    }>('/api/forecast', {
      params: {
        latitude: location.latitude,
        longitude: location.longitude,
        days: Math.min(days, 7),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data.data;
  } catch (error) {
    console.error('Forecast API error:', error);
    throw error;
  }
};

/**
 * Check if API is reachable
 * @returns Promise resolving to true if API is online
 */
export const checkAPIStatus = async (): Promise<boolean> => {
  try {
    const response = await api.get('/');
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

export default {
  detectPlant,
  getRecommendation,
  getFullAnalysis,
  getCurrentWeather,
  getWeatherForecast,
  checkAPIStatus,
};
