# app/models/planting/field_models.py
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text
from sqlalchemy.sql import func
from app.configs.database import Base, get_db

class Field(Base):
    """Model for storing field information"""
    __tablename__ = "fields"
    
    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(String(100), unique=True, index=True)
    name = Column(String(200))
    area_hectares = Column(Float)  # Keep database column as is
    
    # GeoJSON boundary
    boundary_geojson = Column(JSON)
    
    # Soil data (can be separate table, but keeping simple)
    soil_ph = Column(Float, nullable=True)
    soil_type = Column(String(50), nullable=True)
    organic_matter = Column(Float, nullable=True)
    
    # Climate data
    temperature = Column(Float, nullable=True)
    rainfall = Column(Float, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    user_id = Column(String(100), nullable=True)
    location = Column(String(200), nullable=True)
    
    @property
    def area_square_meters(self):
        """Convert hectares to square meters on read"""
        return self.area_hectares * 10000 if self.area_hectares else 0
    
    @area_square_meters.setter
    def area_square_meters(self, value):
        """Convert square meters to hectares on write"""
        self.area_hectares = value / 10000 if value else 0
    
    def to_dict(self):
        return {
            "id": self.id,
            "field_id": self.field_id,
            "name": self.name,
            "area_hectares": self.area_hectares,
            "area_square_meters": self.area_square_meters,
            "soil_ph": self.soil_ph,
            "soil_type": self.soil_type,
            "temperature": self.temperature,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

class PlantingLayout(Base):
    """Model for storing generated planting layouts"""
    __tablename__ = "planting_layouts"
    
    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(String(100), unique=True, index=True)
    field_id = Column(String(100), index=True)
    calculation_id = Column(String(100), index=True)  # Link to calculation
    
    # Layout data
    row_spacing = Column(Float)
    plant_spacing = Column(Float)
    total_plants = Column(Integer)
    
    # Grid data (as JSON)
    plant_positions = Column(JSON)  # List of plant coordinates
    grid_parameters = Column(JSON)
    
    # Visualization data
    boundary_coords = Column(JSON)
    coverage_percentage = Column(Float)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    def to_dict(self):
        return {
            "id": self.id,
            "layout_id": self.layout_id,
            "field_id": self.field_id,
            "calculation_id": self.calculation_id,
            "row_spacing": self.row_spacing,
            "plant_spacing": self.plant_spacing,
            "total_plants": self.total_plants,
            "coverage_percentage": self.coverage_percentage,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }