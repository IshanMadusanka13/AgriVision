from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel
import cv2
import numpy as np
from datetime import datetime
import os
from configs.model_loader import growth_model


# Models
class NPKInput(BaseModel):
    nitrogen: float  
    phosphorus: float  
    potassium: float  


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
    
    if img is None:
        return "unknown", 0.0, DetectionCounts(flower=0, fruit=0, leaf=0, ripening=0), ""

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    debug_dir = "app/debug_images"
    os.makedirs(debug_dir, exist_ok=True)

    input_path = os.path.join(debug_dir, f"input_{timestamp}.jpg")
    cv2.imwrite(input_path, img)

    # Run YOLO model inference
    results = model.predict(img, conf=0.5)

    counts = {
        "flower": 0,    
        "fruit": 0,     
        "leaf": 0,      
        "ripening": 0   
    }

    for result in results:
        for box in result.boxes:
            cls_id = int(box.cls[0])
            label = growth_model.names[cls_id].lower()
            if label in counts:
                counts[label] += 1

    annotated_img = results[0].plot()
    output_path = os.path.join(debug_dir, f"output_{timestamp}.jpg")
    cv2.imwrite(output_path, annotated_img)

    avg_conf = float(results[0].boxes.conf.mean()) if len(results[0].boxes) > 0 else 0.0

    is_scotch_bonnet = counts["leaf"] > 0

    if not is_scotch_bonnet:
        return "unknown", 0.0, DetectionCounts(**counts), output_path

    total_detections = counts["leaf"] + counts["flower"] + counts["fruit"]

    if total_detections == 0:
        return "unknown", 0.0, DetectionCounts(**counts), output_path

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

    return growth_stage, confidence, DetectionCounts(**counts), output_path


def analyze_npk_levels(npk: NPKInput, growth_stage: str) -> Dict:
    
    status = {}

    optimal_ranges = {
        "early_vegetative": {
            "N": (150, 280),  
            "P": (20, 35),     
            "K": (100, 180)    
        },
        "vegetative": {
            "N": (200, 350),   
            "P": (18, 32),     
            "K": (120, 200)    
        },
        "flowering": {
            "N": (150, 280),   
            "P": (15, 28),    
            "K": (150, 240)    
        },
        "fruiting": {
            "N": (100, 220),   
            "P": (12, 25),     
            "K": (180, 280)    
        },
        "ripening": {
            "N": (80, 180),    
            "P": (10, 22),     
            "K": (200, 320)    
        },
        "unknown": {
            "N": (150, 280),   
            "P": (15, 28),
            "K": (120, 200)
        }
    }

    ranges = optimal_ranges.get(growth_stage, optimal_ranges["vegetative"])

    n_min, n_max = ranges["N"]
    if npk.nitrogen < n_min:
        status["nitrogen"] = {"level": "low", "current": npk.nitrogen, "optimal": f"{n_min}-{n_max}"}
    elif npk.nitrogen > n_max:
        status["nitrogen"] = {"level": "high", "current": npk.nitrogen, "optimal": f"{n_min}-{n_max}"}
    else:
        status["nitrogen"] = {"level": "optimal", "current": npk.nitrogen, "optimal": f"{n_min}-{n_max}"}

    p_min, p_max = ranges["P"]
    if npk.phosphorus < p_min:
        status["phosphorus"] = {"level": "low", "current": npk.phosphorus, "optimal": f"{p_min}-{p_max}"}
    elif npk.phosphorus > p_max:
        status["phosphorus"] = {"level": "high", "current": npk.phosphorus, "optimal": f"{p_min}-{p_max}"}
    else:
        status["phosphorus"] = {"level": "optimal", "current": npk.phosphorus, "optimal": f"{p_min}-{p_max}"}

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
    
    week_plan = []
    warnings = []
    tips = []


    if ph is not None:
        if ph < 5.5:
            warnings.append(f"⚠️ Soil pH ({ph:.1f}) is too acidic! Apply Dolomite Lime 4 ton/ha to raise pH.")
            tips.append("Apply lime 15 days before transplanting and mix well with soil.")
            tips.append("Dolomite lime provides both Calcium and Magnesium.")
            tips.append("Very low pH severely limits phosphorus and calcium uptake.")
        elif ph < 6.0:
            warnings.append(f"Soil pH ({ph:.1f}) is slightly acidic. Consider lime application for better growth.")
            tips.append("Optimal pH for Scotch bonnet: 6.0-6.5 (research showed good results even at pH 5.9)")
            tips.append("Apply 2-3 ton/ha dolomite lime if pH is below 5.8")
        elif ph > 6.8:
            warnings.append(f"⚠️ Soil pH ({ph:.1f}) is too high! Apply Gypsum (20 kg/ha) or elemental Sulfur.")
            tips.append("High pH reduces availability of Iron, Manganese, Zinc and Boron.")
            tips.append("Incorporate organic matter (cow dung 10 ton/ha) to lower pH gradually.")
        else:
            tips.append(f"✅ Soil pH ({ph:.1f}) is optimal for Scotch bonnet cultivation!")

    if humidity is not None:
        if humidity > 85:
            warnings.append(f"⚠️ Humidity ({humidity:.0f}%) is very high! High risk of fungal diseases (anthracnose, leaf spot).")
            tips.append("Improve air circulation and avoid overhead irrigation.")
            tips.append("Apply fungicide preventively in high humidity conditions.")
            tips.append("Reduce nitrogen application - high humidity + high N increases disease susceptibility.")
        elif humidity > 75:
            tips.append(f"Humidity ({humidity:.0f}%) is moderate-high. Monitor for fungal diseases.")
            tips.append("Ensure good plant spacing for air circulation (60x50 cm recommended).")
        elif humidity < 50:
            warnings.append(f"Humidity ({humidity:.0f}%) is low. Increase irrigation frequency.")
            tips.append("Low humidity may cause flower drop and reduce fruit set.")
            tips.append("Consider light mulching to maintain soil moisture.")
        else:
            tips.append(f"Humidity ({humidity:.0f}%) is in good range for Scotch bonnet cultivation.")

    weather_factor = 1.0
    if weather == "rainy":
        weather_factor = 0.7  
        warnings.append("⚠️ Rainy weather - delay fertilizer application. Rain washes away nutrients.")
        tips.append("Wait 2-3 days after heavy rain before applying fertilizer.")
        tips.append("Ensure proper drainage to prevent waterlogging and root rot.")

        if humidity is None or humidity > 70:
            tips.append("Apply fungicide (Mancozeb or Copper-based) during rainy periods.")
    elif weather == "sunny":
        if temperature and temperature > 32:
            warnings.append("🌡️ High temperature! Apply fertilizer in late afternoon (4-5 PM) to avoid fertilizer burn.")
            tips.append(f"Temperature ({temperature:.0f}°C) is high - increase watering frequency to twice daily.")
            tips.append("Provide light shade during extreme heat (>35°C) to prevent flower drop.")
        elif temperature and temperature > 28:
            tips.append(f"Temperature ({temperature:.0f}°C) is optimal for Scotch bonnet growth.")
        elif temperature and temperature < 15:
            warnings.append(f"⚠️ Temperature ({temperature:.0f}°C) is low! Growth will slow down significantly.")
            tips.append("Scotch bonnet grows best in 20-30°C range.")
            tips.append("Reduce fertilizer application in low temperatures - nutrient uptake is limited.")

    if temperature is not None:
        if 20 <= temperature <= 30:
            tips.append(f"✅ Temperature ({temperature:.0f}°C) is ideal for Scotch bonnet cultivation!")

    if growth_stage == "Early Vegetative Stage":
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "TSP (Triple Super Phosphate 0-46-0)",
                "amount": "8-10 grams per plant (basal)",
                "method": "Mix with soil before transplanting or apply immediately after",
                "watering": "Water thoroughly after application"
            },
            {
                "day": "Thursday",
                "fertilizer_type": "Urea (46-0-0)",
                "amount": "6-8 grams per plant",
                "method": "Broadcast around the base (first installment of 4)",
                "watering": "Water thoroughly after fertilizer application"
            }
        ]
        tips.extend([
            "Apply full phosphorus dose as basal (TSP or DAP).",
            "Nitrogen (Urea) should be split into 4 equal doses.",
            "Apply organic compost or cow dung (200-250g per plant) as basal.",
            "Continue this schedule until plants reach 15-20 cm in height."
        ])

    elif growth_stage == "Vegetative Stage":
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "Urea (46-0-0)",
                "amount": "8-10 grams per plant",
                "method": "Broadcast around the base (second installment)",
                "watering": "Water thoroughly after fertilizer application"
            },
            {
                "day": "Thursday",
                "fertilizer_type": "MOP (Muriate of Potash 0-0-60)",
                "amount": "4-5 grams per plant",
                "method": "Broadcast and mix with soil (first installment of 3)",
                "watering": "Normal watering"
            }
        ]

        if npk_status["nitrogen"]["level"] == "low":
            base_plan[0]["amount"] = "12-14 grams per plant"
            warnings.append("Nitrogen level is low! Urea amount has been increased.")

        tips.extend([
            "Potassium application should be split into 3 installments.",
            "Monitor leaf color - dark green indicates good nitrogen levels.",
            "Apply organic mulch (100-150g) weekly to improve soil structure.",
            "Maintain soil moisture for better nutrient uptake."
        ])

    elif growth_stage == "Flowering Stage":
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "Urea (46-0-0)",
                "amount": "6-8 grams per plant",
                "method": "Broadcast around the base (third installment)",
                "watering": "Water carefully - avoid wetting flowers"
            },
            {
                "day": "Thursday",
                "fertilizer_type": "MOP (Muriate of Potash 0-0-60)",
                "amount": "4-5 grams per plant",
                "method": "Mix with soil (second installment)",
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

        if npk_status["phosphorus"]["level"] == "low":
            base_plan.insert(1, {
                "day": "Tuesday",
                "fertilizer_type": "TSP (Triple Super Phosphate 0-46-0)",
                "amount": "5-7 grams per plant (top dressing)",
                "method": "Broadcast around the base of the plant",
                "watering": "Water thoroughly"
            })
            warnings.append("Phosphorus level is low! Additional phosphate added for flowering support.")

        if npk_status["potassium"]["level"] == "low":
            base_plan[1]["amount"] = "6-8 grams per plant"
            warnings.append("Potassium level is low! Potassium increased to improve flower quality.")

        tips.extend([
            "Reduce nitrogen during flowering - excess N causes flower drop.",
            "Phosphorus (P) and Potassium (K) are critical for flower development.",
            "Calcium and Boron prevent flower drop and blossom end rot.",
            "Apply Gypsum (20g per plant) if sulfur and calcium are needed."
        ])

    elif growth_stage == "Fruiting Stage":
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "Urea (46-0-0)",
                "amount": "5-7 grams per plant",
                "method": "Broadcast around the base (fourth and final installment)",
                "watering": "Water thoroughly"
            },
            {
                "day": "Wednesday",
                "fertilizer_type": "MOP (Muriate of Potash 0-0-60)",
                "amount": "4-5 grams per plant",
                "method": "Mix with soil (third and final installment)",
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

        if npk_status["potassium"]["level"] == "low":
            base_plan.insert(2, {
                "day": "Thursday",
                "fertilizer_type": "SOP (Sulphate of Potash 0-0-50)",
                "amount": "5-7 grams per plant",
                "method": "Broadcast around the base of the plant",
                "watering": "Water thoroughly"
            })
            warnings.append("Potassium level is low! Extra potassium added to improve fruit quality and size.")

        if npk_status["nitrogen"]["level"] == "high":
            warnings.append("Nitrogen level is high! Excessive N during fruiting reduces fruit quality and delays ripening.")

        tips.extend([
            "This is the final nitrogen and potassium installment.",
            "Potassium (K) is critical for fruit size and quality.",
            "Calcium spray increases fruit firmness and shelf life.",
            "Apply Epsom salt (MgSO4) foliar spray if leaves show yellowing.",
            "Reduce watering slightly to enhance fruit flavor."
        ])

    elif growth_stage == "Ripening/Harvesting Stage":
        base_plan = [
            {
                "day": "Monday",
                "fertilizer_type": "SOP (Sulphate of Potash 0-0-50)",
                "amount": "3-5 grams per plant (optional, if needed)",
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

        if npk_status["nitrogen"]["level"] == "high":
            warnings.append("⚠️ Nitrogen level is high! Stop nitrogen application - excess N delays fruit coloring and ripening.")

        if npk_status["potassium"]["level"] == "low":
            base_plan[0]["amount"] = "5-7 grams per plant"
            warnings.append("Potassium level is low! Light potassium application added for better fruit color.")

        tips.extend([
            "STOP all nitrogen fertilizer during ripening stage.",
            "All NPK fertilizer should have been completed by now.",
            "Light potassium application improves fruit color and flavor.",
            "Calcium and Boron sprays increase shelf life.",
            "Reduce watering frequency to enhance flavor and pungency.",
            "Stop all fertilizers 1-2 weeks before final harvest.",
            "Focus on pest and disease management during this stage."
        ])

    else:
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

    day_to_index = {
        "Monday": 0,
        "Tuesday": 1,
        "Wednesday": 2,
        "Thursday": 3,
        "Friday": 4,
        "Saturday": 5
    }

    for day_plan in base_plan:
        day_weather_factor = weather_factor  
        day_specific_warning = None

        if weather_forecast and day_plan["day"] in day_to_index:
            day_index = day_to_index[day_plan["day"]]
            if day_index < len(weather_forecast):
                forecast_day = weather_forecast[day_index]
                day_condition = forecast_day.get("condition", weather)
                day_temp = forecast_day.get("temperature")
                day_humidity = forecast_day.get("humidity")

                if day_condition == "rainy":
                    day_weather_factor = 0.7
                    day_specific_warning = f"🌧️ {day_plan['day']} - Rainy weather, fertilizer amount reduced"
                elif day_condition == "sunny" and day_temp and day_temp > 32:
                    day_weather_factor = 1.0
                    day_specific_warning = f"☀️ {day_plan['day']} - Hot weather, apply fertilizer in late afternoon"
                else:
                    day_weather_factor = 1.0

                day_plan["forecast"] = {
                    "condition": day_condition,
                    "temperature": round(day_temp, 1) if day_temp else None,
                    "humidity": round(day_humidity, 1) if day_humidity else None
                }

                if day_specific_warning and day_specific_warning not in warnings:
                    warnings.append(day_specific_warning)

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

    if weather_forecast:
        tips.append("📅 Fertilizer amounts have been adjusted for each day based on the weekly weather forecast.")

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
