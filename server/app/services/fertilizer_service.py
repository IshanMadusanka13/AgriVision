"""
Fertilizer Recommendation Service
NPK analysis සහ growth stage අනුව fertilizer recommendations generate කරන service එක
"""

from typing import Dict, List, Optional
from pydantic import BaseModel


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


def determine_growth_stage(leaves: int, flowers: int, fruits: int) -> tuple:
    """
    Detection counts වලින් growth stage determine කරන function එක

    Returns:
        tuple: (growth_stage, confidence)
    """
    total_detections = leaves + flowers + fruits

    if total_detections == 0:
        return "unknown", 0.0

    # Confidence calculation
    confidence = min(total_detections / 20, 1.0) * 100

    # Growth stage logic
    if fruits > 0:
        return "fruiting", confidence
    elif flowers > 0:
        return "flowering", confidence
    elif leaves > 5:
        return "vegetative", confidence
    else:
        return "early_vegetative", confidence


def analyze_npk_levels(npk: NPKInput, growth_stage: str) -> Dict:
    """
    NPK levels analyze කරලා status එක return කරන function එක

    Args:
        npk: NPK values (nitrogen, phosphorus, potassium)
        growth_stage: Current growth stage

    Returns:
        Dict with NPK status for each nutrient
    """
    status = {}

    # Growth stage අනුව optimal NPK ranges
    optimal_ranges = {
        "early_vegetative": {"N": (80, 120), "P": (60, 100), "K": (100, 150)},
        "vegetative": {"N": (100, 150), "P": (80, 120), "K": (120, 180)},
        "flowering": {"N": (60, 100), "P": (120, 180), "K": (180, 250)},
        "fruiting": {"N": (50, 80), "P": (100, 150), "K": (200, 300)},
        "unknown": {"N": (80, 120), "P": (80, 120), "K": (120, 180)}  # Default ranges
    }

    ranges = optimal_ranges.get(growth_stage, optimal_ranges["vegetative"])

    # Nitrogen status
    n_min, n_max = ranges["N"]
    if npk.nitrogen < n_min:
        status["nitrogen"] = {"level": "low", "current": npk.nitrogen, "optimal": f"{n_min}-{n_max}"}
    elif npk.nitrogen > n_max:
        status["nitrogen"] = {"level": "high", "current": npk.nitrogen, "optimal": f"{n_min}-{n_max}"}
    else:
        status["nitrogen"] = {"level": "optimal", "current": npk.nitrogen, "optimal": f"{n_min}-{n_max}"}

    # Phosphorus status
    p_min, p_max = ranges["P"]
    if npk.phosphorus < p_min:
        status["phosphorus"] = {"level": "low", "current": npk.phosphorus, "optimal": f"{p_min}-{p_max}"}
    elif npk.phosphorus > p_max:
        status["phosphorus"] = {"level": "high", "current": npk.phosphorus, "optimal": f"{p_min}-{p_max}"}
    else:
        status["phosphorus"] = {"level": "optimal", "current": npk.phosphorus, "optimal": f"{p_min}-{p_max}"}

    # Potassium status
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
    Growth stage, NPK levels, weather, pH, humidity අනුව detailed fertilizer plan එක generate කරනවා
    Weather forecast එක තියෙනවනම් සෑම දවසකටම වෙනම weather adjustments කරනවා

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
            warnings.append(f"⚠️ පස්වල pH ({ph:.1f}) ඉතා අඩුයි! Lime (CaCO3) යොදලා pH එක 6.0-6.5 දක්වා වැඩි කරන්න.")
            tips.append("Dolomite lime එක හොඳයි - Calcium සහ Magnesium දෙකම තියෙනවා.")
            tips.append("pH අඩුවෙලා තියෙද්දී nutrient absorption අඩු වෙනවා.")
        elif ph < 6.0:
            warnings.append(f"pH ({ph:.1f}) තරමක් අඩුයි. Lime යොදන්න අවශ්‍ය විය හැකියි.")
            tips.append("Scotch bonnet plants සඳහා ideal pH: 6.0-6.8")
        elif ph > 7.0:
            warnings.append(f"⚠️ පස්වල pH ({ph:.1f}) වැඩියි! Sulfur හෝ organic matter යොදලා pH එක අඩු කරන්න.")
            tips.append("pH වැඩියෙන් තියෙද්දී Iron, Manganese deficiency එන්න පුළුවන්.")
        else:
            tips.append(f"✅ පස්වල pH ({ph:.1f}) optimal range එකේ තියෙනවා!")

    # Humidity adjustments
    if humidity is not None:
        if humidity > 80:
            warnings.append(f"Humidity ({humidity:.0f}%) වැඩියි. Fungal disease එන්න පුළුවන්. Ventilation එක වැඩි කරන්න.")
            tips.append("වැඩි humidity එකේ පොහොර යෙදීම අඩු කරන්න - disease risk වැඩියි.")
        elif humidity < 40:
            warnings.append(f"Humidity ({humidity:.0f}%) අඩුයි. වතුර දීම වැඩි කරන්න - plants stress වෙන්න පුළුවන්.")
            tips.append("අඩු humidity එකේ පොහොර concentration එක අඩු කරලා frequency එක වැඩි කරන්න.")

    # Weather adjustments
    weather_factor = 1.0
    if weather == "rainy":
        weather_factor = 0.7  # වැස්සෙන් fertilizer wash වෙන නිසා reduce කරනවා
        warnings.append("වැස්ස නිසා පොහොර යෙදීම අඩු කරන්න. පස තෙත් වෙලා ඉන්නකොට පොහොර යෙදුවොත් root damage වෙන්න පුළුවන්.")
        tips.append("වැස්සට පස්සේ දවස් 2-3ක් බලලා පොහොර යොදන්න.")
        # Adjust for high humidity in rainy weather
        if humidity is None or humidity > 70:
            tips.append("වැස්ස සමයේ fungicide spray එකක් කරන්න recommended.")
    elif weather == "sunny":
        if temperature and temperature > 32:
            warnings.append("උෂ්ණත්වය වැඩි නිසා හවස පැය 4-5 විතර පොහොර යොදන්න. දවල් කාලෙ යොදුවොත් පොහොර burn වෙන්න පුළුවන්.")
            # High temperature - increase watering frequency
            tips.append(f"උෂ්ණත්වය {temperature:.0f}°C නිසා වතුර දීම වැඩි කරන්න - දවසකට 2 පාරක්.")

    # Growth stage specific recommendations
    if growth_stage == "early_vegetative":
        base_plan = [
            {
                "day": "සඳුදා",
                "fertilizer_type": "Urea (46-0-0)",
                "amount": "5-8 grams per plant",
                "method": "මුල අවට විසිරවීම",
                "watering": "පොහොර යෙදීමෙන් පස්සේ හොඳින් වතුර දෙන්න"
            },
            {
                "day": "බ්‍රහස්පතින්දා",
                "fertilizer_type": "NPK 15-15-15 (Balanced)",
                "amount": "8-10 grams per plant",
                "method": "මුල අවට විසිරවීම",
                "watering": "සාමාන්‍ය වතුර දීම"
            }
        ]
        tips.extend([
            "පළල් වර්ධනයට Nitrogen වැඩියි.",
            "සතියකට දෙපාරක් organic compost දාන්න පුළුවන්.",
            "රුක සෙන්ටිමීටර 15-20 උස වෙනකල් මේ schedule එක ඉදිරියට යන්න."
        ])

    elif growth_stage == "vegetative":
        base_plan = [
            {
                "day": "සඳුදා",
                "fertilizer_type": "Urea (46-0-0)",
                "amount": "10-12 grams per plant",
                "method": "මුල අවට විසිරවීම, පස සමග මිශ්‍ර කරන්න",
                "watering": "පොහොර යෙදීමෙන් පස්සේ හොඳින් වතුර දෙන්න"
            },
            {
                "day": "බ්‍රහස්පතින්දා",
                "fertilizer_type": "NPK 19-19-19",
                "amount": "12-15 grams per plant",
                "method": "foliar spray එකක් ලෙස හෝ soil application",
                "watering": "සාමාන්‍ය වතුර දීම"
            }
        ]

        # NPK adjustments
        if npk_status["nitrogen"]["level"] == "low":
            base_plan[0]["amount"] = "15-18 grams per plant"
            warnings.append("Nitrogen මට්ටම අඩුයි! Urea amount එක වැඩි කරලා තියෙනවා.")

        tips.extend([
            "ශක්තිමත් වර්ධනයට balanced fertilizer use කරන්න.",
            "පළල් පැහැය තද කොළ පාටින් නැත්නම් Nitrogen වැඩි කරන්න.",
            "සතියකට පාර 1-2 organic mulch දාන්න පුළුවන්."
        ])

    elif growth_stage == "flowering":
        base_plan = [
            {
                "day": "සඳුදා",
                "fertilizer_type": "NPK 10-30-20 (Bloom booster)",
                "amount": "12-15 grams per plant",
                "method": "මුල අවට විසිරවීම",
                "watering": "සැලකිලිමත්ව වතුර දෙන්න - මල් අතට වතුර යන්න එපා"
            },
            {
                "day": "බ්‍රහස්පතින්දා",
                "fertilizer_type": "Potassium Sulphate (0-0-50)",
                "amount": "8-10 grams per plant",
                "method": "පස සමග මිශ්‍ර කරන්න",
                "watering": "සාමාන්‍ය වතුර දීම"
            },
            {
                "day": "සෙනසුරාදා",
                "fertilizer_type": "Calcium + Boron foliar spray",
                "amount": "5ml per liter water",
                "method": "foliar spray - හවස වරුවේ spray කරන්න",
                "watering": "spray කරලා වතුර දෙන්න එපා"
            }
        ]

        # NPK adjustments
        if npk_status["phosphorus"]["level"] == "low":
            base_plan.insert(1, {
                "day": "අඟහරුවාදා",
                "fertilizer_type": "Triple Super Phosphate (0-46-0)",
                "amount": "10-12 grams per plant",
                "method": "මුල අවට විසිරවීම",
                "watering": "හොඳින් වතුර දෙන්න"
            })
            warnings.append("Phosphorus මට්ටම අඩුයි! මල් පිපීම සඳහා phosphate fertilizer එකක් add කරලා තියෙනවා.")

        if npk_status["potassium"]["level"] == "low":
            base_plan[1]["amount"] = "12-15 grams per plant"
            warnings.append("Potassium මට්ටම අඩුයි! මල් quality එක වැඩි කරන්න potassium වැඩි කරලා තියෙනවා.")

        tips.extend([
            "මල් පිපීම සඳහා Phosphorus (P) හා Potassium (K) වැදගත්.",
            "Nitrogen වැඩියෙන් දුන්නොත් මල් වැටෙන්න පුළුවන්.",
            "Calcium spray එක blossom end rot වළක්වන්න උදව් කරනවා.",
            "මල් වැටීම වැඩියෙන් තියෙනවනම් Boron spray එකක් try කරන්න."
        ])

    elif growth_stage == "fruiting":
        base_plan = [
            {
                "day": "සඳුදා",
                "fertilizer_type": "NPK 5-10-26 (Fruit developer)",
                "amount": "15-18 grams per plant",
                "method": "මුල අවට විසිරවීම",
                "watering": "හොඳින් වතුර දෙන්න"
            },
            {
                "day": "බදාදා",
                "fertilizer_type": "Potassium Sulphate (0-0-50)",
                "amount": "12-15 grams per plant",
                "method": "පස සමග මිශ්‍ර කරන්න",
                "watering": "සාමාන්‍ය වතුර දීම"
            },
            {
                "day": "සිකුරාදා",
                "fertilizer_type": "Calcium Nitrate + Magnesium foliar spray",
                "amount": "7ml per liter water",
                "method": "foliar spray - හවස වරුවේ",
                "watering": "spray කරලා වතුර දෙන්න එපා"
            }
        ]

        # NPK adjustments
        if npk_status["potassium"]["level"] == "low":
            base_plan.insert(2, {
                "day": "බ්‍රහස්පතින්දා",
                "fertilizer_type": "Muriate of Potash (0-0-60)",
                "amount": "15-18 grams per plant",
                "method": "මුල අවට විසිරවීම",
                "watering": "හොඳින් වතුර දෙන්න"
            })
            warnings.append("Potassium මට්ටම ඉතා අඩුයි! ගෙඩි quality එක වැඩි කරන්න extra potassium add කරලා තියෙනවා.")

        if npk_status["nitrogen"]["level"] == "high":
            warnings.append("Nitrogen මට්ටම වැඩියි! ගෙඩි අවධියේ Nitrogen වැඩියෙන් දුන්නොත් fruit quality එක අඩු වෙන්න පුළුවන්.")

        tips.extend([
            "ගෙඩි වර්ධනයට Potassium (K) ඉතා වැදගත්.",
            "Calcium spray එක ගෙඩි තද බව වැඩි කරන්න උදව් කරනවා.",
            "ගෙඩි රතු වෙන අවධියේ Nitrogen අඩු කරන්න.",
            "Magnesium හිඟයක් තියෙනවනම් පළල් කහ වෙනවා - Epsom salt use කරන්න පුළුවන්.",
            "සතියකට පාර 2-3 organic compost tea spray එකක් කරන්න පුළුවන්."
        ])

    else:
        # Unknown or undetected growth stage - provide general recommendations
        base_plan = [
            {
                "day": "සඳුදා",
                "fertilizer_type": "NPK 15-15-15 (Balanced)",
                "amount": "10-12 grams per plant",
                "method": "මුල අවට විසිරවීම",
                "watering": "පොහොර යෙදීමෙන් පස්සේ හොඳින් වතුර දෙන්න"
            },
            {
                "day": "බ්‍රහස්පතින්දා",
                "fertilizer_type": "Organic Compost",
                "amount": "100-150 grams per plant",
                "method": "මුල අවට පොහොර දමා පස සමග මිශ්‍ර කරන්න",
                "watering": "සාමාන්‍ය වතුර දීම"
            }
        ]

        warnings.append("⚠️ Plant detection වුණේ නැහැ! General fertilizer plan එකක් දෙනවා.")
        warnings.append("වඩාත් හොඳ recommendations සඳහා clear plant photo එකක් upload කරන්න.")

        tips.extend([
            "Growth stage detect වෙන්න පැහැදිලි leaves, flowers, හෝ fruits තියෙන photo එකක් ගන්න.",
            "Balanced NPK fertilizer එක සාමාන්‍ය වර්ධනයට හොඳයි.",
            "Organic compost නිතිපතා යෙදීම පස්වල ගුණත්වය වැඩි කරනවා.",
            "Plant එකේ growth stage එක manually බලලා above recommendations වලින් තෝරාගන්න."
        ])

    # Day name mapping for forecast (Sinhala to index)
    day_to_index = {
        "සඳුදා": 0,    # Monday
        "අඟහරුවාදා": 1,  # Tuesday
        "බදාදා": 2,    # Wednesday
        "බ්‍රහස්පතින්දා": 3,  # Thursday
        "සිකුරාදා": 4,  # Friday
        "සෙනසුරාදා": 5   # Saturday
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
                    day_specific_warning = f"🌧️ {day_plan['day']} වැස්ස - පොහොර අඩු කරලා තියෙනවා"
                elif day_condition == "sunny" and day_temp and day_temp > 32:
                    day_weather_factor = 1.0
                    day_specific_warning = f"☀️ {day_plan['day']} උණුසුම් - හවස වරුවේ පොහොර යොදන්න"
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
        tips.append("📅 සතියේ weather forecast එක අනුව දවස් වලට පොහොර amounts adjust කරලා තියෙනවා.")

        # Count rainy days
        rainy_days = sum(1 for f in weather_forecast if f.get("condition") == "rainy")
        if rainy_days >= 3:
            warnings.append(f"⚠️ සතියේ දවස් {rainy_days}ක් වැස්ස! Extra drainage සහතික කරගන්න.")
            tips.append("වැස්ස වැඩි සතියක organic mulch දාන්න - පස erosion අඩු කරනවා.")

    return FertilizerRecommendation(
        week_plan=base_plan,
        npk_status=npk_status,
        warnings=warnings,
        tips=tips
    )
