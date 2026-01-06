# app/routes/planting/planting_router.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
import uuid
from datetime import datetime

# Import YOUR database
from configs.database import Base, get_db

# Import models
from models.planting.planting_models import PlantingCalculation

# Import services
from services.planting.planting_service import planting_service
from services.planting.optimization import planting_optimizer

# Import schemas
from schemas.planting.planting_schemas import (
    PlantingRequest, PlantingResponse, SpacingResult,
    DensityResult, FertilizerResult, SuitabilityResult, OptimizationResult
)

router = APIRouter()

@router.post("/calculate", response_model=PlantingResponse)
async def calculate_planting(
    request: PlantingRequest,
    db: Session = Depends(get_db)
):
    """Calculate optimal planting layout - SIMPLE WORKING VERSION"""
    try:
        # Generate unique ID
        calculation_id = str(uuid.uuid4())[:8]
        
        # 1. Calculate spacing
        spacing = planting_service.calculate_spacing(
            ph=request.soil_ph,
            temp=request.temperature_c,
            soil_type=request.soil_type.value
        )
        
        # 2. Calculate density
        density = planting_service.calculate_density(
            area_m2=request.field_area_m2,
            row_spacing_cm=spacing["row_spacing_cm"],
            plant_spacing_cm=spacing["plant_spacing_cm"]
        )
        
        # 3. Fertilizer recommendation
        fertilizer = planting_service.recommend_fertilizer(
            n=request.nitrogen_ppm,
            p=request.phosphorus_ppm,
            k=request.potassium_ppm
        )
        
        # 4. Soil suitability
        suitability = planting_service.calculate_suitability(
            ph=request.soil_ph,
            soil_type=request.soil_type.value,
            temp=request.temperature_c
        )
        
        # 5. Run optimization if enabled
        optimization = None
        if request.enable_optimization:
            optimization = planting_optimizer.optimize(
                area_m2=request.field_area_m2,
                soil_score=suitability["soil_suitability_score"] / 100
            )
            
            # Use optimized spacing (convert from meters to cm)
            spacing["row_spacing_cm"] = optimization["optimized_row_spacing_m"] * 100
            spacing["plant_spacing_cm"] = optimization["optimized_plant_spacing_m"] * 100
            
            # Recalculate density
            density = planting_service.calculate_density(
                area_m2=request.field_area_m2,
                row_spacing_cm=spacing["row_spacing_cm"],
                plant_spacing_cm=spacing["plant_spacing_cm"]
            )
        
        # 6. Generate simple recommendations
        recommendations = []
        if suitability["soil_suitability_score"] < 70:
            recommendations.append("Consider soil amendments before planting")
        if spacing["row_spacing_cm"] > 80:  # 80 cm = 0.8 m
            recommendations.append("Wider spacing recommended due to soil conditions")
        
        # 7. Save to database (convert cm to m for storage)
        db_calc = PlantingCalculation(
            calculation_id=calculation_id,
            crop_type=request.crop_type,
            field_area_m2=request.field_area_m2,
            soil_ph=request.soil_ph,
            soil_type=request.soil_type.value,
            temperature_c=request.temperature_c,
            row_spacing_m=spacing["row_spacing_cm"] / 100,
            plant_spacing_m=spacing["plant_spacing_cm"] / 100,
            total_plants=density["total_plants"],
            plants_per_m2=density["plants_per_m2"],
            optimization_enabled=request.enable_optimization,
            optimization_score=optimization["fitness_score"] if optimization else None
        )
        db.add(db_calc)
        db.commit()
        
        # 8. Prepare response
        return PlantingResponse(
            calculation_id=calculation_id,
            timestamp=datetime.utcnow(),
            crop_type=request.crop_type,
            spacing=SpacingResult(**spacing),
            density=DensityResult(**density),
            fertilizer=FertilizerResult(**fertilizer),
            suitability=SuitabilityResult(**suitability),
            optimization=OptimizationResult(**optimization) if optimization else None,
            recommendations=recommendations[:3],
            warnings=[]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history")
async def get_planting_history(
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Get planting calculation history"""
    calculations = db.query(PlantingCalculation)\
        .order_by(PlantingCalculation.created_at.desc())\
        .limit(limit)\
        .all()
    
    return [calc.to_dict() for calc in calculations]

@router.get("/health")
async def planting_health():
    """Health check for planting module"""
    return {
        "module": "precision_planting",
        "status": "operational",
        "version": "1.0.0"
    }