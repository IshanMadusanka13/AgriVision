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
    from app.services.weather_service import weather_service
except ImportError:
    from app.services.weather_service import weather_service

try:
    from app.services.growth_recommendations_service import (
        GrowthRecommendation,
        DetectionCounts,
        determine_growth_stage,
        generate_growth_recommendations
    )
except ImportError:
    from app.services.growth_recommendations_service import (
        GrowthRecommendation,
        DetectionCounts,
        determine_growth_stage,
        generate_growth_recommendations
    )

try:
    from app.services.supabase_service import SupabaseService
except ImportError:
    from app.services.supabase_service import SupabaseService

supabase_service = SupabaseService()

router = APIRouter()

# Load YOLO model from environment variable
model_path = os.getenv('GROWTH_MODEL_PATH', 'models/growth.pt')
if not os.path.isabs(model_path):
    model_path = os.path.join(os.path.dirname(__file__), '..', model_path)
model = YOLO(model_path)


class GrowthRequest(BaseModel):
    growth_stage: str
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
    plant_height_cm: Optional[float] = None
    plant_id: Optional[int] = None


@router.get("/")
async def root():
    return {
        "message": "Scotch Bonnet Plant Monitor API",
        "version": "3.0",
        "endpoints": {
            "detect": "/detect - POST image for plant detection",
            "recommend": "/recommend - POST for growth recommendations",
            "full_analysis": "/full_analysis - POST image for complete analysis with environmental data",
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
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Failed to read image file.")

        # Use determine_growth_stage function to perform detection and determine growth stage
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

        # Try to detect ArUco marker and measure plant height
        plant_height_cm = None
        plant_id = None

        try:
            from app.services.plant_tracking_service import PlantTrackingService
            tracking_service = PlantTrackingService(
                yolo_model_path=None,  # We already have detections
                aruco_marker_size_cm=5.0
            )

            # Detect ArUco marker
            marker_info = tracking_service.detect_aruco_marker(img)

            if marker_info:
                plant_id = marker_info['plant_id']

                # Calculate plant height if we have leaf detections
                if counts.leaf > 0:
                    # Get the highest leaf point from YOLO detections
                    results = model.predict(img, conf=0.5)
                    highest_y = None

                    for result in results:
                        for box in result.boxes:
                            cls_id = int(box.cls[0])
                            label = model.names[cls_id].lower()

                            if label == 'leaf':
                                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                                top_y = min(y1, y2)

                                if highest_y is None or top_y < highest_y:
                                    highest_y = top_y

                    if highest_y is not None:
                        ground_level_y = marker_info['bottom_center'][1]
                        pixel_ratio = marker_info['pixel_size'] / 5.0
                        plant_height_cm = (ground_level_y - highest_y) / pixel_ratio
                        plant_height_cm = round(plant_height_cm, 1)
        except Exception as e:
            # ArUco detection failed, but continue with regular detection
            print(f"ArUco detection error (continuing without height): {e}")

        return DetectionResult(
            growth_stage=growth_stage,
            leaves_count=counts.leaf,
            flowers_count=counts.flower,
            fruits_count=counts.fruit,
            confidence=round(confidence / 100, 4),
            plant_height_cm=plant_height_cm,
            plant_id=plant_id
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection error: {str(e)}")


@router.post("/recommend", response_model=GrowthRecommendation)
async def recommend_growth(request: GrowthRequest):
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

        recommendation = generate_growth_recommendations(
            request.growth_stage,
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

        growth_request = GrowthRequest(
            growth_stage=detection.growth_stage,
            latitude=latitude,
            longitude=longitude,
            weather_condition=weather,
            temperature=temperature,
            ph=ph,
            humidity=humidity
        )

        recommendation = await recommend_growth(growth_request)

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

                    growth_rec_dict = {
                        "week_plan": recommendation.week_plan,
                        "warnings": recommendation.warnings,
                        "tips": recommendation.tips
                    }

                    session_id = supabase_service.save_complete_analysis(
                        user_id=user_id,
                        npk_data=None,  # No NPK data anymore
                        environmental_data=environmental_data,
                        image_urls=image_urls,
                        growth_stage_data=growth_stage_data,
                        weather_forecast=weather_forecast_data,
                        npk_status=None,  # No NPK status anymore
                        fertilizer_recommendation=growth_rec_dict
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
