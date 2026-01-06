from typing import Dict, List

class PlantingService:
    """Service for planting calculations - SIMPLE VERSION"""
    
    def calculate_spacing(self, ph: float, temp: float, soil_type: str) -> Dict:
        """Calculate optimal spacing based on soil and climate conditions"""
        # Base spacing for Scotch Bonnet (in meters)
        row = 0.75
        plant = 0.60
        
        # pH adjustment
        if ph < 6.0:
            row *= 1.1
            plant *= 1.1
        elif ph > 7.0:
            row *= 1.05
            plant *= 1.05
        
        # Temperature adjustment
        if temp > 30:
            row *= 1.05
            plant *= 1.05
        
        # Soil type adjustment
        adjustments = {
            "sandy": 0.95,
            "loamy": 1.0,
            "clay": 1.1,
            "silt": 1.05
        }
        factor = adjustments.get(soil_type.lower(), 1.0)
        row *= factor
        plant *= factor
        
        # Clamp values
        row = max(0.5, min(1.2, row))
        plant = max(0.4, min(1.0, plant))
        
        # Convert to centimeters
        row_cm = row * 100
        plant_cm = plant * 100
        
        return {
            "row_spacing_cm": round(row_cm, 1),
            "plant_spacing_cm": round(plant_cm, 1),
            "planting_depth_cm": 2.0
        }
    
    def calculate_density(self, area_m2: float, row_spacing_cm: float, plant_spacing_cm: float) -> Dict:
        """
        Calculate planting density
        
        Args:
            area_m2: Field area in square meters
            row_spacing_cm: Row spacing in centimeters
            plant_spacing_cm: Plant spacing in centimeters
        
        Returns:
            Dictionary with total plants and plants per m²
        """
        # Convert cm to meters for calculation
        row_spacing_m = row_spacing_cm / 100
        plant_spacing_m = plant_spacing_cm / 100
        
        plants_per_m2 = 1 / (row_spacing_m * plant_spacing_m)
        total_plants = int(area_m2 * plants_per_m2)
        
        return {
            "total_plants": total_plants,
            "plants_per_m2": round(plants_per_m2, 4)
        }
    
    def recommend_fertilizer(self, n: float, p: float, k: float) -> Dict:
        """
        Recommend fertilizer based on soil analysis
        
        Returns fertilizer amounts in kg per square meter
        """
        base_n = 0.012  # 12 g/m² (equivalent to ~120 kg/ha)
        base_p = 0.006  # 6 g/m² (equivalent to ~60 kg/ha)
        base_k = 0.015  # 15 g/m² (equivalent to ~150 kg/ha)
        
        # Adjust based on current levels
        if n < 30:
            base_n += 0.003
        elif n > 80:
            base_n -= 0.002
        
        if p < 15:
            base_p += 0.002
        elif p > 50:
            base_p -= 0.0015
        
        if k < 100:
            base_k += 0.004
        elif k > 300:
            base_k -= 0.003
        
        return {
            "nitrogen_kg_m2": round(max(0, base_n), 4),
            "phosphorus_kg_m2": round(max(0, base_p), 4),
            "potassium_kg_m2": round(max(0, base_k), 4),
            "organic_recommendation": "Apply 0.5-1.0 kg/m² of compost"
        }
    
    def calculate_suitability(self, ph: float, soil_type: str, temp: float) -> Dict:
        """Calculate soil suitability score (0-100)"""
        scores = []
        
        # pH score (0-100)
        if 6.0 <= ph <= 6.8:
            ph_score = 100
        elif 5.8 <= ph < 6.0 or 6.8 < ph <= 7.0:
            ph_score = 80
        elif 5.5 <= ph < 5.8 or 7.0 < ph <= 7.3:
            ph_score = 60
        else:
            ph_score = 40
        scores.append(ph_score)
        
        # Soil type score
        soil_scores = {"loamy": 100, "silt": 85, "sandy": 70, "clay": 60}
        soil_score = soil_scores.get(soil_type.lower(), 50)
        scores.append(soil_score)
        
        # Temperature score
        if 24 <= temp <= 30:
            temp_score = 100
        elif 21 <= temp < 24 or 30 < temp <= 32:
            temp_score = 80
        elif 18 <= temp < 21 or 32 < temp <= 35:
            temp_score = 60
        else:
            temp_score = 50
        scores.append(temp_score)
        
        avg_score = sum(scores) / len(scores)
        
        return {
            "soil_suitability_score": round(avg_score, 1),
            "component_scores": {
                "ph": ph_score,
                "soil_type": soil_score,
                "temperature": temp_score
            }
        }

# Singleton instance
planting_service = PlantingService()