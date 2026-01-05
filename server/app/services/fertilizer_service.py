"""
Fertilizer Recommendation Service
Generates fertilizer recommendations based on NPK analysis and plant growth stage
"""

from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel
import cv2
import numpy as np
from datetime import datetime
import os


# Models
class NPKInput(BaseModel):
    nitrogen: float  # mg/kg
    phosphorus: float  # mg/kg
    potassium: float  # mg/kg


class FertilizerRecommendation(BaseModel):
    week_plan: List[Dict]
    npk_status: Dict
    warnings: List[str]
    tips: List[str]


class DetectionCounts(BaseModel):
    flower: int
    fruit: int
    leaf: int
    ripening: int


def determine_growth_stage(img: np.ndarray, model) -> Tuple[str, float, DetectionCounts, str]:
    """
    Performs YOLO detection on image and determines the plant growth stage

    Args:
        img: OpenCV image (numpy array)
        model: YOLO model instance

    Returns:
        tuple: (growth_stage, confidence, counts, debug_image_path)
            - growth_stage: Growth stage identifier (early_vegetative, vegetative, flowering, fruiting, ripening, unknown)
            - confidence: Confidence score (0-100)
            - counts: DetectionCounts object with all detection counts
            - debug_image_path: Path to annotated image (or empty string if failed)
    """
    if img is None:
        return "unknown", 0.0, DetectionCounts(flower=0, fruit=0, leaf=0, ripening=0), ""

    # Save input image for debugging
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    debug_dir = "app/debug_images"
    os.makedirs(debug_dir, exist_ok=True)

    # Save input image
    input_path = os.path.join(debug_dir, f"input_{timestamp}.jpg")
    cv2.imwrite(input_path, img)

    # Run YOLO model inference
    results = model.predict(img, conf=0.5)

    # Initialize detection counters
    counts = {
        "flower": 0,    # Class ID: 0
        "fruit": 0,     # Class ID: 1
        "leaf": 0,      # Class ID: 2
        "ripening": 0   # Class ID: 3
    }

    # Count detected objects by class
    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            label = model.names[cls_id].lower()
            if label in counts:
                counts[label] += 1

    # Save annotated image with bounding boxes
    annotated_img = results[0].plot()
    output_path = os.path.join(debug_dir, f"output_{timestamp}.jpg")
    cv2.imwrite(output_path, annotated_img)

    # Calculate average confidence score
    avg_conf = float(results[0].boxes.conf.mean()) if len(results[0].boxes) > 0 else 0.0

    # Validate Scotch Bonnet plant
    # Only consider as Scotch Bonnet if leaves are detected
    is_scotch_bonnet = counts["leaf"] > 0

    if not is_scotch_bonnet:
        return "unknown", 0.0, DetectionCounts(**counts), output_path

    # Calculate total detections
    total_detections = counts["leaf"] + counts["flower"] + counts["fruit"]

    if total_detections == 0:
        return "unknown", 0.0, DetectionCounts(**counts), output_path

    # Calculate confidence percentage
    confidence = min(avg_conf * 100, 100.0)

    # Determine growth stage (by priority order)
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

    return growth_stage, confidence, DetectionCounts(**counts), output_path


def analyze_npk_levels(npk: NPKInput, growth_stage: str) -> Dict:
    """
    Analyzes NPK levels and returns status for each nutrient

    Args:
        npk: NPK values (nitrogen, phosphorus, potassium in mg/kg)
        growth_stage: Current growth stage of the plant

    Returns:
        Dict with NPK status for each nutrient (level, current value, optimal range)
    """
    status = {}

    # Optimal NPK ranges for each growth stage (in mg/kg)
    optimal_ranges = {
        "early_vegetative": {"N": (80, 120), "P": (60, 100), "K": (100, 150)},
        "vegetative": {"N": (100, 150), "P": (80, 120), "K": (120, 180)},
        "flowering": {"N": (60, 100), "P": (120, 180), "K": (180, 250)},
        "fruiting": {"N": (50, 80), "P": (100, 150), "K": (200, 300)},
        "ripening": {"N": (30, 60), "P": (80, 120), "K": (220, 320)},
        "unknown": {"N": (80, 120), "P": (80, 120), "K": (120, 180)}  # Default ranges
    }

    ranges = optimal_ranges.get(growth_stage, optimal_ranges["vegetative"])

    # Analyze Nitrogen status
    n_min, n_max = ranges["N"]
    if npk.nitrogen < n_min:
        status["nitrogen"] = {"level": "low", "current": npk.nitrogen, "optimal": f"{n_min}-{n_max}"}
    elif npk.nitrogen > n_max:
        status["nitrogen"] = {"level": "high", "current": npk.nitrogen, "optimal": f"{n_min}-{n_max}"}
    else:
        status["nitrogen"] = {"level": "optimal", "current": npk.nitrogen, "optimal": f"{n_min}-{n_max}"}

    # Analyze Phosphorus status
    p_min, p_max = ranges["P"]
    if npk.phosphorus < p_min:
        status["phosphorus"] = {"level": "low", "current": npk.phosphorus, "optimal": f"{p_min}-{p_max}"}
    elif npk.phosphorus > p_max:
        status["phosphorus"] = {"level": "high", "current": npk.phosphorus, "optimal": f"{p_min}-{p_max}"}
    else:
        status["phosphorus"] = {"level": "optimal", "current": npk.phosphorus, "optimal": f"{p_min}-{p_max}"}

    # Analyze Potassium status
    k_min, k_max = ranges["K"]
    if npk.potassium < k_min:
        status["potassium"] = {"level": "low", "current": npk.potassium, "optimal": f"{k_min}-{k_max}"}
    elif npk.potassium > k_max:
        status["potassium"] = {"level": "high", "current": npk.potassium, "optimal": f"{k_min}-{k_max}"}
    else:
        status["potassium"] = {"level": "optimal", "current": npk.potassium, "optimal": f"{k_min}-{k_max}"}

    return status


def generate_fertilizer_plan(
    growth_stage: str,
    npk_status: Dict,
    weather: str,
    temperature: Optional[float] = None,
    ph: Optional[float] = None,
    humidity: Optional[float] = None,
    weather_forecast: Optional[List[Dict]] = None
) -> FertilizerRecommendation:
    """
    Generates a detailed fertilizer plan based on growth stage, NPK levels, weather, pH, and humidity.
    If weather forecast is available, applies specific weather adjustments for each day.

    Args:
        growth_stage: Plant growth stage
        npk_status: NPK analysis results
        weather: Current weather condition (sunny/rainy/cloudy)
        temperature: Temperature in Celsius (optional)
        ph: Soil pH value (optional)
        humidity: Humidity percentage (optional)
        weather_forecast: 7-day weather forecast (optional)
            Each day: {date, condition, temperature, humidity, temp_min, temp_max}

    Returns:
        FertilizerRecommendation with week plan, warnings, and tips
    """
    week_plan = []
    warnings = []
    tips = []

    # pH adjustments and warnings
    if ph is not None:
        if ph < 5.5:
            warnings.append(f"⚠️ Soil pH ({ph:.1f}) is too low! Apply Lime (CaCO3) to increase pH to 6.0-6.5.")
            tips.append("Dolomite lime is recommended - it contains both Calcium and Magnesium.")
            tips.append("Low pH reduces nutrient absorption by plants.")
        elif ph < 6.0:
            warnings.append(f"pH ({ph:.1f}) is slightly low. Lime application may be necessary.")
            tips.append("Ideal pH for Scotch bonnet plants: 6.0-6.8")
        elif ph > 7.0:
            warnings.append(f"⚠️ Soil pH ({ph:.1f}) is too high! Apply Sulfur or organic matter to reduce pH.")
            tips.append("High pH can cause Iron and Manganese deficiencies.")
        else:
            tips.append(f"✅ Soil pH ({ph:.1f}) is in the optimal range!")

    # Humidity adjustments
    if humidity is not None:
        if humidity > 80:
            warnings.append(f"Humidity ({humidity:.0f}%) is high. Risk of fungal diseases. Increase ventilation.")
            tips.append("Reduce fertilizer application in high humidity - disease risk is elevated.")
        elif humidity < 40:
            warnings.append(f"Humidity ({humidity:.0f}%) is low. Increase watering - plants may experience stress.")
            tips.append("In low humidity, reduce fertilizer concentration and increase application frequency.")

    # Weather adjustments
    weather_factor = 1.0
    if weather == "rainy":
        weather_factor = 0.7  # Reduce dosage as rain can wash away fertilizer
        warnings.append("Reduce fertilizer application due to rain. Applying fertilizer to wet soil can cause root damage.")
        tips.append("Wait 2-3 days after rain before applying fertilizer.")
        # Adjust for high humidity in rainy weather
        if humidity is None or humidity > 70:
            tips.append("Fungicide spray is recommended during rainy periods.")
    elif weather == "sunny":
        if temperature and temperature > 32:
            warnings.append("Apply fertilizer in the late afternoon (4-5 PM) due to high temperature. Midday application can cause fertilizer burn.")
            # High temperature - increase watering frequency
            tips.append(f"Increase watering to twice daily due to high temperature ({temperature:.0f}°C).")

    # Growth stage specific recommendations
    if growth_stage == "early_vegetative":
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "Urea (46-0-0)",
                "amount": "5-8 grams per plant",
                "method": "Broadcast around the base of the plant",
                "watering": "Water thoroughly after fertilizer application"
            },
            {
                "day": "Thursday",
                "fertilizer_type": "NPK 15-15-15 (Balanced)",
                "amount": "8-10 grams per plant",
                "method": "Broadcast around the base of the plant",
                "watering": "Normal watering"
            }
        ]
        tips.extend([
            "Higher Nitrogen is essential for leaf development.",
            "Apply organic compost twice weekly.",
            "Continue this schedule until plants reach 15-20 cm in height."
        ])

    elif growth_stage == "vegetative":
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "Urea (46-0-0)",
                "amount": "10-12 grams per plant",
                "method": "Broadcast around the base and mix with soil",
                "watering": "Water thoroughly after fertilizer application"
            },
            {
                "day": "Thursday",
                "fertilizer_type": "NPK 19-19-19",
                "amount": "12-15 grams per plant",
                "method": "Apply as foliar spray or soil application",
                "watering": "Normal watering"
            }
        ]

        # NPK adjustments
        if npk_status["nitrogen"]["level"] == "low":
            base_plan[0]["amount"] = "15-18 grams per plant"
            warnings.append("Nitrogen level is low! Urea amount has been increased.")

        tips.extend([
            "Use balanced fertilizer for vigorous growth.",
            "If leaf color is not dark green, increase Nitrogen.",
            "Apply organic mulch 1-2 times per week."
        ])

    elif growth_stage == "flowering":
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "NPK 10-30-20 (Bloom booster)",
                "amount": "12-15 grams per plant",
                "method": "Broadcast around the base of the plant",
                "watering": "Water carefully - avoid wetting flowers"
            },
            {
                "day": "Thursday",
                "fertilizer_type": "Potassium Sulphate (0-0-50)",
                "amount": "8-10 grams per plant",
                "method": "Mix with soil",
                "watering": "Normal watering"
            },
            {
                "day": "Saturday",
                "fertilizer_type": "Calcium + Boron foliar spray",
                "amount": "5ml per liter water",
                "method": "Foliar spray - apply in the late afternoon",
                "watering": "Do not water after spraying"
            }
        ]

        # NPK adjustments
        if npk_status["phosphorus"]["level"] == "low":
            base_plan.insert(1, {
                "day": "Tuesday",
                "fertilizer_type": "Triple Super Phosphate (0-46-0)",
                "amount": "10-12 grams per plant",
                "method": "Broadcast around the base of the plant",
                "watering": "Water thoroughly"
            })
            warnings.append("Phosphorus level is low! Phosphate fertilizer has been added for flowering support.")

        if npk_status["potassium"]["level"] == "low":
            base_plan[1]["amount"] = "12-15 grams per plant"
            warnings.append("Potassium level is low! Potassium has been increased to improve flower quality.")

        tips.extend([
            "Phosphorus (P) and Potassium (K) are essential for flowering.",
            "Excessive Nitrogen can cause flower drop.",
            "Calcium spray helps prevent blossom end rot.",
            "If flower drop is excessive, try a Boron spray."
        ])

    elif growth_stage == "fruiting":
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "NPK 5-10-26 (Fruit developer)",
                "amount": "15-18 grams per plant",
                "method": "Broadcast around the base of the plant",
                "watering": "Water thoroughly"
            },
            {
                "day": "Wednesday",
                "fertilizer_type": "Potassium Sulphate (0-0-50)",
                "amount": "12-15 grams per plant",
                "method": "Mix with soil",
                "watering": "Normal watering"
            },
            {
                "day": "Friday",
                "fertilizer_type": "Calcium Nitrate + Magnesium foliar spray",
                "amount": "7ml per liter water",
                "method": "Foliar spray - apply in the late afternoon",
                "watering": "Do not water after spraying"
            }
        ]

        # NPK adjustments
        if npk_status["potassium"]["level"] == "low":
            base_plan.insert(2, {
                "day": "Thursday",
                "fertilizer_type": "Muriate of Potash (0-0-60)",
                "amount": "15-18 grams per plant",
                "method": "Broadcast around the base of the plant",
                "watering": "Water thoroughly"
            })
            warnings.append("Potassium level is very low! Extra potassium has been added to improve fruit quality.")

        if npk_status["nitrogen"]["level"] == "high":
            warnings.append("Nitrogen level is high! Excessive Nitrogen during fruiting can reduce fruit quality.")

        tips.extend([
            "Potassium (K) is essential for fruit development.",
            "Calcium spray helps increase fruit firmness.",
            "Reduce Nitrogen during fruit ripening stage.",
            "If leaves turn yellow, Magnesium deficiency may be present - use Epsom salt.",
            "Apply organic compost tea spray 2-3 times per week."
        ])

    elif growth_stage == "ripening":
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "Potassium Sulphate (0-0-50)",
                "amount": "15-20 grams per plant",
                "method": "Broadcast around the base of the plant",
                "watering": "Water thoroughly"
            },
            {
                "day": "Thursday",
                "fertilizer_type": "Calcium + Boron foliar spray",
                "amount": "5-7ml per liter water",
                "method": "Foliar spray - apply in the late afternoon",
                "watering": "Do not water after spraying"
            }
        ]

        # NPK adjustments
        if npk_status["nitrogen"]["level"] == "high":
            warnings.append("⚠️ Nitrogen level is high! Reduce Nitrogen during ripening - it slows down fruit coloring.")

        if npk_status["potassium"]["level"] == "low":
            base_plan.insert(1, {
                "day": "Wednesday",
                "fertilizer_type": "Muriate of Potash (0-0-60)",
                "amount": "18-22 grams per plant",
                "method": "Broadcast around the base of the plant",
                "watering": "Water thoroughly"
            })
            warnings.append("Potassium level is very low! Extra potassium has been added for ripening support.")

        tips.extend([
            "During ripening, use less Nitrogen and more Potassium.",
            "Potassium (K) is essential for enhancing fruit color.",
            "Calcium spray increases fruit storage life.",
            "Slightly reduce watering during this stage - it enhances fruit flavor.",
            "Stop all fertilizer applications 1-2 weeks before harvest.",
            "If fruits are small, Boron deficiency may be present - apply Borax spray."
        ])

    else:
        # Unknown or undetected growth stage - provide general recommendations
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "NPK 15-15-15 (Balanced)",
                "amount": "10-12 grams per plant",
                "method": "Broadcast around the base of the plant",
                "watering": "Water thoroughly after fertilizer application"
            },
            {
                "day": "Thursday",
                "fertilizer_type": "Organic Compost",
                "amount": "100-150 grams per plant",
                "method": "Apply around the base and mix with soil",
                "watering": "Normal watering"
            }
        ]

        warnings.append("⚠️ Plant not detected! Providing a general fertilizer plan.")
        warnings.append("Upload a clear plant photo for better recommendations.")

        tips.extend([
            "Take a photo with clear leaves, flowers, or fruits for growth stage detection.",
            "Balanced NPK fertilizer is good for general growth.",
            "Regular organic compost application improves soil quality.",
            "Manually check plant growth stage and choose from the above recommendations."
        ])

    # Day name mapping for forecast (English day names to index)
    day_to_index = {
        "Monday": 0,
        "Tuesday": 1,
        "Wednesday": 2,
        "Thursday": 3,
        "Friday": 4,
        "Saturday": 5
    }

    # Apply weather factor - use forecast if available
    for day_plan in base_plan:
        day_weather_factor = weather_factor  # Default to current weather factor
        day_specific_warning = None

        # If forecast available, get weather for specific day
        if weather_forecast and day_plan["day"] in day_to_index:
            day_index = day_to_index[day_plan["day"]]
            if day_index < len(weather_forecast):
                forecast_day = weather_forecast[day_index]
                day_condition = forecast_day.get("condition", weather)
                day_temp = forecast_day.get("temperature")
                day_humidity = forecast_day.get("humidity")

                # Calculate day-specific weather factor
                if day_condition == "rainy":
                    day_weather_factor = 0.7
                    day_specific_warning = f"🌧️ {day_plan['day']} - Rainy weather, fertilizer amount reduced"
                elif day_condition == "sunny" and day_temp and day_temp > 32:
                    day_weather_factor = 1.0
                    day_specific_warning = f"☀️ {day_plan['day']} - Hot weather, apply fertilizer in late afternoon"
                else:
                    day_weather_factor = 1.0

                # Add day-specific info
                day_plan["forecast"] = {
                    "condition": day_condition,
                    "temperature": round(day_temp, 1) if day_temp else None,
                    "humidity": round(day_humidity, 1) if day_humidity else None
                }

                if day_specific_warning and day_specific_warning not in warnings:
                    warnings.append(day_specific_warning)

        # Apply weather adjustment to amounts
        if "grams" in day_plan["amount"]:
            parts = day_plan["amount"].split()
            if len(parts) >= 1:
                try:
                    amounts = parts[0].split("-")
                    adjusted_amounts = [str(int(float(a) * day_weather_factor)) for a in amounts]

                    if day_weather_factor != 1.0:
                        day_plan["amount_adjusted"] = "-".join(adjusted_amounts) + " grams per plant (weather adjusted)"
                    else:
                        day_plan["amount_adjusted"] = day_plan["amount"]
                except:
                    day_plan["amount_adjusted"] = day_plan["amount"]
            else:
                day_plan["amount_adjusted"] = day_plan["amount"]
        else:
            day_plan["amount_adjusted"] = day_plan["amount"]

    # Add forecast-based tips if forecast was used
    if weather_forecast:
        tips.append("📅 Fertilizer amounts have been adjusted for each day based on the weekly weather forecast.")

        # Count rainy days
        rainy_days = sum(1 for f in weather_forecast if f.get("condition") == "rainy")
        if rainy_days >= 3:
            warnings.append(f"⚠️ {rainy_days} rainy days expected this week! Ensure proper drainage.")
            tips.append("Apply organic mulch during rainy weeks - it reduces soil erosion.")

    return FertilizerRecommendation(
        week_plan=base_plan,
        npk_status=npk_status,
        warnings=warnings,
        tips=tips
    )
