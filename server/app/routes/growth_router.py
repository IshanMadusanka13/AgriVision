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

# Load environment variables from .env file in parent directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

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

router = APIRouter()

# Load YOLOv8 model (දැනට pretrained model එකක් use කරනවා - ඔයාගේ custom trained model path එක දාන්න)
MODEL_PATH = os.getenv("MODEL_PATH", "best.pt")  # ඔයාගේ trained model path එක මෙතන දාන්න
try:
    # Set torch.load to use weights_only=False for loading custom YOLO models
    # This is safe because we trust our own trained model
    torch.serialization.clear_safe_globals()
    model = YOLO(MODEL_PATH)
    print(f"✓ Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    model = None
    print(f"YOLOv8 model load වෙන්නේ නැහැ. Error: {str(e)}")
    print(f"Model path එක check කරන්න: {MODEL_PATH}")


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
    if not model:
        raise HTTPException(status_code=500, detail="YOLOv8 model එක පද්ධතිය තුළ නැත.")

    try:
        # පින්තූරය කියවීම (Read Image)
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Image එක කියවිය නොහැක.")

        # determine_growth_stage function එක use කරලා detection සහ stage determine කිරීම
        growth_stage_key, confidence, counts, debug_image_path = determine_growth_stage(img, model)

        # Convert stage key to readable format
        stage_map = {
            "early_vegetative": "Early Vegetative Stage",
            "vegetative": "Vegetative Stage",
            "flowering": "Flowering Stage",
            "fruiting": "Fruiting Stage",
            "ripening": "Ripening/Harvesting Stage",
            "unknown": "Unknown (Not a Scotch Bonnet plant)"
        }
        growth_stage = stage_map.get(growth_stage_key, "Unknown Stage")

        # Scotch Bonnet plant නැත්නම්
        if growth_stage_key == "unknown":
            return DetectionResult(
                growth_stage=growth_stage,
                leaves_count=counts.leaf,
                flowers_count=counts.flower,
                fruits_count=counts.fruit,
                confidence=round(confidence / 100, 4)
            )

        # අවසන් ප්‍රතිඵලය ලබා දීම
        return DetectionResult(
            growth_stage=growth_stage,
            leaves_count=counts.leaf,
            flowers_count=counts.flower,
            fruits_count=counts.fruit,
            confidence=round(confidence / 100, 4)
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"හඳුනාගැනීමේ දෝෂයක්: {str(e)}")


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
    humidity: Optional[float] = Form(None)
):
    try:
        detection = await detect_plant(file)

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

        return {
            "detection": detection,
            "recommendation": recommendation
        }
    except Exception as e:
        import traceback
        print(f"Full analysis error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Full analysis error: {str(e)}")
