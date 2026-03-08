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
    from services.growth_recommendations_service import (
        GrowthRecommendation,
        DetectionCounts,
        determine_growth_stage,
        generate_growth_recommendations
    )
except ImportError:
    from services.growth_recommendations_service import (
        GrowthRecommendation,
        DetectionCounts,
        determine_growth_stage,
        generate_growth_recommendations
    )

try:
    from services.supabase_service import SupabaseService
except ImportError:
    from services.supabase_service import SupabaseService

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
async def detect_plant(file: UploadFile = File(...), user_email: Optional[str] = Form(None)):

    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Failed to read image file.")

        # Use determine_growth_stage function to perform detection and determine growth stage
        growth_stage_key, confidence, counts, debug_image_path, annotated_img = determine_growth_stage(img, model)

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
            from services.plant_tracking_service import PlantTrackingService
            tracking_service = PlantTrackingService(
                yolo_model_path=None,

                aruco_dict_type=cv2.aruco.DICT_ARUCO_ORIGINAL
            )

            # Detect ArUco marker
            marker_info = tracking_service.detect_aruco_marker(img)
            print(f"[ArUco] marker_info = {marker_info}")

            if marker_info:
                plant_id = marker_info['plant_id']
                print(f"[ArUco] ✓ Plant ID detected: {plant_id}")

                # Calculate plant height if we have leaf detections
                if counts.leaf > 0:
                    # Collect all leaf bounding-box tops from YOLO
                    results = model.predict(img, conf=0.1)
                    leaf_tops = []  # (top_y, center_x) per detection

                    for result in results:
                        for box in result.boxes:
                            cls_id = int(box.cls[0])
                            label = model.names[cls_id].lower()
                            if label == 'leaf':
                                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                                leaf_tops.append((float(min(y1, y2)), int((x1 + x2) / 2)))

                    highest_y = None
                    highest_x = None

                    if leaf_tops:
                        # Sort ascending by Y (smallest Y = highest in image)
                        leaf_tops.sort(key=lambda t: t[0])
                        # Average the top-3 leaf bbox tops: more stable than
                        # a single highest edge which can be noisy across frames.
                        n = min(3, len(leaf_tops))
                        highest_y = sum(t[0] for t in leaf_tops[:n]) / n
                        highest_x = int(sum(t[1] for t in leaf_tops[:n]) / n)

                    ground_level_y = marker_info['bottom_center'][1]
                    ground_level_x = marker_info['bottom_center'][0]
                    print(f"[ArUco] highest_y={highest_y}, ground_level_y={ground_level_y}, pixel_size={marker_info['pixel_size']:.2f}")

                    if highest_y is not None:
                        # Look up the real marker size from DB; fall back to 5 cm
                        MARKER_CM = 5.0
                        if user_email:
                            try:
                                _u = supabase_service.get_user_by_email(user_email)
                                if _u:
                                    MARKER_CM = supabase_service.get_marker_size(_u["id"], plant_id)
                            except Exception:
                                pass
                        print(f"[ArUco] marker size = {MARKER_CM} cm (plant_id={plant_id})")

                        # Perspective correction using the marker's horizontal edges.
                        # The top and bottom edges of the marker represent the same
                        # real-world width (MARKER_CM) but appear as different pixel
                        # widths when the camera is angled.  This slope tells us
                        # how pixel/cm scale changes with image-Y, so we can
                        # interpolate an accurate scale at both the plant top and
                        # ground, then use their average for the height division.
                        c = marker_info['corners'].astype(float)
                        by_y = sorted(c, key=lambda p: p[1])
                        top_two, bot_two = by_y[:2], by_y[2:]

                        top_edge_px = abs(top_two[0][0] - top_two[1][0])
                        bot_edge_px  = abs(bot_two[0][0]  - bot_two[1][0])
                        y_top_edge = (top_two[0][1] + top_two[1][1]) / 2
                        y_bot_edge  = (bot_two[0][1]  + bot_two[1][1]) / 2

                        if top_edge_px >= 5 and bot_edge_px >= 5:
                            scale_t = top_edge_px / MARKER_CM   # px/cm at marker top
                            scale_b = bot_edge_px  / MARKER_CM   # px/cm at marker bottom
                            dy_m    = max(y_bot_edge - y_top_edge, 1.0)
                            grad    = (scale_b - scale_t) / dy_m  # px/cm per image-Y pixel

                            scale_plant_top = max(scale_t + grad * (highest_y    - y_top_edge), 1.0)
                            scale_ground    = max(scale_t + grad * (ground_level_y - y_top_edge), 1.0)
                            pixel_ratio     = (scale_plant_top + scale_ground) / 2
                            print(f"[ArUco] Perspective: top_edge={top_edge_px:.1f}px "
                                  f"bot_edge={bot_edge_px:.1f}px grad={grad:.4f} "
                                  f"scale_top={scale_plant_top:.2f} scale_gnd={scale_ground:.2f}")
                        else:
                            # Fallback: vertical pixel size from marker (no perspective)
                            pixel_ratio = marker_info['pixel_size'] / MARKER_CM

                        plant_height_cm = (ground_level_y - highest_y) / pixel_ratio
                        plant_height_cm = round(plant_height_cm, 1)
                        print(f"[ArUco] ✓ Plant height: {plant_height_cm} cm")

                        # Height monotonicity guard
                        if plant_id is not None and user_email:
                            try:
                                _user = supabase_service.get_user_by_email(user_email)
                                if _user:
                                    prev_max = supabase_service.get_max_height_for_plant(
                                        _user["id"], plant_id
                                    )
                                    if prev_max is not None and plant_height_cm < prev_max:
                                        plant_height_cm = prev_max
                            except Exception as hg_err:
                                print(f"[height-guard] skipped: {hg_err}")

                        # Draw height visualization on annotated image
                        if annotated_img is not None and debug_image_path:
                            out = annotated_img.copy()

                            # ArUco marker border
                            corners = marker_info['corners'].astype(int)
                            cv2.polylines(out, [corners], True, (0, 255, 0), 3)
                            cv2.putText(out, f"Plant ID: {plant_id}",
                                        (corners[0][0], corners[0][1] - 12),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

                            # Ground level horizontal line
                            cv2.line(out, (0, ground_level_y), (out.shape[1], ground_level_y),
                                     (0, 0, 255), 2)

                            # Top leaf point
                            top_pt = (highest_x, int(highest_y))
                            cv2.circle(out, top_pt, 8, (255, 0, 255), -1)

                            # Vertical height line
                            cv2.line(out, (ground_level_x, ground_level_y),
                                     (ground_level_x, int(highest_y)), (255, 0, 255), 2)

                            # Height label at midpoint
                            mid_y = (ground_level_y + int(highest_y)) // 2
                            cv2.putText(out, f"{plant_height_cm} cm",
                                        (ground_level_x + 12, mid_y),
                                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 0, 255), 2)

                            cv2.imwrite(debug_image_path, out)
                            print(f"[ArUco] ✓ Height annotated image saved: {debug_image_path}")
                    else:
                        print("[ArUco] ✗ No leaf detected — height cannot be calculated")
                else:
                    print(f"[ArUco] ✗ leaf count = {counts.leaf} — height skipped")
            else:
                print("[ArUco] ✗ No marker detected in image")
        except Exception as e:
            # ArUco detection failed, but continue with regular detection
            print(f"[ArUco] ERROR: {e}")

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

        growth_stage_key, confidence, counts, debug_image_path, annotated_img_fa = determine_growth_stage(img, model)

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

        # ArUco-based plant ID + height measurement (same logic as /detect)
        fa_plant_id = None
        fa_plant_height_cm = None
        try:
            from services.plant_tracking_service import PlantTrackingService
            _tracking = PlantTrackingService(
                yolo_model_path=None,

                aruco_dict_type=cv2.aruco.DICT_ARUCO_ORIGINAL
            )
            fa_marker = _tracking.detect_aruco_marker(img)
            if fa_marker and counts.leaf > 0:
                fa_plant_id = fa_marker['plant_id']
                # Look up real marker size from DB
                fa_marker_cm = 5.0
                if user_email:
                    try:
                        _u = supabase_service.get_user_by_email(user_email)
                        if _u:
                            fa_marker_cm = supabase_service.get_marker_size(_u["id"], fa_plant_id)
                    except Exception:
                        pass
                print(f"[full_analysis] marker size = {fa_marker_cm} cm (plant_id={fa_plant_id})")
                fa_results = model.predict(img, conf=0.3)
                fa_leaf_tops = []
                for r in fa_results:
                    for box in r.boxes:
                        if model.names[int(box.cls[0])].lower() == 'leaf':
                            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                            fa_leaf_tops.append((float(min(y1, y2)), int((x1 + x2) / 2)))
                if fa_leaf_tops:
                    fa_leaf_tops.sort(key=lambda t: t[0])
                    n = min(3, len(fa_leaf_tops))
                    fa_highest_y = sum(t[0] for t in fa_leaf_tops[:n]) / n
                    fa_ground_y  = fa_marker['bottom_center'][1]
                    fa_c = fa_marker['corners'].astype(float)
                    fa_by_y = sorted(fa_c, key=lambda p: p[1])
                    fa_top2, fa_bot2 = fa_by_y[:2], fa_by_y[2:]
                    fa_top_px = abs(fa_top2[0][0] - fa_top2[1][0])
                    fa_bot_px = abs(fa_bot2[0][0] - fa_bot2[1][0])
                    fa_y_top  = (fa_top2[0][1] + fa_top2[1][1]) / 2
                    fa_y_bot  = (fa_bot2[0][1] + fa_bot2[1][1]) / 2
                    if fa_top_px >= 5 and fa_bot_px >= 5:
                        st = fa_top_px / fa_marker_cm
                        sb = fa_bot_px / fa_marker_cm
                        g  = (sb - st) / max(fa_y_bot - fa_y_top, 1.0)
                        pr = (max(st + g * (fa_highest_y - fa_y_top), 1.0) +
                              max(st + g * (fa_ground_y  - fa_y_top), 1.0)) / 2
                    else:
                        pr = fa_marker['pixel_size'] / fa_marker_cm
                    fa_plant_height_cm = round((fa_ground_y - fa_highest_y) / pr, 1)
                    print(f"[full_analysis] plant_id={fa_plant_id} height={fa_plant_height_cm}cm")
        except Exception as aruco_err:
            print(f"[full_analysis] ArUco skipped: {aruco_err}")

        # ── Height monotonicity guard ─────────────────────────────────────────
        # A plant can only grow taller. If the new measurement is below the
        # previously recorded maximum for this plant, keep the previous max.
        if fa_plant_id is not None and fa_plant_height_cm is not None and user_email:
            try:
                _user = supabase_service.get_user_by_email(user_email)
                if _user:
                    prev_max = supabase_service.get_max_height_for_plant(
                        _user["id"], fa_plant_id
                    )
                    if prev_max is not None and fa_plant_height_cm < prev_max:
                        print(
                            f"[height-guard] new={fa_plant_height_cm} < prev_max={prev_max} "
                            f"→ clamping to {prev_max}"
                        )
                        fa_plant_height_cm = prev_max
            except Exception as hg_err:
                print(f"[height-guard] skipped: {hg_err}")

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
                        "ripening_count": 0,
                        "plant_id": fa_plant_id,
                        "plant_height_cm": fa_plant_height_cm,
                    }

                    growth_rec_dict = {
                        "week_plan": recommendation.week_plan,
                        "warnings": recommendation.warnings,
                        "tips": recommendation.tips
                    }

                    session_id = supabase_service.save_complete_analysis(
                        user_id=user_id,
                        environmental_data=environmental_data,
                        image_urls=image_urls,
                        growth_stage_data=growth_stage_data,
                        weather_forecast=weather_forecast_data,
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


class SavePlantStartDateRequest(BaseModel):
    email: str
    marker_id: int
    start_date: str  # YYYY-MM-DD


@router.post("/plant")
async def save_plant_start_date(data: SavePlantStartDateRequest):
    """Save planting start date against an existing ArUco marker (plant age calculation)"""
    try:
        user = supabase_service.get_user_by_email(data.email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        result = supabase_service.save_plant_start_date(user["id"], data.marker_id, data.start_date)
        return {"success": True, "plant": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save plant: {str(e)}")


@router.get("/plant/{user_email}/{marker_id}")
async def get_plant_start_date(user_email: str, marker_id: int):
    """Get start_date for a specific plant (marker)"""
    try:
        user = supabase_service.get_user_by_email(user_email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        plant = supabase_service.get_plant_start_date(user["id"], marker_id)
        return {"success": True, "plant": plant}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get plant: {str(e)}")


@router.get("/plants/{user_email}")
async def get_all_plants(user_email: str):
    """Get all plants (markers with start_date set) for a user"""
    try:
        user = supabase_service.get_user_by_email(user_email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        plants = supabase_service.get_all_plant_start_dates(user["id"])
        return {"success": True, "plants": plants}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get plants: {str(e)}")


@router.post("/check-marker")
async def check_marker(file: UploadFile = File(...)):
    """
    Lightweight endpoint: detect the ArUco marker in an image and return
    whether the camera angle is acceptable for height measurement.

    Returns:
        detected      – marker found in image
        marker_id     – id of the detected marker (or null)
        angle_ok      – True when perspective distortion is within tolerance
        skew_ratio    – top_edge_px / bot_edge_px  (1.0 = perfect, <0.60 = too steep)
        message       – human-readable guidance
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Failed to read image file.")

        from services.plant_tracking_service import PlantTrackingService
        tracking = PlantTrackingService(
            yolo_model_path=None,
            aruco_marker_size_cm=5.0,
            aruco_dict_type=cv2.aruco.DICT_ARUCO_ORIGINAL,
        )
        marker_info = tracking.detect_aruco_marker(img)
        print(f"[check_marker] marker_info = {marker_info}")

        if marker_info is None:
            return {
                "detected": False,
                "marker_id": None,
                "angle_ok": False,
                "skew_ratio": None,
                "message": "Marker not visible. Make sure the ArUco marker is clearly in frame.",
            }

        # Compute top / bottom edge widths (perspective skew indicator)
        c = marker_info["corners"].astype(float)
        by_y = sorted(c, key=lambda p: p[1])
        top_two, bot_two = by_y[:2], by_y[2:]
        top_edge_px = abs(top_two[0][0] - top_two[1][0])
        bot_edge_px  = abs(bot_two[0][0]  - bot_two[1][0])

        if max(top_edge_px, bot_edge_px) < 5:
            return {
                "detected": True,
                "marker_id": marker_info["plant_id"],
                "angle_ok": False,
                "skew_ratio": None,
                "message": "Marker is too small. Move closer to the marker.",
            }

        skew_ratio = round(
            float(min(top_edge_px, bot_edge_px)) / float(max(top_edge_px, bot_edge_px)), 3
        )

        # Also check marker height vs width (extreme side-angle)
        marker_h_px = float(marker_info["pixel_size"])
        marker_w_avg = (float(top_edge_px) + float(bot_edge_px)) / 2
        aspect = round(marker_h_px / max(marker_w_avg, 1.0), 3)

        SKEW_OK   = 0.60   # top/bottom edge ratio threshold
        ASPECT_OK = (0.40, 2.50)  # height/width range

        angle_ok = skew_ratio >= SKEW_OK and ASPECT_OK[0] <= aspect <= ASPECT_OK[1]

        if angle_ok:
            message = "Good angle! Marker is clearly visible."
        elif skew_ratio < SKEW_OK:
            message = "Camera angle is too steep. Move the camera to be more level with the marker."
        else:
            message = "Marker appears distorted. Try to face the marker more directly."

        return {
            "detected": True,
            "marker_id": int(marker_info["plant_id"]),
            "angle_ok": bool(angle_ok),
            "skew_ratio": skew_ratio,
            "message": message,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Marker check error: {str(e)}")


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


@router.get("/smart-advice/{plant_id}")
async def get_smart_advice(plant_id: str, growth_stage: str):
    """
    Called by the app after a scan to get peer-benchmarked tips.
    /api/growth/smart-advice/8?growth_stage=Vegetative%20Stage
    """
    try:
        from services.smart_advice_service import generate_smart_advice
        result = generate_smart_advice(plant_id, growth_stage)
        return {"success": True, **result}
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Smart advice error: {str(e)}")
