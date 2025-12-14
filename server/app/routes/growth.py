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
        determine_growth_stage,
        analyze_npk_levels,
        generate_fertilizer_plan
    )
except ImportError:
    from services.fertilizer_service import (
        NPKInput,
        FertilizerRecommendation,
        determine_growth_stage,
        analyze_npk_levels,
        generate_fertilizer_plan
    )

router = APIRouter()

# Load YOLOv8 model (දැනට pretrained model එකක් use කරනවා - ඔයාගේ custom trained model path එක දාන්න)
MODEL_PATH = os.getenv("MODEL_PATH", "yolov8n.pt")  # ඔයාගේ trained model path එක මෙතන දාන්න
try:
    model = YOLO(MODEL_PATH)
except:
    model = None
    print("YOLOv8 model load වෙන්නේ නැහැ. කරුණාකරලා model path එක check කරන්න.")


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
            "detect": "/api/detect - POST image for plant detection",
            "recommend": "/api/recommend - POST for fertilizer recommendation",
            "full_analysis": "/api/full_analysis - POST image + NPK data for complete analysis",
            "weather": "/api/weather - GET current weather data",
            "forecast": "/api/forecast - GET weather forecast"
        }
    }


@router.get("/api/weather")
async def get_weather(latitude: float, longitude: float):
    try:
        weather_data = weather_service.get_current_weather(latitude, longitude)
        return {
            "success": True,
            "data": weather_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather API error: {str(e)}")


@router.get("/api/forecast")
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


@router.post("/api/detect", response_model=DetectionResult)
async def detect_plant(file: UploadFile = File(...)):
    if not model:
        raise HTTPException(status_code=500, detail="YOLOv8 model load වෙලා නැහැ")

    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Image එක read කරන්න බැහැ")

        results = model(img)

        leaves_count = 0
        flowers_count = 0
        fruits_count = 0

        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])

                if conf > 0.5:
                    if cls == 0:
                        leaves_count += 1
                    elif cls == 1:
                        flowers_count += 1
                    elif cls == 2:
                        fruits_count += 1

        growth_stage, confidence = determine_growth_stage(leaves_count, flowers_count, fruits_count)

        return DetectionResult(
            growth_stage=growth_stage,
            leaves_count=leaves_count,
            flowers_count=flowers_count,
            fruits_count=fruits_count,
            confidence=confidence
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection error: {str(e)}")


@router.post("/api/recommend", response_model=FertilizerRecommendation)
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


@router.post("/api/full_analysis")
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
