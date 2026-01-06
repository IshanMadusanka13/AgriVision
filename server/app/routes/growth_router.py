from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import BaseModel
from typing import Optional
from ultralytics import YOLO
import cv2
import numpy as np
from datetime import datetime
import os
from io import BytesIO
from PIL import Image
from dotenv import load_dotenv
import torch

# Patch torch.load to use weights_only=False for custom YOLO models
# This is safe because we trust our own trained model
_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs.setdefault('weights_only', False)
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

# Import weather service
try:
    from services.weather_service import weather_service
except ImportError:
    from services.weather_service import weather_service

# Import fertilizer service
try:
    from services.fertilizer_service import (
        NPKInput,
        FertilizerRecommendation,
        DetectionCounts,
        determine_growth_stage,
        analyze_npk_levels,
        generate_fertilizer_plan
    )
except ImportError:
    from services.fertilizer_service import (
        NPKInput,
        FertilizerRecommendation,
        DetectionCounts,
        determine_growth_stage,
        analyze_npk_levels,
        generate_fertilizer_plan
    )

# Import Supabase service
try:
    from services.supabase_service import SupabaseService
except ImportError:
    from services.supabase_service import SupabaseService

# Initialize Supabase service
supabase_service = SupabaseService()

router = APIRouter()


class FertilizerRequest(BaseModel):
    growth_stage: str
    npk_levels: NPKInput
    latitude: Optional[float] = None  # Location latitude for weather API
    longitude: Optional[float] = None  # Location longitude for weather API
    weather_condition: Optional[str] = None  # Manual override: "sunny", "rainy", "cloudy"
    temperature: Optional[float] = None  # Manual override
    ph: Optional[float] = None  # Soil pH (0-14)
    humidity: Optional[float] = None  # Humidity percentage (0-100)


class DetectionResult(BaseModel):
    growth_stage: str
    leaves_count: int
    flowers_count: int
    fruits_count: int
    confidence: float


@router.get("/")
async def root():
    return {
        "message": "Scotch Bonnet Plant Monitor API",
        "version": "2.0",
        "endpoints": {
            "detect": "/detect - POST image for plant detection",
            "recommend": "/recommend - POST for fertilizer recommendation",
            "full_analysis": "/full_analysis - POST image + NPK data for complete analysis",
            "weather": "/weather - GET current weather data",
            "forecast": "/forecast - GET weather forecast"
        }
    }


@router.get("/weather")
async def get_weather(latitude: float, longitude: float):
    try:
        weather_data = weather_service.get_current_weather(latitude, longitude)
        return {
            "success": True,
            "data": weather_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather API error: {str(e)}")


@router.get("/forecast")
async def get_forecast(latitude: float, longitude: float, days: int = 7):
    try:
        if days > 7:
            days = 7

        forecast_data = weather_service.get_weather_forecast(latitude, longitude, days)
        return {
            "success": True,
            "data": forecast_data,
            "days": len(forecast_data)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather forecast error: {str(e)}")


@router.post("/detect", response_model=DetectionResult)
async def detect_plant(file: UploadFile = File(...)):

    try:
        # Read uploaded image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Failed to read image file.")

        # Use determine_growth_stage function to perform detection and determine growth stage
        growth_stage_key, confidence, counts, debug_image_path = determine_growth_stage(img)

        # Convert stage key to readable format
        stage_map = {
            "early_vegetative": "Early Vegetative Stage",
            "vegetative": "Vegetative Stage",
            "flowering": "Flowering Stage",
            "fruiting": "Fruiting Stage",
            "ripening": "Ripening/Harvesting Stage",
            "unknown": "Not a Scotch Bonnet plant"
        }
        growth_stage = stage_map.get(growth_stage_key, "Unknown Stage")

        # Return result (handles both detected and undetected plants)
        return DetectionResult(
            growth_stage=growth_stage,
            leaves_count=counts.leaf,
            flowers_count=counts.flower,
            fruits_count=counts.fruit,
            confidence=round(confidence / 100, 4)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection error: {str(e)}")


@router.post("/recommend", response_model=FertilizerRecommendation)
async def recommend_fertilizer(request: FertilizerRequest):
    try:
        weather_condition = request.weather_condition
        temperature = request.temperature
        humidity = request.humidity
        weather_forecast = None

        if request.latitude is not None and request.longitude is not None:
            weather_data = weather_service.get_current_weather(
                request.latitude,
                request.longitude
            )

            if weather_condition is None:
                weather_condition = weather_data["condition"]
            if temperature is None:
                temperature = weather_data["temperature"]
            if humidity is None:
                humidity = weather_data["humidity"]

            try:
                weather_forecast = weather_service.get_weather_forecast(
                    request.latitude,
                    request.longitude,
                    days=7
                )
            except Exception as e:
                print(f"Weather forecast error (will use current weather only): {e}")
                weather_forecast = None

        if weather_condition is None:
            weather_condition = "sunny"

        npk_status = analyze_npk_levels(request.npk_levels, request.growth_stage)

        recommendation = generate_fertilizer_plan(
            request.growth_stage,
            npk_status,
            weather_condition,
            temperature,
            request.ph,
            humidity,
            weather_forecast
        )

        return recommendation

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")


@router.post("/full_analysis")
async def full_analysis(
    file: UploadFile = File(...),
    nitrogen: float = Form(...),
    phosphorus: float = Form(...),
    potassium: float = Form(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    weather: Optional[str] = Form(None),
    temperature: Optional[float] = Form(None),
    ph: Optional[float] = Form(None),
    humidity: Optional[float] = Form(None),
    user_email: Optional[str] = Form(None),
    location_name: Optional[str] = Form(None),
    save_to_db: bool = Form(True)
):
    """
    Complete plant analysis with detection, NPK analysis, and fertilizer recommendations.
    Optionally saves all data to Supabase database.

    Args:
        file: Plant image
        nitrogen, phosphorus, potassium: NPK values in mg/kg
        latitude, longitude: Location coordinates
        weather: Weather condition override
        temperature: Temperature in Celsius
        ph: Soil pH (0-14)
        humidity: Humidity percentage (0-100)
        user_email: User email for database storage (optional)
        location_name: Location name/address (optional)
        save_to_db: Whether to save to database (default: True)
    """
    try:
        # Save uploaded file temporarily for processing
        import tempfile
        import shutil
        import cv2
        import numpy as np
        import os

        # Read file contents
        contents = await file.read()

        # Save to temp file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        temp_file.write(contents)
        temp_file.close()
        temp_file_path = temp_file.name

        # Perform detection using the temp file
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Failed to read image file.")

        # Use determine_growth_stage function to perform detection
        # This returns debug_image_path which contains the annotated image
        growth_stage_key, confidence, counts, debug_image_path = determine_growth_stage(img)

        # Save annotated image path for later upload
        annotated_image_path = debug_image_path if debug_image_path else None

        # Convert stage key to readable format
        stage_map = {
            "early_vegetative": "Early Vegetative Stage",
            "vegetative": "Vegetative Stage",
            "flowering": "Flowering Stage",
            "fruiting": "Fruiting Stage",
            "ripening": "Ripening/Harvesting Stage",
            "unknown": "Not a Scotch Bonnet plant"
        }
        growth_stage = stage_map.get(growth_stage_key, "Unknown Stage")

        # Create detection result
        from pydantic import BaseModel
        class DetectionResult(BaseModel):
            growth_stage: str
            leaves_count: int
            flowers_count: int
            fruits_count: int
            confidence: float

        detection = DetectionResult(
            growth_stage=growth_stage,
            leaves_count=counts.leaf,
            flowers_count=counts.flower,
            fruits_count=counts.fruit,
            confidence=round(confidence / 100, 4)
        )

        # Prepare NPK input
        npk_input = NPKInput(
            nitrogen=nitrogen,
            phosphorus=phosphorus,
            potassium=potassium
        )

        # Prepare fertilizer request
        fertilizer_request = FertilizerRequest(
            growth_stage=detection.growth_stage,
            npk_levels=npk_input,
            latitude=latitude,
            longitude=longitude,
            weather_condition=weather,
            temperature=temperature,
            ph=ph,
            humidity=humidity
        )

        # Get recommendation
        recommendation = await recommend_fertilizer(fertilizer_request)

        # Save to database if requested
        session_id = None
        if save_to_db:
            try:
                # Get or create user
                user_id = None
                if user_email:
                    user = supabase_service.get_user_by_email(user_email)
                    if not user:
                        user = supabase_service.create_user(user_email)
                        print(f"Created new user: {user_email}")
                    user_id = user.get('id') if user else None

                if user_id:
                    # Get weather data
                    current_weather = weather
                    weather_forecast_data = None

                    if latitude and longitude:
                        try:
                            weather_data = weather_service.get_current_weather(latitude, longitude)
                            if not current_weather:
                                current_weather = weather_data.get("condition")

                            weather_forecast_data = weather_service.get_weather_forecast(latitude, longitude, days=7)
                        except Exception as e:
                            print(f"Weather fetch error (continuing without weather): {e}")

                    # Prepare data for Supabase
                    npk_data = {
                        "nitrogen": nitrogen,
                        "phosphorus": phosphorus,
                        "potassium": potassium
                    }

                    environmental_data = {
                        "ph": ph,
                        "temperature": temperature,
                        "humidity": humidity,
                        "location": location_name,
                        "location_lat": latitude,
                        "location_lng": longitude,
                        "current_weather": current_weather
                    }

                    # Upload original image to Supabase Storage
                    original_image_url = None
                    annotated_image_url = None

                    try:
                        # Upload original image
                        original_image_url = supabase_service.upload_image(
                            temp_file_path,
                            bucket_name="plant-images",
                            user_id=user_id
                        )
                        if original_image_url:
                            print(f"✓ Original image uploaded: {original_image_url}")
                    except Exception as img_error:
                        print(f"⚠ Original image upload failed: {img_error}")

                    try:
                        # Upload annotated image (with YOLO detections)
                        if annotated_image_path and os.path.exists(annotated_image_path):
                            annotated_image_url = supabase_service.upload_image(
                                annotated_image_path,
                                bucket_name="plant-images",
                                user_id=user_id
                            )
                            if annotated_image_url:
                                print(f"✓ Annotated image uploaded: {annotated_image_url}")

                            # Clean up annotated image file
                            try:
                                os.unlink(annotated_image_path)
                            except:
                                pass
                    except Exception as img_error:
                        print(f"⚠ Annotated image upload failed: {img_error}")

                    image_urls = {
                        "original_image_url": original_image_url,
                        "annotated_image_url": annotated_image_url
                    }

                    growth_stage_data = {
                        "growth_stage": detection.growth_stage,
                        "confidence": detection.confidence,
                        "flower_count": detection.flowers_count,
                        "fruit_count": detection.fruits_count,
                        "leaf_count": detection.leaves_count,
                        "ripening_count": 0  # Add if available
                    }

                    # Get NPK status from recommendation (it's already a dictionary)
                    npk_status_dict = recommendation.npk_status

                    # npk_status_dict structure:
                    # {
                    #     "nitrogen": {"level": "low/optimal/high", "current": 70, "optimal": "80-120"},
                    #     "phosphorus": {"level": "...", "current": 90, "optimal": "..."},
                    #     "potassium": {"level": "...", "current": 170, "optimal": "..."}
                    # }

                    # Prepare fertilizer recommendation
                    # week_plan is already a list of dictionaries, no need to convert
                    fertilizer_rec_dict = {
                        "week_plan": recommendation.week_plan,
                        "warnings": recommendation.warnings,
                        "tips": recommendation.tips
                    }

                    # Save complete analysis
                    session_id = supabase_service.save_complete_analysis(
                        user_id=user_id,
                        npk_data=npk_data,
                        environmental_data=environmental_data,
                        image_urls=image_urls,
                        growth_stage_data=growth_stage_data,
                        weather_forecast=weather_forecast_data,
                        npk_status=npk_status_dict,
                        fertilizer_recommendation=fertilizer_rec_dict
                    )

                    print(f"✓ Analysis saved to database. Session ID: {session_id}")
                else:
                    print("⚠ No user_email provided, skipping database save")

            except Exception as db_error:
                # Log error but don't fail the request
                print(f"⚠ Database save failed (continuing): {str(db_error)}")
                import traceback
                traceback.print_exc()

        # Clean up temporary file
        try:
            import os
            os.unlink(temp_file_path)
        except:
            pass

        return {
            "success": True,
            "detection": detection,
            "recommendation": recommendation,
            "session_id": session_id,
            "saved_to_db": session_id is not None
        }

    except Exception as e:
        import traceback
        print(f"Full analysis error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Full analysis error: {str(e)}")


@router.get("/history/{user_email}")
async def get_user_history(user_email: str):
    """
    Get all analysis sessions for a specific user.

    Args:
        user_email: User's email address

    Returns:
        List of analysis sessions with basic information
    """
    try:
        # Get user by email
        user = supabase_service.get_user_by_email(user_email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user_id = user.get('id')

        # Get all sessions for this user (limit 100 to get all recent sessions)
        sessions = supabase_service.get_user_sessions(user_id, limit=100)

        return {
            "success": True,
            "sessions": sessions,
            "count": len(sessions)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"History fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.get("/session/{session_id}")
async def get_session_details(session_id: str):
    """
    Get detailed information about a specific analysis session.

    Args:
        session_id: UUID of the analysis session

    Returns:
        Complete session data including NPK status and fertilizer recommendations
    """
    try:
        # Get complete analysis from Supabase
        analysis = supabase_service.get_complete_analysis(session_id)

        if not analysis:
            raise HTTPException(status_code=404, detail="Session not found")

        return {
            "success": True,
            "analysis": analysis
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Session details fetch error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch session details: {str(e)}")
