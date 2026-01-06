import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

//-------------------------------------------------
//-------------------Types-------------------------
//-------------------------------------------------
export interface DetectionResult {
  growth_stage: string;
  confidence: number;
  leaves_count: number;
  flowers_count: number;
  fruits_count: number;
}

interface Detection {
  disease: string;
  confidence: number;
  bbox: number[];
  severity: string;
}

interface DiseaseResult {
  status: string;
  annotated_image?: string;
  total_detections: number;
  detections: Detection[];
  disease_summary: Record<string, number>;
  conclusion: string;
  recommendations: Record<string, string[]>;
  created_at?: string;
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
  success: boolean;
  detection: DetectionResult;
  recommendation: Recommendation;
  session_id?: string | null;
  saved_to_db?: boolean;
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

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: AuthUser;
  detail?: string;
}

// Add admin types
export interface GrowthStageConfig {
  stage: string;
  min_leaves: number;
  max_leaves: number;
  min_flowers: number;
  max_flowers: number;
  min_fruits: number;
  max_fruits: number;
  nitrogen_min: number;
  nitrogen_max: number;
  phosphorus_min: number;
  phosphorus_max: number;
  potassium_min: number;
  potassium_max: number;
}

export interface DashboardStats {
  total_users: number;
  total_sessions: number;
  recent_sessions: Array<{
    id: string;
    created_at: string;
    growth_stage: string;
    user_id: string;
  }>;
}

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.2.44:8000';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});


//-------------------------------------------------
//-------------------Helpers-----------------------
//-------------------------------------------------
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

export const checkAPIStatus = async (): Promise<boolean> => {
  try {
    const response = await api.get('/');
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

// Helper: Handle API errors
const handleApiError = (error: any, context: string): never => {
  console.error(`${context} error:`, error);
  throw error;
};

//-------------------------------------------------
//-------------------Auth--------------------------
//-------------------------------------------------
export const signup = async (
  name: string,
  email: string,
  password: string
): Promise<AuthResponse> => {
  try {
    const response = await api.post<AuthResponse>('/api/auth/signup', {
      name,
      email,
      password,
    });
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Signup');
  }
};

export const login = async (
  email: string,
  password: string
): Promise<AuthResponse> => {
  try {
    const response = await api.post<AuthResponse>('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Login');
  }
};

//-------------------------------------------------
//-------------------Disease-----------------------
//-------------------------------------------------
export const predict_disease = async (
  imageUri: string,
  userEmail: string | null = null,
  saveToDb: boolean = false
): Promise<DiseaseResult> => {
  try {
    // Create form data
    const formData = new FormData();
    
    // Add image file
    const imageFile = {
      uri: imageUri,
      type: "image/jpeg",
      name: "plant_image.jpg",
    } as any;
    
    formData.append("file", imageFile);
    
    // Add optional parameters
    if (saveToDb && userEmail) {
      formData.append("user_email", userEmail);
      formData.append("save_to_db", "true");
    } else {
      formData.append("save_to_db", "false");
    }

    // Make API request
    const response = await api.post<DiseaseResult>("api/disease/predict", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("Disease prediction error:", error);
    
    if (error.response) {
      // Server responded with error status
      const errorMessage = error.response.data?.detail || "Failed to analyze image";
      throw new Error(errorMessage);
    } else if (error.request) {
      // Request made but no response
      throw new Error("No response from server. Please check your connection.");
    } else {
      // Something else went wrong
      throw new Error(error.message || "Failed to analyze image");
    }
  }
};

export const get_user_detections = async (
  userEmail: string,
  limit: number = 10,
  offset: number = 0
): Promise<{ status: string; total: number; detections: any[] }> => {
  try {
    const response = await api.get(`api/disease/detections/user/${userEmail}`, {
      params: { limit, offset },
    });
    return response.data;
  } catch (error: any) {
    console.error("Get detections error:", error);
    throw new Error(error.response?.data?.detail || "Failed to fetch detection history");
  }
};

export const get_detection_by_id = async (
  detectionId: string
): Promise<DiseaseResult> => {
  try {
    const response = await api.get<DiseaseResult>(`api/disease/detections/${detectionId}`);
    return response.data;
  } catch (error: any) {
    console.error("Get detection error:", error);
    throw new Error(error.response?.data?.detail || "Failed to fetch detection details");
  }
};


//-------------------------------------------------
//-------------------Growth------------------------
//-------------------------------------------------
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
  humidity?: number | null,
  userEmail?: string | null,
  locationName?: string | null
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
      user_email: userEmail,
      location_name: locationName,
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


//-------------------------------------------------
//-------------------Quality-----------------------
//-------------------------------------------------
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

//-------------------------------------------------
//-------------------Admin / Management-----------
//-------------------------------------------------
export const getAdminDashboardStats = async (userEmail: string): Promise<DashboardStats> => {
  try {
    const response = await api.get<{ stats: DashboardStats }>('/api/admin/dashboard/stats', {
      headers: { 'X-User-Email': userEmail },
    });
    return response.data.stats;
  } catch (error) {
    return handleApiError(error, 'Admin Dashboard');
  }
};

export const getGrowthStageConfigAdmin = async (userEmail: string): Promise<GrowthStageConfig[]> => {
  try {
    const response = await api.get<{ config: { stages: GrowthStageConfig[] } }>(
      '/api/admin/growth-stage/config',
      { headers: { 'X-User-Email': userEmail } }
    );
    return response.data.config?.stages || [];
  } catch (error) {
    return handleApiError(error, 'Growth Stage Config');
  }
};

export const updateGrowthStageConfigAdmin = async (userEmail: string, configs: GrowthStageConfig[]): Promise<void> => {
  try {
    await api.put('/api/admin/growth-stage/config', { configs }, {
      headers: { 'X-User-Email': userEmail },
    });
  } catch (error) {
    return handleApiError(error, 'Update Growth Stage Config');
  }
};

export const getRecommendationsMetadata = async (userEmail: string): Promise<{ warnings: string[]; tips: string[] }> => {
  try {
    const response = await api.get<{ warnings: string[]; tips: string[] }>(
      '/api/admin/recommendations/metadata',
      { headers: { 'X-User-Email': userEmail } }
    );
    return response.data;
  } catch (error) {
    return handleApiError(error, 'Get Recommendations Metadata');
  }
};

export const updateRecommendationsMetadata = async (userEmail: string, warnings: string[], tips: string[]): Promise<void> => {
  try {
    await api.put('/api/admin/recommendations/metadata', { warnings, tips }, {
      headers: { 'X-User-Email': userEmail },
    });
  } catch (error) {
    return handleApiError(error, 'Update Recommendations Metadata');
  }
};

export default {
  detectPlant,
  getRecommendation,
  getFullAnalysis,
  getCurrentWeather,
  getWeatherForecast,
  checkAPIStatus,
  predict_disease,
  gradeQuality,
  signup,
  login,
  // admin exports
  getAdminDashboardStats,
  getGrowthStageConfigAdmin,
  updateGrowthStageConfigAdmin,
  getRecommendationsMetadata,
  updateRecommendationsMetadata,
};