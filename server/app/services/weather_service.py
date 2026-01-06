import os
import requests
from typing import Optional, Dict
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

# OpenWeatherMap API configuration
WEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "8a266cfd312cab31047b5fa79956f489")
WEATHER_API_BASE_URL = os.getenv("WEATHER_API_BASE_URL", "https://api.openweathermap.org/data/2.5")


class WeatherService:

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or WEATHER_API_KEY
        if not self.api_key:
            print("⚠️ Warning: OPENWEATHER_API_KEY environment variable not found!")

    def get_current_weather(self, lat: float, lon: float) -> Dict:
        
        if not self.api_key:
            print("⚠️ Weather API: No API key - using mock data")
            return self._get_mock_weather()

        try:
            url = f"{WEATHER_API_BASE_URL}/weather"
            params = {
                "lat": lat,
                "lon": lon,
                "appid": self.api_key,
                "units": "metric" 
            }

            print(f"🌤️ Fetching current weather for ({lat:.4f}, {lon:.4f})...")
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            result = {
                "condition": self._map_weather_condition(data["weather"][0]["main"]),
                "temperature": data["main"]["temp"],
                "humidity": data["main"]["humidity"],
                "description": data["weather"][0]["description"],
                "timestamp": datetime.now().isoformat(),
                "location": data["name"]
            }

            print(f"✅ Current weather: {result['condition']} ({result['temperature']:.1f}°C, {result['humidity']}% humidity)")
            return result

        except requests.exceptions.RequestException as e:
            print(f"❌ Weather API error: {e}")
            print("⚠️ Falling back to mock data")
            return self._get_mock_weather()

    def get_weather_forecast(self, lat: float, lon: float, days: int = 7) -> list:
        
        if not self.api_key:
            print(f"⚠️ Weather Forecast API: No API key - using mock data for {days} days")
            return self._get_mock_forecast(days)

        try:
            url = f"{WEATHER_API_BASE_URL}/forecast"
            params = {
                "lat": lat,
                "lon": lon,
                "appid": self.api_key,
                "units": "metric",
                "cnt": min(days * 8, 40)  
            }

            print(f"📅 Fetching {days}-day weather forecast for ({lat:.4f}, {lon:.4f})...")
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()

            data = response.json()

            daily_forecasts = []
            current_date = None
            daily_data = {
                "temps": [],
                "humidity": [],
                "conditions": []
            }

            for item in data["list"]:
                dt = datetime.fromtimestamp(item["dt"])
                date = dt.date()

                if current_date is None:
                    current_date = date

                if date != current_date:
                    if daily_data["temps"]:
                        daily_forecasts.append({
                            "date": current_date.isoformat(),
                            "condition": max(set(daily_data["conditions"]),
                                           key=daily_data["conditions"].count),
                            "temperature": sum(daily_data["temps"]) / len(daily_data["temps"]),
                            "temp_min": min(daily_data["temps"]),
                            "temp_max": max(daily_data["temps"]),
                            "humidity": sum(daily_data["humidity"]) / len(daily_data["humidity"])
                        })

                    current_date = date
                    daily_data = {
                        "temps": [],
                        "humidity": [],
                        "conditions": []
                    }

                daily_data["temps"].append(item["main"]["temp"])
                daily_data["humidity"].append(item["main"]["humidity"])
                daily_data["conditions"].append(
                    self._map_weather_condition(item["weather"][0]["main"])
                )

            if daily_data["temps"]:
                daily_forecasts.append({
                    "date": current_date.isoformat(),
                    "condition": max(set(daily_data["conditions"]),
                                   key=daily_data["conditions"].count),
                    "temperature": sum(daily_data["temps"]) / len(daily_data["temps"]),
                    "temp_min": min(daily_data["temps"]),
                    "temp_max": max(daily_data["temps"]),
                    "humidity": sum(daily_data["humidity"]) / len(daily_data["humidity"])
                })

            forecast_result = daily_forecasts[:days]
            print(f"✅ Forecast retrieved: {len(forecast_result)} days")
            for i, day in enumerate(forecast_result[:3]):
                print(f"   Day {i+1} ({day['date']}): {day['condition']} ({day['temperature']:.1f}°C)")
            if len(forecast_result) > 3:
                print(f"   ... and {len(forecast_result)-3} more days")

            return forecast_result

        except requests.exceptions.RequestException as e:
            print(f"❌ Weather forecast API error: {e}")
            print(f"⚠️ Falling back to mock forecast for {days} days")
            return self._get_mock_forecast(days)

    def _map_weather_condition(self, condition: str) -> str:
        
        condition_map = {
            "Clear": "sunny",
            "Clouds": "cloudy",
            "Rain": "rainy",
            "Drizzle": "rainy",
            "Thunderstorm": "rainy",
            "Snow": "cloudy",
            "Mist": "cloudy",
            "Fog": "cloudy",
            "Haze": "cloudy"
        }
        return condition_map.get(condition, "sunny")

    def _get_mock_weather(self) -> Dict:
        
        return {
            "condition": "sunny",
            "temperature": 28.0,
            "humidity": 65.0,
            "description": "Mock data - No API key configured",
            "timestamp": datetime.now().isoformat()
        }

    def _get_mock_forecast(self, days: int) -> list:
        
        forecasts = []
        base_date = datetime.now().date()

        for i in range(days):
            forecasts.append({
                "date": (base_date + timedelta(days=i)).isoformat(),
                "condition": "sunny" if i % 2 == 0 else "cloudy",
                "temperature": 28.0 + (i % 3),
                "temp_min": 25.0,
                "temp_max": 32.0,
                "humidity": 65.0
            })

        return forecasts


weather_service = WeatherService()
