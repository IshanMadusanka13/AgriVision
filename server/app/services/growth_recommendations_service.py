from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel
import cv2
import numpy as np
from datetime import datetime
import os

try:
    from services.supabase_service import SupabaseService
except ImportError:
    from services.supabase_service import SupabaseService

_supabase = SupabaseService()

# Maps snake_case stage keys (from DB) to display names used in growth_router
_STAGE_KEY_TO_DISPLAY = {
    "early_vegetative": "Early Vegetative Stage",
    "vegetative": "Vegetative Stage",
    "flowering": "Flowering Stage",
    "fruiting": "Fruiting Stage",
    "ripening": "Ripening/Harvesting Stage",
    "general": "General",
}


# Models
class GrowthRecommendation(BaseModel):
    week_plan: List[Dict]
    warnings: List[str]
    tips: List[str]


class DetectionCounts(BaseModel):
    flower: int
    fruit: int
    leaf: int
    ripening: int


def _fmt(template: str, **kwargs) -> str:
    """Format a message template; silently ignore missing/extra keys."""
    try:
        return template.format(**kwargs)
    except (KeyError, ValueError):
        return template


def _load_condition_messages() -> Dict[str, Dict[str, List[str]]]:
    """Returns {condition_key: {'warnings': [...], 'tips': [...]}} from DB."""
    try:
        response = _supabase.client.table("condition_messages") \
            .select("condition_key, message_type, message") \
            .order("condition_key").order("sort_order").execute()

        result: Dict[str, Dict[str, List[str]]] = {}
        for row in response.data:
            key = row["condition_key"]
            mtype = row["message_type"]
            if key not in result:
                result[key] = {"warnings": [], "tips": []}
            if mtype == "warning":
                result[key]["warnings"].append(row["message"])
            elif mtype == "tip":
                result[key]["tips"].append(row["message"])
        return result
    except Exception as e:
        print(f"[condition_messages] DB read failed: {e}")
    return {}


def _load_stage_tips() -> Dict[str, List[str]]:
    """Returns {display_stage_name: [tip, ...]} mapping from DB."""
    try:
        response = _supabase.client.table("growth_stage_tips") \
            .select("stage, tip") \
            .order("stage").order("sort_order").execute()

        result: Dict[str, List[str]] = {}
        for row in response.data:
            display_name = _STAGE_KEY_TO_DISPLAY.get(row["stage"])
            if display_name:
                if display_name not in result:
                    result[display_name] = []
                result[display_name].append(row["tip"])
        return result
    except Exception as e:
        print(f"[stage_tips] DB read failed: {e}")
    return {}


def _load_conditions_config() -> dict:
    try:
        response = _supabase.client.table("conditions_config") \
            .select("ph_critical_low, ph_low, ph_high, humidity_very_high, humidity_high, humidity_low, temp_very_high, temp_high, temp_low") \
            .limit(1).execute()
        if response.data:
            return response.data[0]
    except Exception as e:
        print(f"[conditions_config] DB read failed: {e}")
    # Fallback defaults
    return {
        "ph_critical_low": 5.5, "ph_low": 6.0, "ph_high": 6.8,
        "humidity_very_high": 85.0, "humidity_high": 75.0, "humidity_low": 50.0,
        "temp_very_high": 32.0, "temp_high": 28.0, "temp_low": 15.0,
    }


def _load_fertilizer_plans() -> dict:
    """Returns {display_stage_name: [day_plan, ...]} mapping from DB."""
    try:
        response = _supabase.client.table("fertilizer_plans") \
            .select("stage, day, fertilizer_type, amount, method, watering") \
            .order("stage").order("sort_order").execute()

        result: dict = {}
        for row in response.data:
            display_name = _STAGE_KEY_TO_DISPLAY.get(row["stage"])
            if display_name:
                if display_name not in result:
                    result[display_name] = []
                result[display_name].append({
                    "day": row["day"],
                    "fertilizer_type": row["fertilizer_type"],
                    "amount": row["amount"],
                    "method": row["method"],
                    "watering": row["watering"],
                })
        return result
    except Exception as e:
        print(f"[fertilizer_plans] DB read failed: {e}")
    return {}


def determine_growth_stage(img: np.ndarray, model) -> Tuple[str, float, DetectionCounts, str, np.ndarray]:

    if img is None:
        return "unknown", 0.0, DetectionCounts(flower=0, fruit=0, leaf=0, ripening=0), "", img

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    debug_dir = "app/debug_images"
    os.makedirs(debug_dir, exist_ok=True)

    cv2.imwrite(os.path.join(debug_dir, f"input_{timestamp}.jpg"), img)

    # Enhance brightness/contrast using CLAHE on LAB lightness channel
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l = clahe.apply(l)
    img = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)

    results = model.predict(img, conf=0.7)
    counts = {"flower": 0, "fruit": 0, "leaf": 0, "ripening": 0}

    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            label = model.names[cls_id].lower()
            if label in counts:
                counts[label] += 1

    annotated_img = results[0].plot()
    output_path = os.path.join(debug_dir, f"output_{timestamp}.jpg")
    cv2.imwrite(output_path, annotated_img)

    avg_conf = float(results[0].boxes.conf.mean()) if len(results[0].boxes) > 0 else 0.0

    if counts["leaf"] == 0 or counts["leaf"] + counts["flower"] + counts["fruit"] == 0:
        return "unknown", 0.0, DetectionCounts(**counts), output_path, annotated_img

    confidence = min(avg_conf * 100, 100.0)

    if counts["ripening"] > 0:
        growth_stage = "ripening"
    elif counts["fruit"] > 0:
        growth_stage = "fruiting"
    elif counts["flower"] > 0:
        growth_stage = "flowering"
    elif counts["leaf"] > 5:
        growth_stage = "vegetative"
    else:
        growth_stage = "early_vegetative"

    return growth_stage, confidence, DetectionCounts(**counts), output_path, annotated_img


def generate_growth_recommendations(
    growth_stage: str,
    weather: str,
    temperature: Optional[float] = None,
    ph: Optional[float] = None,
    humidity: Optional[float] = None,
    weather_forecast: Optional[List[Dict]] = None
) -> GrowthRecommendation:

    warnings: List[str] = []
    tips: List[str] = []

    cond = _load_conditions_config()
    fertilizer_plans = _load_fertilizer_plans()
    stage_tips = _load_stage_tips()
    cond_msgs = _load_condition_messages()

    # Format values available for all message templates
    fmt = {
        "ph": f"{ph:.1f}" if ph is not None else "",
        "humidity": f"{humidity:.0f}" if humidity is not None else "",
        "temperature": f"{temperature:.0f}" if temperature is not None else "",
        "rainy_days": "",
        "day": "",
    }

    def _apply(key: str):
        msgs = cond_msgs.get(key, {})
        for w in msgs.get("warnings", []):
            warnings.append(_fmt(w, **fmt))
        for t in msgs.get("tips", []):
            tips.append(_fmt(t, **fmt))

    # pH recommendations
    if ph is not None:
        if ph < cond["ph_critical_low"]:
            _apply("ph_critical_low")
        elif ph < cond["ph_low"]:
            _apply("ph_low")
        elif ph > cond["ph_high"]:
            _apply("ph_high")
        else:
            _apply("ph_optimal")

    # Humidity recommendations
    if humidity is not None:
        if humidity > cond["humidity_very_high"]:
            _apply("humidity_very_high")
        elif humidity > cond["humidity_high"]:
            _apply("humidity_high")
        elif humidity < cond["humidity_low"]:
            _apply("humidity_low")
        else:
            _apply("humidity_optimal")

    # Weather-based recommendations
    weather_factor = 1.0
    if weather == "rainy":
        weather_factor = 0.7
        _apply("weather_rainy")
    elif weather == "sunny":
        if temperature and temperature > cond["temp_very_high"]:
            _apply("weather_hot")
        elif temperature and temperature > cond["temp_high"]:
            _apply("weather_warm")
        elif temperature and temperature < cond["temp_low"]:
            _apply("weather_cold")

    # Temperature ideal range
    if temperature is not None and cond["temp_high"] <= temperature <= cond["temp_very_high"]:
        _apply("temp_ideal")

    # Fertilizer plan from DB (tries detected stage, falls back to 'General')
    base_plan = fertilizer_plans.get(growth_stage)
    is_general = base_plan is None

    if base_plan is not None:
        base_plan = [dict(entry) for entry in base_plan]
        tips.extend(stage_tips.get(growth_stage, []))
    else:
        base_plan = [dict(entry) for entry in fertilizer_plans.get("General", [])]
        _apply("general")

    # Weather forecast adjustments
    day_to_index = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
        "Friday": 4, "Saturday": 5, "Sunday": 6,
    }

    for day_plan in base_plan:
        day_weather_factor = weather_factor

        if weather_forecast and day_plan["day"] in day_to_index:
            day_index = day_to_index[day_plan["day"]]
            if day_index < len(weather_forecast):
                forecast_day = weather_forecast[day_index]
                day_condition = forecast_day.get("condition", weather)
                day_temp = forecast_day.get("temperature")
                day_humidity = forecast_day.get("humidity")
                day_fmt = {**fmt, "day": day_plan["day"]}

                if day_condition == "rainy":
                    day_weather_factor = 0.7
                    day_warning = _fmt(
                        (cond_msgs.get("day_rainy", {}).get("warnings", ["{day} - Rainy weather, fertilizer amount reduced"])[0]),
                        **day_fmt
                    )
                    if day_warning not in warnings:
                        warnings.append(day_warning)
                elif day_condition == "sunny" and day_temp and day_temp > cond["temp_very_high"]:
                    day_weather_factor = 1.0
                    day_warning = _fmt(
                        (cond_msgs.get("day_hot", {}).get("warnings", ["{day} - Hot weather, apply fertilizer in late afternoon"])[0]),
                        **day_fmt
                    )
                    if day_warning not in warnings:
                        warnings.append(day_warning)
                else:
                    day_weather_factor = 1.0

                day_plan["forecast"] = {
                    "condition": day_condition,
                    "temperature": round(day_temp, 1) if day_temp else None,
                    "humidity": round(day_humidity, 1) if day_humidity else None,
                }

        if "grams" in day_plan["amount"]:
            parts = day_plan["amount"].split()
            if parts:
                try:
                    amounts = parts[0].split("-")
                    adjusted = [str(int(float(a) * day_weather_factor)) for a in amounts]
                    if day_weather_factor != 1.0:
                        day_plan["amount_adjusted"] = "-".join(adjusted) + " grams per plant (weather adjusted)"
                    else:
                        day_plan["amount_adjusted"] = day_plan["amount"]
                except Exception:
                    day_plan["amount_adjusted"] = day_plan["amount"]
            else:
                day_plan["amount_adjusted"] = day_plan["amount"]
        else:
            day_plan["amount_adjusted"] = day_plan["amount"]

    if weather_forecast:
        forecast_tip_msgs = cond_msgs.get("forecast_adjusted", {}).get("tips", [])
        if forecast_tip_msgs:
            tips.append(forecast_tip_msgs[0])

        rainy_days = sum(1 for f in weather_forecast if f.get("condition") == "rainy")
        if rainy_days >= 3:
            rainy_fmt = {**fmt, "rainy_days": str(rainy_days)}
            for w in cond_msgs.get("forecast_rainy_week", {}).get("warnings", []):
                warnings.append(_fmt(w, **rainy_fmt))
            for t in cond_msgs.get("forecast_rainy_week", {}).get("tips", []):
                tips.append(_fmt(t, **rainy_fmt))

    return GrowthRecommendation(week_plan=base_plan, warnings=warnings, tips=tips)
