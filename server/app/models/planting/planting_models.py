# app/models/planting/planting_models.py
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Boolean, Text
from sqlalchemy.sql import func
from configs.database import Base, get_db  # Import from YOUR existing database

class PlantingCalculation(Base):
    """Model for storing planting calculations - matches YOUR pattern"""
    __tablename__ = "planting_calculations"
    
    id = Column(Integer, primary_key=True, index=True)
    calculation_id = Column(String(100), unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Crop information
    crop_type = Column(String(50), default="scotch_bonnet")
    
    # Field information
    field_area_m2 = Column(Float)  # Changed from field_area_ha
    field_name = Column(String(100), nullable=True)
    
    # Soil parameters
    soil_ph = Column(Float)
    soil_type = Column(String(50))
    nitrogen_ppm = Column(Float, nullable=True)
    phosphorus_ppm = Column(Float, nullable=True)
    potassium_ppm = Column(Float, nullable=True)
    organic_matter_percent = Column(Float, default=2.5)
    
    # Climate parameters
    temperature_c = Column(Float)
    rainfall_mm = Column(Float, nullable=True)
    sunlight_hours = Column(Float, nullable=True)
    
    # Results
    row_spacing_m = Column(Float)
    plant_spacing_m = Column(Float)
    planting_depth_cm = Column(Float)
    total_plants = Column(Integer)
    plants_per_m2 = Column(Float)  # Changed from plants_per_ha
    
    # Optimization
    optimization_enabled = Column(Boolean, default=True)
    optimization_score = Column(Float, nullable=True)
    
    # Recommendations
    recommendations = Column(JSON, nullable=True)
    warnings = Column(JSON, nullable=True)
    
    # Metadata
    user_id = Column(String(100), nullable=True)
    location = Column(String(200), nullable=True)
    
    def to_dict(self):
        """Convert to dictionary - matches YOUR pattern"""
        return {
            "id": self.id,
            "calculation_id": self.calculation_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "crop_type": self.crop_type,
            "field_area_m2": self.field_area_m2,
            "field_name": self.field_name,
            "soil_ph": self.soil_ph,
            "soil_type": self.soil_type,
            "temperature_c": self.temperature_c,
            "row_spacing_m": self.row_spacing_m,
            "plant_spacing_m": self.plant_spacing_m,
            "total_plants": self.total_plants,
            "plants_per_m2": self.plants_per_m2,
            "optimization_enabled": self.optimization_enabled,
            "optimization_score": self.optimization_score,
            "recommendations": self.recommendations or [],
            "warnings": self.warnings or []
        }