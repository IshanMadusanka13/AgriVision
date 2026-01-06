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

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

_original_torch_load = torch.load
def _patched_torch_load(*args, **kwargs):
    kwargs.setdefault('weights_only', False)
    return _original_torch_load(*args, **kwargs)
torch.load = _patched_torch_load

try:
    from services.weather_service import weather_service
except ImportError:
    from services.weather_service import weather_service

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

try:
    from services.supabase_service import SupabaseService
except ImportError:
    from services.supabase_service import SupabaseService

supabase_service = SupabaseService()

router = APIRouter()

MODEL_PATH = os.getenv("MODEL_PATH", "best.pt")
try:
    torch.serialization.clear_safe_globals()
    model = YOLO(MODEL_PATH)
    print(f"✓ Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    model = None
    print(f"Failed to load YOLOv8 model. Error: {str(e)}")
    print(f"Please check model path: {MODEL_PATH}")


class FertilizerRequest(BaseModel):
    growth_stage: str
    npk_levels: NPKInput
    latitude: Optional[float] = None  
    longitude: Optional[float] = None  
    weather_condition: Optional[str] = None  
    temperature: Optional[float] = None  
    ph: Optional[float] = None  
    humidity: Optional[float] = None  


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
    if not model:
        raise HTTPException(status_code=500, detail="YOLOv8 model is not loaded in the system.")

    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Failed to read image file.")

        growth_stage_key, confidence, counts, debug_image_path = determine_growth_stage(img, model)

        stage_map = {
            "early_vegetative": "Early Vegetative Stage",
            "vegetative": "Vegetative Stage",
            "flowering": "Flowering Stage",
            "fruiting": "Fruiting Stage",
            "ripening": "Ripening/Harvesting Stage",
            "unknown": "Not a Scotch Bonnet plant"
        }
        growth_stage = stage_map.get(growth_stage_key, "Unknown Stage")

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
    
    try:
        import tempfile
        import shutil
        import cv2
        import numpy as np
        import os

        contents = await file.read()

        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
        temp_file.write(contents)
        temp_file.close()
        temp_file_path = temp_file.name

        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Failed to read image file.")

        growth_stage_key, confidence, counts, debug_image_path = determine_growth_stage(img, model)

        annotated_image_path = debug_image_path if debug_image_path else None

        stage_map = {
            "early_vegetative": "Early Vegetative Stage",
            "vegetative": "Vegetative Stage",
            "flowering": "Flowering Stage",
            "fruiting": "Fruiting Stage",
            "ripening": "Ripening/Harvesting Stage",
            "unknown": "Not a Scotch Bonnet plant"
        }
        growth_stage = stage_map.get(growth_stage_key, "Unknown Stage")

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

        npk_input = NPKInput(
            nitrogen=nitrogen,
            phosphorus=phosphorus,
            potassium=potassium
        )

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

        recommendation = await recommend_fertilizer(fertilizer_request)

        session_id = None
        if save_to_db:
            try:
                user_id = None
                if user_email:
                    user = supabase_service.get_user_by_email(user_email)
                    if not user:
                        user = supabase_service.create_user(user_email)
                        print(f"Created new user: {user_email}")
                    user_id = user.get('id') if user else None

                if user_id:
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

                    original_image_url = None
                    annotated_image_url = None

                    try:
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
                        if annotated_image_path and os.path.exists(annotated_image_path):
                            annotated_image_url = supabase_service.upload_image(
                                annotated_image_path,
                                bucket_name="plant-images",
                                user_id=user_id
                            )
                            if annotated_image_url:
                                print(f"✓ Annotated image uploaded: {annotated_image_url}")
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
                        "ripening_count": 0  
                    }

                    npk_status_dict = recommendation.npk_status

                    fertilizer_rec_dict = {
                        "week_plan": recommendation.week_plan,
                        "warnings": recommendation.warnings,
                        "tips": recommendation.tips
                    }

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
                print(f"⚠ Database save failed (continuing): {str(db_error)}")
                import traceback
                traceback.print_exc()

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
    
    try:
        user = supabase_service.get_user_by_email(user_email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user_id = user.get('id')

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
    
    try:
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
