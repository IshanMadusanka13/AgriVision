# app/schemas/planting/planting_schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum
from datetime import datetime

class SoilType(str, Enum):
    SANDY = "sandy"
    LOAMY = "loamy"
    CLAY = "clay"
    SILT = "silt"

class PlantingRequest(BaseModel):
    """Request for planting calculation"""
    crop_type: str = Field(default="scotch_bonnet")
    field_area_m2: float = Field(..., gt=0)  # area in square meters
    soil_ph: float = Field(..., ge=4.0, le=9.0)
    soil_type: SoilType
    temperature_c: float = Field(..., ge=10, le=40)
    nitrogen_ppm: Optional[float] = Field(20.0, ge=0, le=200)
    phosphorus_ppm: Optional[float] = Field(15.0, ge=0, le=100)
    potassium_ppm: Optional[float] = Field(120.0, ge=0, le=500)
    enable_optimization: bool = Field(True)

class SpacingResult(BaseModel):
    row_spacing_cm: float
    plant_spacing_cm: float
    planting_depth_cm: float

    @property
    def row_spacing_m(self) -> float:
        """Return row spacing in meters"""
        return round(self.row_spacing_cm / 100, 3)

    @property
    def plant_spacing_m(self) -> float:
        """Return plant spacing in meters"""
        return round(self.plant_spacing_cm / 100, 3)

class DensityResult(BaseModel):
    total_plants: int
    plants_per_m2: float  # only square meters, hectares removed

class FertilizerResult(BaseModel):
    nitrogen_kg_m2: float      # changed from _kg_ha to _kg_m2
    phosphorus_kg_m2: float    # changed from _kg_ha to _kg_m2
    potassium_kg_m2: float     # changed from _kg_ha to _kg_m2
    organic_recommendation: str

class SuitabilityResult(BaseModel):
    soil_suitability_score: float
    component_scores: Dict[str, float]

class OptimizationResult(BaseModel):
    optimized_row_spacing_m: float
    optimized_plant_spacing_m: float
    fitness_score: float
    generations: int

class PlantingResponse(BaseModel):
    """Complete response from planting calculation"""
    calculation_id: str
    timestamp: datetime
    crop_type: str
    spacing: SpacingResult
    density: DensityResult
    fertilizer: FertilizerResult
    suitability: SuitabilityResult
    optimization: Optional[OptimizationResult] = None
    recommendations: List[str]
    warnings: List[str] = []