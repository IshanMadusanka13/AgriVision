"""
Plant Tracking Router
FastAPI endpoints for plant monitoring with ArUco markers
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import cv2
import numpy as np
from pydantic import BaseModel
import base64
from datetime import datetime
import io
from PIL import Image

from app.services.plant_tracking_service import PlantTrackingService
from app.services.supabase_service import SupabaseService
from app.configs.model_loader import get_growth_model

router = APIRouter(prefix="/api/plant-tracking", tags=["Plant Tracking"])

# Initialize services
supabase_service = SupabaseService()


class EnvironmentalData(BaseModel):
    """Environmental parameters for plant monitoring"""
    soil_ph: float
    humidity: float


class PlantMonitoringResponse(BaseModel):
    """Response model for plant monitoring"""
    success: bool
    plant_id: Optional[int] = None
    timestamp: Optional[str] = None
    height_cm: Optional[float] = None
    growth_stage: Optional[str] = None
    growth_stage_confidence: Optional[float] = None
    detection_counts: Optional[dict] = None
    fertilizer_recommendation: Optional[dict] = None
    annotated_image_base64: Optional[str] = None
    error: Optional[str] = None


def decode_image(file: UploadFile) -> np.ndarray:
    """
    Decode uploaded image file to numpy array.

    Args:
        file: Uploaded image file

    Returns:
        Image as numpy array in BGR format

    Raises:
        HTTPException: If image cannot be decoded
    """
    try:
        contents = file.file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        return image
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error decoding image: {str(e)}")


def encode_image_to_base64(image: np.ndarray) -> str:
    """
    Encode numpy array image to base64 string.

    Args:
        image: Image as numpy array

    Returns:
        Base64 encoded string
    """
    _, buffer = cv2.imencode('.jpg', image)
    return base64.b64encode(buffer).decode('utf-8')


@router.post("/monitor", response_model=PlantMonitoringResponse)
async def monitor_plant(
    image: UploadFile = File(..., description="Plant image with ArUco marker"),
    soil_ph: float = Form(..., description="Soil pH level (0-14)"),
    humidity: float = Form(..., description="Environmental humidity percentage (0-100)"),
    user_email: Optional[str] = Form(None, description="User email for tracking"),
    save_to_db: bool = Form(True, description="Save results to database")
):
    """
    Complete plant monitoring workflow with ArUco marker detection.

    **Process:**
    1. Detects ArUco marker for Plant ID
    2. Detects leaves/flowers/fruits with YOLO
    3. Calculates plant height using marker as reference
    4. Classifies growth stage
    5. Generates fertilizer recommendations based on pH and humidity
    6. Optionally saves to database

    **Returns:**
    - Plant ID from ArUco marker
    - Height in centimeters
    - Growth stage classification
    - Detection counts
    - Weekly fertilizer plan
    - Annotated image
    """
    try:
        # Decode image
        img = decode_image(image)

        # Initialize plant tracking service
        growth_model = get_growth_model()
        tracking_service = PlantTrackingService(
            yolo_model_path=growth_model,
            aruco_marker_size_cm=5.0  # Adjust based on your marker size
        )

        # Process plant monitoring
        result = tracking_service.process_plant_monitoring(
            image=img,
            soil_ph=soil_ph,
            humidity=humidity,
            annotate=True
        )

        if not result['success']:
            return PlantMonitoringResponse(
                success=False,
                error=result['error']
            )

        # Encode annotated image
        annotated_image_base64 = encode_image_to_base64(result['annotated_image'])

        # Save to database if requested
        session_id = None
        if save_to_db:
            try:
                # Create database log
                log = tracking_service.create_database_log(result)

                # Upload annotated image to Supabase storage
                annotated_image_url = await supabase_service.upload_image(
                    result['annotated_image'],
                    f"plant_{result['plant_id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
                )

                # Save to analysis_sessions table (modified for plant tracking)
                session_data = {
                    'user_email': user_email,
                    'plant_id': result['plant_id'],
                    'plant_height_cm': result['plant_height_cm'],
                    'growth_stage': result['growth_stage'],
                    'growth_stage_confidence': result['growth_stage_confidence'],
                    'leaf_count': result['detection_counts']['leaf'],
                    'flower_count': result['detection_counts']['flower'],
                    'fruit_count': result['detection_counts']['fruit'],
                    'ripening_count': result['detection_counts']['ripening'],
                    'ph': soil_ph,
                    'humidity': humidity,
                    'annotated_image_url': annotated_image_url,
                    'fertilizer_plan': log['fertilizer_plan'],
                    'recommendations': log['recommendations'],
                    'timestamp': result['timestamp']
                }

                # Note: You may need to modify your database schema to include plant_id and height_cm columns
                # session_id = await supabase_service.save_plant_tracking_session(session_data)

            except Exception as db_error:
                print(f"Database save error: {str(db_error)}")
                # Continue even if DB save fails

        # Return response
        return PlantMonitoringResponse(
            success=True,
            plant_id=result['plant_id'],
            timestamp=result['timestamp'],
            height_cm=result['plant_height_cm'],
            growth_stage=result['growth_stage'],
            growth_stage_confidence=result['growth_stage_confidence'],
            detection_counts=result['detection_counts'],
            fertilizer_recommendation=result['fertilizer_recommendation'],
            annotated_image_base64=annotated_image_base64
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing plant monitoring: {str(e)}")


@router.post("/detect-marker")
async def detect_aruco_marker(
    image: UploadFile = File(..., description="Image containing ArUco marker")
):
    """
    Detect ArUco marker in image and return plant ID.

    Useful for testing marker detection before full monitoring.

    **Returns:**
    - Plant ID (marker ID)
    - Marker position information
    """
    try:
        img = decode_image(image)

        # Initialize tracking service with dummy model path (not needed for marker detection)
        tracking_service = PlantTrackingService(
            yolo_model_path="dummy",  # Not used for marker detection
            aruco_marker_size_cm=5.0
        )

        marker_info = tracking_service.detect_aruco_marker(img)

        if marker_info is None:
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "error": "No ArUco marker detected in image"
                }
            )

        # Draw marker on image
        img_copy = img.copy()
        corners = marker_info['corners'].astype(int)
        cv2.polylines(img_copy, [corners], True, (0, 255, 0), 3)
        cv2.putText(
            img_copy,
            f"Plant ID: {marker_info['plant_id']}",
            (corners[0][0], corners[0][1] - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (0, 255, 0),
            2
        )

        annotated_image_base64 = encode_image_to_base64(img_copy)

        return {
            "success": True,
            "plant_id": marker_info['plant_id'],
            "marker_center": marker_info['center'],
            "marker_bottom_center": marker_info['bottom_center'],
            "annotated_image_base64": annotated_image_base64
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error detecting ArUco marker: {str(e)}")


@router.get("/plant/{plant_id}/history")
async def get_plant_history(
    plant_id: int,
    limit: int = 10
):
    """
    Get monitoring history for a specific plant.

    **Args:**
    - plant_id: ArUco marker ID
    - limit: Maximum number of records to return

    **Returns:**
    - List of historical monitoring sessions for the plant
    """
    try:
        # Note: Implement database query to fetch plant history
        # This is a placeholder - you'll need to add this to your supabase_service

        # Example implementation:
        # history = await supabase_service.get_plant_history(plant_id, limit)

        return {
            "success": True,
            "plant_id": plant_id,
            "message": "Database query not yet implemented. Please add get_plant_history() to supabase_service.py",
            "history": []
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching plant history: {str(e)}")


@router.get("/plants")
async def get_all_plants(user_email: Optional[str] = None):
    """
    Get list of all monitored plants.

    **Args:**
    - user_email: Optional filter by user email

    **Returns:**
    - List of unique plant IDs with latest monitoring data
    """
    try:
        # Note: Implement database query to fetch all plants
        # This is a placeholder

        return {
            "success": True,
            "message": "Database query not yet implemented",
            "plants": []
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching plants: {str(e)}")


@router.post("/generate-recommendation")
async def generate_fertilizer_recommendation(
    growth_stage: str = Form(...),
    height_cm: Optional[float] = Form(None),
    soil_ph: float = Form(...),
    humidity: float = Form(...)
):
    """
    Generate fertilizer recommendation without image processing.

    Useful for getting recommendations based on manual input.

    **Args:**
    - growth_stage: Current growth stage
    - height_cm: Plant height in centimeters (optional)
    - soil_ph: Soil pH level
    - humidity: Environmental humidity percentage

    **Returns:**
    - Weekly fertilizer plan
    - Warnings and recommendations
    """
    try:
        tracking_service = PlantTrackingService(
            yolo_model_path="dummy",
            aruco_marker_size_cm=5.0
        )

        recommendation = tracking_service.generate_fertilizer_recommendation(
            growth_stage=growth_stage,
            height_cm=height_cm,
            soil_ph=soil_ph,
            humidity=humidity
        )

        return {
            "success": True,
            "recommendation": recommendation
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating recommendation: {str(e)}")


# Health check endpoint
@router.get("/health")
async def health_check():
    """Check if plant tracking service is operational"""
    return {
        "status": "healthy",
        "service": "Plant Tracking with ArUco Markers",
        "timestamp": datetime.now().isoformat()
    }
