// Field Management API calls
import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_BASE_URL = Constants.manifest?.extra?.apiBaseUrl || 'http://localhost:8000';
export const fieldAPI = {
  // Create a new field
  createField: async (fieldData: {
    name: string;
    area: number;
    coordinates: Array<{ latitude: number; longitude: number }>;
    soil_type?: string;
    climate_zone?: string;
  }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/planting/fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fieldData.name,
          area_acres: fieldData.area,
          boundary_coordinates: fieldData.coordinates.map(coord => ({
            latitude: coord.latitude,
            longitude: coord.longitude,
          })),
          soil_type: fieldData.soil_type,
          climate_zone: fieldData.climate_zone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create field');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating field:', error);
      throw error;
    }
  },

  // Get all fields
  getFields: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/planting/fields`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch fields');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching fields:', error);
      throw error;
    }
  },

  // Get a specific field by ID
  getField: async (fieldId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/planting/fields/${fieldId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch field');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching field:', error);
      throw error;
    }
  },

  // Update a field
  updateField: async (fieldId: string, fieldData: any) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/planting/fields/${fieldId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fieldData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update field');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating field:', error);
      throw error;
    }
  },

  // Delete a field
  deleteField: async (fieldId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/planting/fields/${fieldId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete field');
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting field:', error);
      throw error;
    }
  },
};

// Spacing calculation API
export const spacingAPI = {
  calculateSpacing: async (soilType: string, climateZone: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/planting/spacing/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          soil_type: soilType,
          climate_zone: climateZone,
          crop_type: 'scotch_bonnet', // You can make this dynamic
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to calculate spacing');
      }

      return await response.json();
    } catch (error) {
      console.error('Error calculating spacing:', error);
      throw error;
    }
  },
};

// Soil analysis API
export const soilAPI = {
  analyzeSoil: async (soilData: {
    ph: number;
    organic_matter: number;
    soil_type: string;
    field_id?: string;
  }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/planting/soil/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(soilData),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze soil');
      }

      return await response.json();
    } catch (error) {
      console.error('Error analyzing soil:', error);
      throw error;
    }
  },
};

// Layout generation API
export const layoutAPI = {
  generateLayout: async (layoutData: {
    field_id: string;
    spacing: { row: number; plant: number };
    area_acres: number;
  }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/planting/layout/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(layoutData),
      });

      if (!response.ok) {
        throw new Error('Failed to generate layout');
      }

      return await response.json();
    } catch (error) {
      console.error('Error generating layout:', error);
      throw error;
    }
  },
};