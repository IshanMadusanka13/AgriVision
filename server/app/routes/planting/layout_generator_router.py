# app/routes/planting/layout_router.py
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
import uuid
import math
from typing import Optional, List
import logging

from app.configs.database import get_db
from app.models.planting.field_models import Field, PlantingLayout
from app.services.planting.layout_generator import layout_generator

router = APIRouter(prefix="/layouts", tags=["Layout Management"])
logger = logging.getLogger(__name__)


@router.post("/generate")
async def generate_layout(
    field_id: str = Query(..., description="Field ID"),
    row_spacing_cm: float = Query(75.0, gt=30, le=200, description="Row spacing in centimeters"),
    plant_spacing_cm: float = Query(60.0, gt=20, le=150, description="Plant spacing in centimeters"),
    db: Session = Depends(get_db)
):
    """
    Generate planting layout for a field
    
    Args:
        field_id: Field identifier
        row_spacing_cm: Row spacing in centimeters (default 75cm)
        plant_spacing_cm: Plant spacing in centimeters (default 60cm)
    """
    try:
        logger.info(f"Generating layout for field {field_id}")
        
        # Convert cm to meters for internal calculations
        row_spacing_m = row_spacing_cm / 100
        plant_spacing_m = plant_spacing_cm / 100
        
        # 1️⃣ Get field
        field = db.query(Field).filter(Field.field_id == field_id).first()
        if not field:
            raise HTTPException(status_code=404, detail="Field not found")

        # 2️⃣ Extract boundary coordinates (handle gracefully)
        boundary_coords = None
        if field.boundary_geojson:
            try:
                geometry = field.boundary_geojson.get("geometry", {})
                if geometry.get("type") == "Polygon":
                    coords = geometry.get("coordinates", [])
                    if coords and len(coords) > 0:
                        boundary_coords = coords[0]
                        logger.info(f"Found boundary with {len(boundary_coords)} points")
            except Exception as e:
                logger.warning(f"Error parsing boundary: {e}")
                boundary_coords = None
        
        # 3️⃣ If no boundary, create a simple one from area
        if not boundary_coords:
            logger.info("No boundary found, creating simple boundary from area")
            side_length = math.sqrt(field.area_hectares * 10000)  # Convert ha to m²
            boundary_coords = [
                [0, 0],
                [side_length, 0],
                [side_length, side_length],
                [0, side_length],
                [0, 0]  # Close polygon
            ]
            logger.info(f"Created square boundary: {side_length}m x {side_length}m")

        # 4️⃣ Generate layout
        logger.info(f"Generating grid with spacing: {row_spacing_cm}cm x {plant_spacing_cm}cm")
        
        try:
            layout_data = layout_generator.generate_grid(
                boundary_coords=boundary_coords,
                row_spacing_cm=row_spacing_cm,
                plant_spacing_cm=plant_spacing_cm
            )
        except Exception as e:
            logger.error(f"Layout generation failed: {e}")
            # Fallback: Create simple layout manually
            layout_data = create_fallback_layout(
                field.area_hectares, row_spacing_cm, plant_spacing_cm
            )
        
        logger.info(f"Generated {layout_data.get('total_plants', 0)} plants")

        # 5️⃣ Validate layout data
        if not layout_data or layout_data.get("total_plants", 0) == 0:
            logger.warning("Layout generator returned 0 plants, using fallback")
            layout_data = create_fallback_layout(
                field.area_hectares, row_spacing_cm, plant_spacing_cm
            )
        
        # 6️⃣ Calculate coverage
        try:
            coverage = layout_generator.calculate_coverage(
                field.area_hectares * 10000,
                layout_data["total_plants"],
                plant_spacing_cm
            )
        except:
            # Simple coverage calculation
            plant_area = layout_data["total_plants"] * (row_spacing_m * plant_spacing_m)
            field_area = field.area_hectares * 10000
            coverage = min(100, (plant_area / field_area) * 100)

        # 7️⃣ Save layout (store in meters for consistency with existing DB schema)
        layout_id = f"LAY-{str(uuid.uuid4())[:8].upper()}"
        
        layout = PlantingLayout(
            layout_id=layout_id,
            field_id=field_id,
            row_spacing=row_spacing_m,
            plant_spacing=plant_spacing_m,
            total_plants=layout_data["total_plants"],
            plant_positions=layout_data.get("plants", []),
            grid_parameters=layout_data.get("grid_parameters", {
                "row_spacing_cm": row_spacing_cm,
                "plant_spacing_cm": plant_spacing_cm,
                "field_area_ha": field.area_hectares
            }),
            boundary_coords=boundary_coords,
            coverage_percentage=round(coverage, 2)
        )

        db.add(layout)
        db.commit()
        db.refresh(layout)

        return {
            "message": "Layout generated successfully",
            "layout_id": layout_id,
            "summary": {
                "total_plants": layout.total_plants,
                "coverage_percentage": layout.coverage_percentage,
                "row_spacing_cm": row_spacing_cm,
                "plant_spacing_cm": plant_spacing_cm,
                "field_area_ha": field.area_hectares,
                "plants_per_ha": int(layout.total_plants / field.area_hectares) if field.area_hectares > 0 else 0,
                "boundary_used": field.boundary_geojson is not None
            },
            "sample_positions": layout_data.get("plants", [])[:3]  # First 3 plants
        }

    except Exception as e:
        logger.error(f"Layout generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Layout generation failed: {str(e)}")


def create_fallback_layout(
    area_ha: float, 
    row_spacing_cm: float, 
    plant_spacing_cm: float
) -> dict:
    """Create fallback layout when generator fails
    
    Args:
        area_ha: Field area in hectares
        row_spacing_cm: Row spacing in centimeters
        plant_spacing_cm: Plant spacing in centimeters
    """
    # Convert cm to meters for calculations
    row_spacing_m = row_spacing_cm / 100
    plant_spacing_m = plant_spacing_cm / 100
    
    # Calculate total plants
    field_area_m2 = area_ha * 10000
    plants_per_m2 = 1 / (row_spacing_m * plant_spacing_m)
    total_plants = int(field_area_m2 * plants_per_m2)
    
    # Generate simple positions
    plants = []
    side_length = math.sqrt(field_area_m2)
    rows = int(side_length / row_spacing_m)
    cols = int(side_length / plant_spacing_m)
    
    for row in range(min(rows, 50)):  # Limit to 50 rows max
        for col in range(min(cols, 50)):  # Limit to 50 cols max
            if len(plants) >= total_plants:
                break
            plants.append({
                "id": len(plants) + 1,
                "x": round(col * plant_spacing_m, 2),
                "y": round(row * row_spacing_m, 2),
                "row": row,
                "col": col
            })
    
    return {
        "total_plants": total_plants,
        "plants": plants[:1000],  # Limit to 1000 positions
        "grid_parameters": {
            "row_spacing_cm": row_spacing_cm,
            "plant_spacing_cm": plant_spacing_cm,
            "field_area_ha": area_ha,
            "plants_per_m2": round(plants_per_m2, 2),
            "is_fallback": True
        }
    }


@router.get("")
async def get_layouts(
    field_id: Optional[str] = None,
    limit: int = Query(10, le=100, description="Number of layouts to return"),
    db: Session = Depends(get_db)
):
    """Get planting layouts"""
    try:
        query = db.query(PlantingLayout)

        if field_id:
            query = query.filter(PlantingLayout.field_id == field_id)

        layouts = query.order_by(PlantingLayout.created_at.desc()) \
            .limit(limit) \
            .all()

        return [{
            "layout_id": layout.layout_id,
            "field_id": layout.field_id,
            "created_at": layout.created_at.isoformat() if layout.created_at else None,
            "total_plants": layout.total_plants,
            "coverage_percentage": layout.coverage_percentage,
            "row_spacing_cm": round(layout.row_spacing * 100, 1),
            "plant_spacing_cm": round(layout.plant_spacing * 100, 1),
            "has_positions": bool(layout.plant_positions)
        } for layout in layouts]
        
    except Exception as e:
        logger.error(f"Error getting layouts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{layout_id}")
async def get_layout(
    layout_id: str,
    include_positions: bool = Query(False, description="Include plant positions"),
    db: Session = Depends(get_db)
):
    """Get specific layout"""
    try:
        layout = db.query(PlantingLayout) \
            .filter(PlantingLayout.layout_id == layout_id) \
            .first()

        if not layout:
            raise HTTPException(status_code=404, detail="Layout not found")

        result = {
            "layout_id": layout.layout_id,
            "field_id": layout.field_id,
            "created_at": layout.created_at.isoformat() if layout.created_at else None,
            "total_plants": layout.total_plants,
            "coverage_percentage": layout.coverage_percentage,
            "row_spacing_cm": round(layout.row_spacing * 100, 1),
            "plant_spacing_cm": round(layout.plant_spacing * 100, 1),
            "grid_parameters": layout.grid_parameters
        }

        if include_positions:
            result["plant_positions"] = layout.plant_positions
            result["boundary_coords"] = layout.boundary_coords

        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting layout {layout_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{layout_id}/validate")
async def validate_layout(
    layout_id: str,
    db: Session = Depends(get_db)
):
    """Validate layout calculations"""
    layout = db.query(PlantingLayout) \
        .filter(PlantingLayout.layout_id == layout_id) \
        .first()
    
    if not layout:
        raise HTTPException(status_code=404, detail="Layout not found")
    
    # Validate calculations
    expected_plants_per_m2 = 1 / (layout.row_spacing * layout.plant_spacing)
    expected_total_plants = int(layout.grid_parameters.get("field_area_ha", 1) * 10000 * expected_plants_per_m2)
    
    is_valid = abs(layout.total_plants - expected_total_plants) < (expected_total_plants * 0.1)  # Within 10%
    
    return {
        "layout_id": layout_id,
        "is_valid": is_valid,
        "validation": {
            "expected_plants": expected_total_plants,
            "actual_plants": layout.total_plants,
            "difference": layout.total_plants - expected_total_plants,
            "difference_percent": round(abs(layout.total_plants - expected_total_plants) / expected_total_plants * 100, 2),
            "row_spacing_cm": round(layout.row_spacing * 100, 1),
            "plant_spacing_cm": round(layout.plant_spacing * 100, 1),
            "plants_per_m2_expected": round(expected_plants_per_m2, 2),
            "plants_per_m2_actual": round(layout.total_plants / (layout.grid_parameters.get("field_area_ha", 1) * 10000), 2)
        }
    }