from fastapi import APIRouter, HTTPException, status, Depends, Header
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
import json
import os

try:
    from services.supabase_service import SupabaseService
except ImportError:
    from services.supabase_service import SupabaseService

router = APIRouter()
supabase_service = SupabaseService()


class UpdateRecommendationRequest(BaseModel):
    warnings: Optional[List[str]] = None
    tips: Optional[List[str]] = None


class GrowthStageConfig(BaseModel):
    stage: str
    min_leaves: Optional[int] = None
    max_leaves: Optional[int] = None
    min_flowers: Optional[int] = None
    max_flowers: Optional[int] = None
    min_fruits: Optional[int] = None
    max_fruits: Optional[int] = None
    nitrogen_min: Optional[float] = None
    nitrogen_max: Optional[float] = None
    phosphorus_min: Optional[float] = None
    phosphorus_max: Optional[float] = None
    potassium_min: Optional[float] = None
    potassium_max: Optional[float] = None


class UpdateGrowthStageConfigRequest(BaseModel):
    configs: List[GrowthStageConfig]


async def verify_admin(user_email: str = Header(..., alias="X-User-Email")):
    
    user = supabase_service.get_user_by_email(user_email)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user


@router.get("/dashboard/stats")
async def get_dashboard_stats(admin_user: dict = Depends(verify_admin)):
    
    try:
        users_response = supabase_service.client.table("users").select("id", count="exact").execute()
        total_users = users_response.count if hasattr(users_response, 'count') else len(users_response.data)

        sessions_response = supabase_service.client.table("analysis_sessions").select("id", count="exact").execute()
        total_sessions = sessions_response.count if hasattr(sessions_response, 'count') else len(sessions_response.data)

        recent_sessions = supabase_service.client.table("analysis_sessions") \
            .select("id, created_at, growth_stage, user_id") \
            .order("created_at", desc=True) \
            .limit(10) \
            .execute()

        return {
            "success": True,
            "stats": {
                "total_users": total_users,
                "total_sessions": total_sessions,
                "recent_sessions": recent_sessions.data
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dashboard stats: {str(e)}"
        )


@router.get("/recommendations/metadata")
async def get_recommendations_metadata(admin_user: dict = Depends(verify_admin)):

    try:
        metadata_response = supabase_service.client.table("recommendations_metadata") \
            .select("warnings, tips") \
            .execute()

        all_warnings = set()
        all_tips = set()

        for metadata in metadata_response.data:
            if metadata.get("warnings"):
                all_warnings.update(metadata["warnings"])
            if metadata.get("tips"):
                all_tips.update(metadata["tips"])

        return {
            "success": True,
            "warnings": list(all_warnings),
            "tips": list(all_tips)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch recommendations metadata: {str(e)}"
        )


@router.put("/recommendations/metadata")
async def update_recommendations_metadata(
    request: UpdateRecommendationRequest,
    admin_user: dict = Depends(verify_admin)
):
    
    try:
        config_dir = "app/config"
        os.makedirs(config_dir, exist_ok=True)
        config_file = os.path.join(config_dir, "recommendations_config.json")

        config_data = {}
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config_data = json.load(f)

        if request.warnings is not None:
            config_data["warnings"] = request.warnings
        if request.tips is not None:
            config_data["tips"] = request.tips

        with open(config_file, 'w') as f:
            json.dump(config_data, f, indent=2)

        return {
            "success": True,
            "message": "Recommendations metadata updated successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update recommendations metadata: {str(e)}"
        )


@router.get("/growth-stage/config")
async def get_growth_stage_config(admin_user: dict = Depends(verify_admin)):
    try:
        config_file = "app/config/growth_stage_config.json"

        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config_data = json.load(f)
        else:
            config_data = {
                "stages": [
                    {
                        "stage": "early_vegetative",
                        "min_leaves": 1,
                        "max_leaves": 10,
                        "min_flowers": 0,
                        "max_flowers": 0,
                        "min_fruits": 0,
                        "max_fruits": 0,
                        "nitrogen_min": 80,
                        "nitrogen_max": 120,
                        "phosphorus_min": 40,
                        "phosphorus_max": 60,
                        "potassium_min": 100,
                        "potassium_max": 150
                    },
                    {
                        "stage": "vegetative",
                        "min_leaves": 10,
                        "max_leaves": 999,
                        "min_flowers": 0,
                        "max_flowers": 0,
                        "min_fruits": 0,
                        "max_fruits": 0,
                        "nitrogen_min": 100,
                        "nitrogen_max": 150,
                        "phosphorus_min": 50,
                        "phosphorus_max": 80,
                        "potassium_min": 120,
                        "potassium_max": 180
                    },
                    {
                        "stage": "flowering",
                        "min_leaves": 10,
                        "max_leaves": 999,
                        "min_flowers": 1,
                        "max_flowers": 999,
                        "min_fruits": 0,
                        "max_fruits": 0,
                        "nitrogen_min": 60,
                        "nitrogen_max": 100,
                        "phosphorus_min": 80,
                        "phosphorus_max": 120,
                        "potassium_min": 150,
                        "potassium_max": 200
                    },
                    {
                        "stage": "fruiting",
                        "min_leaves": 10,
                        "max_leaves": 999,
                        "min_flowers": 0,
                        "max_flowers": 999,
                        "min_fruits": 1,
                        "max_fruits": 999,
                        "nitrogen_min": 60,
                        "nitrogen_max": 100,
                        "phosphorus_min": 60,
                        "phosphorus_max": 100,
                        "potassium_min": 180,
                        "potassium_max": 250
                    },
                    {
                        "stage": "ripening",
                        "min_leaves": 10,
                        "max_leaves": 999,
                        "min_flowers": 0,
                        "max_flowers": 999,
                        "min_fruits": 3,
                        "max_fruits": 999,
                        "nitrogen_min": 40,
                        "nitrogen_max": 80,
                        "phosphorus_min": 40,
                        "phosphorus_max": 80,
                        "potassium_min": 200,
                        "potassium_max": 300
                    }
                ]
            }

        return {
            "success": True,
            "config": config_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch growth stage config: {str(e)}"
        )


@router.put("/growth-stage/config")
async def update_growth_stage_config(
    request: UpdateGrowthStageConfigRequest,
    admin_user: dict = Depends(verify_admin)
):
    
    try:
        config_dir = "app/config"
        os.makedirs(config_dir, exist_ok=True)
        config_file = os.path.join(config_dir, "growth_stage_config.json")

        config_data = {
            "stages": [config.dict() for config in request.configs]
        }

        with open(config_file, 'w') as f:
            json.dump(config_data, f, indent=2)

        return {
            "success": True,
            "message": "Growth stage configuration updated successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update growth stage config: {str(e)}"
        )


@router.get("/users")
async def get_all_users(admin_user: dict = Depends(verify_admin)):
   
    try:
        users_response = supabase_service.client.table("users") \
            .select("id, email, name, role, created_at") \
            .order("created_at", desc=True) \
            .execute()

        return {
            "success": True,
            "users": users_response.data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch users: {str(e)}"
        )


@router.get("/sessions")
async def get_all_sessions(
    admin_user: dict = Depends(verify_admin),
    limit: int = 50,
    offset: int = 0
):
    
    try:
        sessions_response = supabase_service.client.table("analysis_sessions") \
            .select("*") \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1) \
            .execute()

        return {
            "success": True,
            "sessions": sessions_response.data,
            "count": len(sessions_response.data)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch sessions: {str(e)}"
        )
