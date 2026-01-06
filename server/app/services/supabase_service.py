"""
Supabase Service Layer
Handles all database operations for storing and retrieving agricultural data
"""

from typing import Dict, List, Optional, Any
from datetime import datetime, date
from uuid import UUID, uuid4
import os
from configs.supabase_client import get_supabase_client


class SupabaseService:
    """Service class for Supabase database operations"""

    def __init__(self):
        self.client = get_supabase_client()

    # ==================== User Operations ====================

    def create_user(self, email: str, name: Optional[str] = None, password_hash: Optional[str] = None, role: str = "user") -> Dict:
        """
        Create a new user

        Args:
            email: User email
            name: User name (optional)
            password_hash: Hashed password (optional)
            role: User role (default: 'user', can be 'admin')

        Returns:
            Dict: Created user data
        """
        user_data = {"email": email, "role": role}
        if name:
            user_data["name"] = name
        if password_hash:
            user_data["password_hash"] = password_hash

        response = self.client.table("users").insert(user_data).execute()
        return response.data[0] if response.data else None

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """
        Get user by email

        Args:
            email: User email

        Returns:
            Dict: User data or None
        """
        response = (
            self.client.table("users").select("*").eq("email", email).execute()
        )
        return response.data[0] if response.data else None

    # ==================== Analysis Session Operations ====================

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
        """
        Create a new analysis session with all user inputs

        Args:
            user_id: User ID
            nitrogen: Nitrogen value (mg/kg)
            phosphorus: Phosphorus value (mg/kg)
            potassium: Potassium value (mg/kg)
            ph: Soil pH value
            temperature: Temperature (Celsius)
            humidity: Humidity percentage
            location: Location name/address
            location_lat: Location latitude
            location_lng: Location longitude
            original_image_url: URL of uploaded image
            annotated_image_url: URL of annotated image
            growth_stage: Detected growth stage
            growth_stage_confidence: Confidence score
            flower_count: Number of flowers detected
            fruit_count: Number of fruits detected
            leaf_count: Number of leaves detected
            ripening_count: Number of ripening fruits detected
            current_weather: Current weather condition

        Returns:
            Dict: Created session data
        """
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
        """
        Get all analysis sessions for a user

        Args:
            user_id: User ID
            limit: Number of sessions to return
            offset: Offset for pagination

        Returns:
            List[Dict]: List of session data
        """
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
        """
        Get a specific analysis session

        Args:
            session_id: Session ID

        Returns:
            Dict: Session data or None
        """
        response = (
            self.client.table("analysis_sessions")
            .select("*")
            .eq("id", session_id)
            .execute()
        )
        return response.data[0] if response.data else None

    # ==================== Weather Forecast Operations ====================

    def save_weather_forecast(
        self, session_id: str, forecast_data: List[Dict]
    ) -> List[Dict]:
        """
        Save 7-day weather forecast for a session

        Args:
            session_id: Session ID
            forecast_data: List of forecast data for each day
                Each item: {date, day_index, condition, temperature, temp_min, temp_max, humidity, etc.}

        Returns:
            List[Dict]: Created forecast records
        """
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
        """
        Get weather forecast for a session

        Args:
            session_id: Session ID

        Returns:
            List[Dict]: Forecast data ordered by day_index
        """
        response = (
            self.client.table("weather_forecasts")
            .select("*")
            .eq("session_id", session_id)
            .order("day_index")
            .execute()
        )
        return response.data

    # ==================== NPK Status Operations ====================

    def save_npk_status(self, session_id: str, npk_status: Dict) -> Dict:
        """
        Save NPK analysis status

        Args:
            session_id: Session ID
            npk_status: NPK status data
                {
                    "nitrogen": {"level": "low/optimal/high", "current": 100, "optimal": "80-120"},
                    "phosphorus": {...},
                    "potassium": {...}
                }

        Returns:
            Dict: Created NPK status record
        """
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
        """
        Get NPK status for a session

        Args:
            session_id: Session ID

        Returns:
            Dict: NPK status data or None
        """
        response = (
            self.client.table("npk_status")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        return response.data[0] if response.data else None

    # ==================== Fertilizer Recommendations Operations ====================

    def save_fertilizer_recommendations(
        self, session_id: str, week_plan: List[Dict]
    ) -> List[Dict]:
        """
        Save fertilizer recommendation week plan

        Args:
            session_id: Session ID
            week_plan: List of daily fertilizer plans
                Each item: {day, fertilizer_type, amount, method, watering, forecast, etc.}

        Returns:
            List[Dict]: Created recommendation records
        """
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
        """
        Get fertilizer recommendations for a session

        Args:
            session_id: Session ID

        Returns:
            List[Dict]: Recommendation data ordered by day_index
        """
        response = (
            self.client.table("fertilizer_recommendations")
            .select("*")
            .eq("session_id", session_id)
            .order("day_index")
            .execute()
        )
        return response.data

    # ==================== Recommendations Metadata Operations ====================

    def save_recommendations_metadata(
        self, session_id: str, warnings: List[str], tips: List[str]
    ) -> Dict:
        """
        Save recommendations metadata (warnings and tips)

        Args:
            session_id: Session ID
            warnings: List of warning messages
            tips: List of tip messages

        Returns:
            Dict: Created metadata record
        """
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
        """
        Get recommendations metadata for a session

        Args:
            session_id: Session ID

        Returns:
            Dict: Metadata with warnings and tips or None
        """
        response = (
            self.client.table("recommendations_metadata")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        return response.data[0] if response.data else None

    # ==================== Image Upload Operations ====================

    def upload_image(
        self, file_path: str, bucket_name: str = "plant-images", user_id: str = None
    ) -> str:
        """
        Upload image to Supabase Storage

        Args:
            file_path: Path to image file
            bucket_name: Storage bucket name
            user_id: User ID for organizing files

        Returns:
            str: Public URL of uploaded image
        """
        try:
            # Generate unique filename
            file_name = f"{user_id}/{uuid4()}.jpg" if user_id else f"{uuid4()}.jpg"

            # Read file
            with open(file_path, "rb") as f:
                file_data = f.read()

            # Upload to Supabase Storage
            response = self.client.storage.from_(bucket_name).upload(
                file_name, file_data, {"content-type": "image/jpeg"}
            )

            # Get public URL
            public_url = self.client.storage.from_(bucket_name).get_public_url(
                file_name
            )

            return public_url
        except Exception as e:
            print(f"Error uploading image: {e}")
            return None

    # ==================== Complete Session Save ====================

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
        """
        Save complete analysis session with all related data

        Args:
            user_id: User ID
            npk_data: {nitrogen, phosphorus, potassium}
            environmental_data: {ph, temperature, humidity, location, location_lat, location_lng}
            image_urls: {original_image_url, annotated_image_url}
            growth_stage_data: {growth_stage, confidence, flower_count, fruit_count, leaf_count, ripening_count}
            weather_forecast: List of 7-day forecast data
            npk_status: NPK analysis status
            fertilizer_recommendation: {week_plan, warnings, tips}

        Returns:
            str: Created session ID
        """
        # Create analysis session
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

        # Save weather forecast
        if weather_forecast:
            self.save_weather_forecast(session_id, weather_forecast)

        # Save NPK status
        if npk_status:
            self.save_npk_status(session_id, npk_status)

        # Save fertilizer recommendations
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
        """
        Get complete analysis session with all related data

        Args:
            session_id: Session ID

        Returns:
            Dict: Complete analysis data
        """
        session = self.get_session_by_id(session_id)
        if not session:
            return None

        # Get related data
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



# Add these methods to the existing SupabaseService class in supabase_service.py

# ==================== Disease Detection Operations ====================

def get_disease_info_by_name(self, disease_name: str) -> Optional[Dict]:
    """
    Get disease information by name
    
    Args:
        disease_name: Name of the disease
        
    Returns:
        Dict: Disease information or None
    """
    response = (
        self.client.table("disease_info")
        .select("*")
        .eq("disease_name", disease_name)
        .execute()
    )
    return response.data[0] if response.data else None


def get_multiple_diseases_info(self, disease_names: List[str]) -> List[Dict]:
    """
    Get information for multiple diseases
    
    Args:
        disease_names: List of disease names
        
    Returns:
        List[Dict]: List of disease information
    """
    response = (
        self.client.table("disease_info")
        .select("*")
        .in_("disease_name", disease_names)
        .execute()
    )
    return response.data


def create_disease_detection(
    self,
    user_id: str,
    annotated_image_url: Optional[str],
    total_detections: int,
    detections: List[Dict],
    disease_summary: Dict,
    conclusion: str,
    recommendations: Dict,
    status: str
) -> Dict:
    """
    Create a new disease detection record
    
    Args:
        user_id: User ID
        annotated_image_url: URL of annotated image
        total_detections: Total number of detections
        detections: List of detection details
        disease_summary: Summary of diseases detected
        conclusion: Analysis conclusion
        recommendations: Treatment recommendations
        status: Detection status
        
    Returns:
        Dict: Created detection record
    """
    detection_data = {
        "user_id": user_id,
        "annotated_image_url": annotated_image_url,
        "total_detections": total_detections,
        "detections": detections,
        "disease_summary": disease_summary,
        "conclusion": conclusion,
        "recommendations": recommendations,
        "status": status
    }
    
    response = (
        self.client.table("disease_detections")
        .insert(detection_data)
        .execute()
    )
    return response.data[0] if response.data else None


def get_detection_by_id(self, detection_id: str) -> Optional[Dict]:
    """
    Get a disease detection by ID
    
    Args:
        detection_id: Detection ID
        
    Returns:
        Dict: Detection data or None
    """
    response = (
        self.client.table("disease_detections")
        .select("*")
        .eq("id", detection_id)
        .execute()
    )
    return response.data[0] if response.data else None


def get_user_detections(
    self, 
    user_id: str, 
    limit: int = 10, 
    offset: int = 0
) -> List[Dict]:
    """
    Get all disease detections for a user
    
    Args:
        user_id: User ID
        limit: Number of records to return
        offset: Offset for pagination
        
    Returns:
        List[Dict]: List of detection records
    """
    response = (
        self.client.table("disease_detections")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return response.data


def get_detection_statistics(self, user_id: str) -> Dict:
    """
    Get statistics about user's disease detections
    
    Args:
        user_id: User ID
        
    Returns:
        Dict: Statistics including total scans, diseases found, etc.
    """
    # Get all user detections
    response = (
        self.client.table("disease_detections")
        .select("total_detections, disease_summary, status")
        .eq("user_id", user_id)
        .execute()
    )
    
    if not response.data:
        return {
            "total_scans": 0,
            "total_detections": 0,
            "diseases_found": {},
            "healthy_scans": 0
        }
    
    total_scans = len(response.data)
    total_detections = sum(d["total_detections"] for d in response.data)
    
    # Aggregate disease counts
    all_diseases = {}
    healthy_scans = 0
    
    for detection in response.data:
        disease_summary = detection.get("disease_summary", {})
        for disease, count in disease_summary.items():
            if "healthy" in disease.lower():
                healthy_scans += 1
            all_diseases[disease] = all_diseases.get(disease, 0) + count
    
    return {
        "total_scans": total_scans,
        "total_detections": total_detections,
        "diseases_found": all_diseases,
        "healthy_scans": healthy_scans
    }


def upload_detection_image(
    self, 
    image_bytes: bytes, 
    user_id: str,
    content_type: str = "image/png"
) -> str:
    """
    Upload disease detection image to Supabase Storage
    
    Args:
        image_bytes: Image data as bytes
        user_id: User ID
        content_type: Image content type
        
    Returns:
        str: Public URL of uploaded image
    """
    try:
        from uuid import uuid4
        
        # Generate unique filename
        file_extension = "png" if "png" in content_type else "jpg"
        file_name = f"{user_id}/detections/{uuid4()}.{file_extension}"
        
        # Upload to Supabase Storage
        response = self.client.storage.from_("plant-images").upload(
            file_name, 
            image_bytes,
            {"content-type": content_type}
        )
        
        # Get public URL
        public_url = self.client.storage.from_("plant-images").get_public_url(file_name)
        
        return public_url
    except Exception as e:
        print(f"Error uploading detection image: {e}")
        return None