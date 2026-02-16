# app/routes/planting/field_management_router.py

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import uuid
from typing import List

from app.configs.database import Base, get_db
from app.models.planting.field_models import Field
from app.schemas.planting.geojson_schemas import FieldCreateRequest

router = APIRouter(prefix="/fields", tags=["Field Management"])


@router.post("")
async def create_field(
    request: FieldCreateRequest,
    db: Session = Depends(get_db)
):
    """Create a new field with boundary"""
    try:
        field_id = f"FLD-{str(uuid.uuid4())[:8].upper()}"

        # Calculate area if not provided
        area = request.area_square_meters
        if not area and request.boundary:
            area = calculate_polygon_area(
                request.boundary.geometry.coordinates[0]
            )

        field = Field(
            field_id=field_id,
            name=request.name,
            area_square_meters=area,
            boundary_geojson=request.boundary.dict() if request.boundary else None,
            soil_ph=request.soil_data.get("ph") if request.soil_data else None,
            soil_type=request.soil_data.get("soil_type") if request.soil_data else None,
            temperature=request.climate_data.get("temperature") if request.climate_data else None
        )

        db.add(field)
        db.commit()
        db.refresh(field)

        return {
            "message": "Field created successfully",
            "field": field.to_dict()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_fields(db: Session = Depends(get_db)):
    """Get all fields"""
    fields = db.query(Field).all()
    return [field.to_dict() for field in fields]


@router.get("/{field_id}")
async def get_field(
    field_id: str,
    db: Session = Depends(get_db)
):
    """Get a specific field"""
    field = db.query(Field).filter(Field.field_id == field_id).first()

    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    return field.to_dict()


def calculate_polygon_area(coordinates: List[List[float]]) -> float:
    """
    Simple polygon area calculation (Shoelace formula)
    Returns area in square meters
    """
    if not coordinates or len(coordinates) < 3:
        return 0.0

    area = 0.0
    n = len(coordinates)

    for i in range(n):
        j = (i + 1) % n
        area += coordinates[i][0] * coordinates[j][1]
        area -= coordinates[j][0] * coordinates[i][1]

    return abs(area) / 2.0