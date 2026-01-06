from typing import Dict, List, Optional, Any
from datetime import datetime, date
from uuid import UUID, uuid4
import os
from configs.supabase_client import get_supabase_client


class SupabaseService:

    def __init__(self):
        self.client = get_supabase_client()

    def create_user(self, email: str, name: Optional[str] = None, password_hash: Optional[str] = None, role: str = "user") -> Dict:
       
        user_data = {"email": email, "role": role}
        if name:
            user_data["name"] = name
        if password_hash:
            user_data["password_hash"] = password_hash

        response = self.client.table("users").insert(user_data).execute()
        return response.data[0] if response.data else None

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        
        response = (
            self.client.table("users").select("*").eq("email", email).execute()
        )
        return response.data[0] if response.data else None

    def create_analysis_session(
        self,
        user_id: str,
        nitrogen: Optional[float] = None,
        phosphorus: Optional[float] = None,
        potassium: Optional[float] = None,
        ph: Optional[float] = None,
        temperature: Optional[float] = None,
        humidity: Optional[float] = None,
        location: Optional[str] = None,
        location_lat: Optional[float] = None,
        location_lng: Optional[float] = None,
        original_image_url: Optional[str] = None,
        annotated_image_url: Optional[str] = None,
        growth_stage: Optional[str] = None,
        growth_stage_confidence: Optional[float] = None,
        flower_count: int = 0,
        fruit_count: int = 0,
        leaf_count: int = 0,
        ripening_count: int = 0,
        current_weather: Optional[str] = None,
    ) -> Dict:
        
        session_data = {
            "user_id": user_id,
            "nitrogen": nitrogen,
            "phosphorus": phosphorus,
            "potassium": potassium,
            "ph": ph,
            "temperature": temperature,
            "humidity": humidity,
            "location": location,
            "location_lat": location_lat,
            "location_lng": location_lng,
            "original_image_url": original_image_url,
            "annotated_image_url": annotated_image_url,
            "growth_stage": growth_stage,
            "growth_stage_confidence": growth_stage_confidence,
            "flower_count": flower_count,
            "fruit_count": fruit_count,
            "leaf_count": leaf_count,
            "ripening_count": ripening_count,
            "current_weather": current_weather,
        }

        response = (
            self.client.table("analysis_sessions").insert(session_data).execute()
        )
        return response.data[0] if response.data else None

    def get_user_sessions(
        self, user_id: str, limit: int = 10, offset: int = 0
    ) -> List[Dict]:
       
        response = (
            self.client.table("analysis_sessions")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return response.data

    def get_session_by_id(self, session_id: str) -> Optional[Dict]:
        
        response = (
            self.client.table("analysis_sessions")
            .select("*")
            .eq("id", session_id)
            .execute()
        )
        return response.data[0] if response.data else None

    def save_weather_forecast(
        self, session_id: str, forecast_data: List[Dict]
    ) -> List[Dict]:

        forecast_records = []

        for idx, day_forecast in enumerate(forecast_data):
            forecast_record = {
                "session_id": session_id,
                "forecast_date": day_forecast.get("date"),
                "day_index": idx,
                "condition": day_forecast.get("condition"),
                "temperature": day_forecast.get("temperature"),
                "temp_min": day_forecast.get("temp_min"),
                "temp_max": day_forecast.get("temp_max"),
                "humidity": day_forecast.get("humidity"),
                "precipitation_chance": day_forecast.get("precipitation_chance"),
                "wind_speed": day_forecast.get("wind_speed"),
            }
            forecast_records.append(forecast_record)

        response = (
            self.client.table("weather_forecasts").insert(forecast_records).execute()
        )
        return response.data

    def get_weather_forecast(self, session_id: str) -> List[Dict]:
       
        response = (
            self.client.table("weather_forecasts")
            .select("*")
            .eq("session_id", session_id)
            .order("day_index")
            .execute()
        )
        return response.data


    def save_npk_status(self, session_id: str, npk_status: Dict) -> Dict:
       
        npk_record = {
            "session_id": session_id,
            "nitrogen_level": npk_status.get("nitrogen", {}).get("level"),
            "nitrogen_current": npk_status.get("nitrogen", {}).get("current"),
            "nitrogen_optimal_range": npk_status.get("nitrogen", {}).get("optimal"),
            "phosphorus_level": npk_status.get("phosphorus", {}).get("level"),
            "phosphorus_current": npk_status.get("phosphorus", {}).get("current"),
            "phosphorus_optimal_range": npk_status.get("phosphorus", {}).get(
                "optimal"
            ),
            "potassium_level": npk_status.get("potassium", {}).get("level"),
            "potassium_current": npk_status.get("potassium", {}).get("current"),
            "potassium_optimal_range": npk_status.get("potassium", {}).get("optimal"),
        }

        response = self.client.table("npk_status").insert(npk_record).execute()
        return response.data[0] if response.data else None

    def get_npk_status(self, session_id: str) -> Optional[Dict]:
       
        response = (
            self.client.table("npk_status")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        return response.data[0] if response.data else None

    def save_fertilizer_recommendations(
        self, session_id: str, week_plan: List[Dict]
    ) -> List[Dict]:
        
        recommendation_records = []
        day_name_to_index = {
            "Monday": 0,
            "Tuesday": 1,
            "Wednesday": 2,
            "Thursday": 3,
            "Friday": 4,
            "Saturday": 5,
            "Sunday": 6,
        }

        for day_plan in week_plan:
            forecast = day_plan.get("forecast", {})
            recommendation_record = {
                "session_id": session_id,
                "day_name": day_plan.get("day"),
                "day_index": day_name_to_index.get(day_plan.get("day")),
                "fertilizer_type": day_plan.get("fertilizer_type"),
                "amount": day_plan.get("amount"),
                "amount_adjusted": day_plan.get("amount_adjusted"),
                "method": day_plan.get("method"),
                "watering": day_plan.get("watering"),
                "forecast_condition": forecast.get("condition"),
                "forecast_temperature": forecast.get("temperature"),
                "forecast_humidity": forecast.get("humidity"),
            }
            recommendation_records.append(recommendation_record)

        response = (
            self.client.table("fertilizer_recommendations")
            .insert(recommendation_records)
            .execute()
        )
        return response.data

    def get_fertilizer_recommendations(self, session_id: str) -> List[Dict]:
        
        response = (
            self.client.table("fertilizer_recommendations")
            .select("*")
            .eq("session_id", session_id)
            .order("day_index")
            .execute()
        )
        return response.data

    def save_recommendations_metadata(
        self, session_id: str, warnings: List[str], tips: List[str]
    ) -> Dict:
        
        metadata_record = {
            "session_id": session_id,
            "warnings": warnings,
            "tips": tips,
        }

        response = (
            self.client.table("recommendations_metadata")
            .insert(metadata_record)
            .execute()
        )
        return response.data[0] if response.data else None

    def get_recommendations_metadata(self, session_id: str) -> Optional[Dict]:
        
        response = (
            self.client.table("recommendations_metadata")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        return response.data[0] if response.data else None

    def upload_image(
        self, file_path: str, bucket_name: str = "plant-images", user_id: str = None
    ) -> str:
        
        try:
            file_name = f"{user_id}/{uuid4()}.jpg" if user_id else f"{uuid4()}.jpg"

            with open(file_path, "rb") as f:
                file_data = f.read()

            response = self.client.storage.from_(bucket_name).upload(
                file_name, file_data, {"content-type": "image/jpeg"}
            )

            public_url = self.client.storage.from_(bucket_name).get_public_url(
                file_name
            )

            return public_url
        except Exception as e:
            print(f"Error uploading image: {e}")
            return None

    def save_complete_analysis(
        self,
        user_id: str,
        npk_data: Dict,
        environmental_data: Dict,
        image_urls: Dict,
        growth_stage_data: Dict,
        weather_forecast: List[Dict],
        npk_status: Dict,
        fertilizer_recommendation: Dict,
    ) -> str:
        
        session = self.create_analysis_session(
            user_id=user_id,
            nitrogen=npk_data.get("nitrogen"),
            phosphorus=npk_data.get("phosphorus"),
            potassium=npk_data.get("potassium"),
            ph=environmental_data.get("ph"),
            temperature=environmental_data.get("temperature"),
            humidity=environmental_data.get("humidity"),
            location=environmental_data.get("location"),
            location_lat=environmental_data.get("location_lat"),
            location_lng=environmental_data.get("location_lng"),
            original_image_url=image_urls.get("original_image_url"),
            annotated_image_url=image_urls.get("annotated_image_url"),
            growth_stage=growth_stage_data.get("growth_stage"),
            growth_stage_confidence=growth_stage_data.get("confidence"),
            flower_count=growth_stage_data.get("flower_count", 0),
            fruit_count=growth_stage_data.get("fruit_count", 0),
            leaf_count=growth_stage_data.get("leaf_count", 0),
            ripening_count=growth_stage_data.get("ripening_count", 0),
            current_weather=environmental_data.get("current_weather"),
        )

        session_id = session["id"]

        if weather_forecast:
            self.save_weather_forecast(session_id, weather_forecast)

        if npk_status:
            self.save_npk_status(session_id, npk_status)

        if fertilizer_recommendation:
            week_plan = fertilizer_recommendation.get("week_plan", [])
            warnings = fertilizer_recommendation.get("warnings", [])
            tips = fertilizer_recommendation.get("tips", [])

            if week_plan:
                self.save_fertilizer_recommendations(session_id, week_plan)

            if warnings or tips:
                self.save_recommendations_metadata(session_id, warnings, tips)

        return session_id

    def get_complete_analysis(self, session_id: str) -> Dict:
        
        session = self.get_session_by_id(session_id)
        if not session:
            return None

        weather_forecast = self.get_weather_forecast(session_id)
        npk_status = self.get_npk_status(session_id)
        fertilizer_recommendations = self.get_fertilizer_recommendations(session_id)
        metadata = self.get_recommendations_metadata(session_id)

        return {
            "session": session,
            "weather_forecast": weather_forecast,
            "npk_status": npk_status,
            "fertilizer_recommendations": fertilizer_recommendations,
            "warnings": metadata.get("warnings", []) if metadata else [],
            "tips": metadata.get("tips", []) if metadata else [],
        }
