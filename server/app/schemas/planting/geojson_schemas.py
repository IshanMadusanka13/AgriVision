# app/schemas/planting/geojson_schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional
from geojson_pydantic import Feature, Polygon

class FieldBoundary(BaseModel):
    """Field boundary from GeoJSON"""
    type: str = Field(default="Feature")
    geometry: Polygon
    properties: Optional[dict] = Field(default_factory=dict)

class FieldCreateRequest(BaseModel):
    """Create field with boundary"""
    name: str
    area_square_meters: float
    boundary: FieldBoundary
    soil_data: Optional[dict] = None
    climate_data: Optional[dict] = None