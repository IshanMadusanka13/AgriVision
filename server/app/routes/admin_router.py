from fastapi import APIRouter, HTTPException, status, Depends, Header
from pydantic import BaseModel
from typing import Optional, List

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
    ph_min: Optional[float] = None
    ph_max: Optional[float] = None
    humidity_min: Optional[float] = None
    humidity_max: Optional[float] = None
    temp_min: Optional[float] = None
    temp_max: Optional[float] = None


class FertilizerDayPlan(BaseModel):
    day: str
    fertilizer_type: str
    amount: str
    method: str
    watering: str


class FertilizerStageConfig(BaseModel):
    stage: str
    plan: List[FertilizerDayPlan]


class UpdateFertilizerConfigRequest(BaseModel):
    stages: List[FertilizerStageConfig]


class ConditionsConfig(BaseModel):
    ph_critical_low: float = 5.5
    ph_low: float = 6.0
    ph_high: float = 6.8
    humidity_very_high: float = 85.0
    humidity_high: float = 75.0
    humidity_low: float = 50.0
    temp_very_high: float = 32.0
    temp_high: float = 28.0
    temp_low: float = 15.0


class UpdateGrowthStageConfigRequest(BaseModel):
    configs: List[GrowthStageConfig]


class StageTipsConfig(BaseModel):
    stage: str
    tips: List[str]


class UpdateStageTipsRequest(BaseModel):
    stages: List[StageTipsConfig]


class ConditionKeyConfig(BaseModel):
    condition_key: str
    warnings: List[str] = []
    tips: List[str] = []


class UpdateConditionMessagesRequest(BaseModel):
    conditions: List[ConditionKeyConfig]


async def verify_admin(user_email: str = Header(..., alias="X-User-Email")):
    user = supabase_service.get_user_by_email(user_email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to fetch dashboard stats: {str(e)}")


# ---- Recommendations (warnings & tips) ----

@router.get("/recommendations/metadata")
async def get_recommendations_metadata(admin_user: dict = Depends(verify_admin)):
    try:
        response = supabase_service.client.table("admin_global_recommendations") \
            .select("warnings, tips") \
            .limit(1) \
            .execute()

        if response.data:
            row = response.data[0]
            return {"success": True, "warnings": row.get("warnings", []), "tips": row.get("tips", [])}
        return {"success": True, "warnings": [], "tips": []}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to fetch recommendations: {str(e)}")


@router.put("/recommendations/metadata")
async def update_recommendations_metadata(
    request: UpdateRecommendationRequest,
    admin_user: dict = Depends(verify_admin)
):
    try:
        existing = supabase_service.client.table("admin_global_recommendations") \
            .select("id").limit(1).execute()

        update_data = {}
        if request.warnings is not None:
            update_data["warnings"] = request.warnings
        if request.tips is not None:
            update_data["tips"] = request.tips

        if existing.data:
            row_id = existing.data[0]["id"]
            supabase_service.client.table("admin_global_recommendations") \
                .update(update_data).eq("id", row_id).execute()
        else:
            supabase_service.client.table("admin_global_recommendations") \
                .insert({"warnings": request.warnings or [], "tips": request.tips or []}).execute()

        return {"success": True, "message": "Recommendations updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to update recommendations: {str(e)}")


# ---- Growth Stage Config ----

@router.get("/growth-stage/config")
async def get_growth_stage_config(admin_user: dict = Depends(verify_admin)):
    try:
        response = supabase_service.client.table("growth_stage_config") \
            .select("stage, min_leaves, max_leaves, min_flowers, max_flowers, min_fruits, max_fruits, ph_min, ph_max, humidity_min, humidity_max, temp_min, temp_max") \
            .order("id") \
            .execute()

        return {"success": True, "config": {"stages": response.data}}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to fetch growth stage config: {str(e)}")


@router.put("/growth-stage/config")
async def update_growth_stage_config(
    request: UpdateGrowthStageConfigRequest,
    admin_user: dict = Depends(verify_admin)
):
    try:
        for config in request.configs:
            data = config.dict()
            supabase_service.client.table("growth_stage_config") \
                .upsert(data, on_conflict="stage").execute()

        return {"success": True, "message": "Growth stage configuration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to update growth stage config: {str(e)}")


# ---- Fertilizer Plans ----

@router.get("/fertilizers/config")
async def get_fertilizer_config(admin_user: dict = Depends(verify_admin)):
    try:
        response = supabase_service.client.table("fertilizer_plans") \
            .select("stage, day, fertilizer_type, amount, method, watering, sort_order") \
            .order("stage") \
            .order("sort_order") \
            .execute()

        stages: dict = {}
        for row in response.data:
            s = row["stage"]
            if s not in stages:
                stages[s] = []
            stages[s].append({
                "day": row["day"],
                "fertilizer_type": row["fertilizer_type"],
                "amount": row["amount"],
                "method": row["method"],
                "watering": row["watering"],
            })

        config_data = {"stages": [{"stage": k, "plan": v} for k, v in stages.items()]}
        return {"success": True, "config": config_data}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to fetch fertilizer config: {str(e)}")


@router.put("/fertilizers/config")
async def update_fertilizer_config(
    request: UpdateFertilizerConfigRequest,
    admin_user: dict = Depends(verify_admin)
):
    try:
        for stage_config in request.stages:
            supabase_service.client.table("fertilizer_plans") \
                .delete().eq("stage", stage_config.stage).execute()

            rows = [
                {
                    "stage": stage_config.stage,
                    "day": plan.day,
                    "fertilizer_type": plan.fertilizer_type,
                    "amount": plan.amount,
                    "method": plan.method,
                    "watering": plan.watering,
                    "sort_order": i + 1,
                }
                for i, plan in enumerate(stage_config.plan)
            ]
            if rows:
                supabase_service.client.table("fertilizer_plans").insert(rows).execute()

        return {"success": True, "message": "Fertilizer configuration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to update fertilizer config: {str(e)}")


# ---- Conditions Config ----

@router.get("/conditions/config")
async def get_conditions_config(admin_user: dict = Depends(verify_admin)):
    try:
        response = supabase_service.client.table("conditions_config") \
            .select("ph_critical_low, ph_low, ph_high, humidity_very_high, humidity_high, humidity_low, temp_very_high, temp_high, temp_low") \
            .limit(1) \
            .execute()

        if response.data:
            return {"success": True, "config": response.data[0]}
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Conditions config not found in database. Run the setup SQL.")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to fetch conditions config: {str(e)}")


@router.put("/conditions/config")
async def update_conditions_config(
    request: ConditionsConfig,
    admin_user: dict = Depends(verify_admin)
):
    try:
        existing = supabase_service.client.table("conditions_config") \
            .select("id").limit(1).execute()

        if existing.data:
            row_id = existing.data[0]["id"]
            supabase_service.client.table("conditions_config") \
                .update(request.dict()).eq("id", row_id).execute()
        else:
            supabase_service.client.table("conditions_config") \
                .insert(request.dict()).execute()

        return {"success": True, "message": "Conditions configuration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to update conditions config: {str(e)}")


# ---- Stage Tips ----

@router.get("/stage-tips/config")
async def get_stage_tips(admin_user: dict = Depends(verify_admin)):
    try:
        response = supabase_service.client.table("growth_stage_tips") \
            .select("stage, tip, sort_order") \
            .order("stage").order("sort_order").execute()

        stages: dict = {}
        for row in response.data:
            s = row["stage"]
            if s not in stages:
                stages[s] = []
            stages[s].append(row["tip"])

        config_data = {"stages": [{"stage": k, "tips": v} for k, v in stages.items()]}
        return {"success": True, "config": config_data}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to fetch stage tips: {str(e)}")


@router.put("/stage-tips/config")
async def update_stage_tips(
    request: UpdateStageTipsRequest,
    admin_user: dict = Depends(verify_admin)
):
    try:
        for stage_config in request.stages:
            supabase_service.client.table("growth_stage_tips") \
                .delete().eq("stage", stage_config.stage).execute()

            rows = [
                {"stage": stage_config.stage, "tip": tip, "sort_order": i + 1}
                for i, tip in enumerate(stage_config.tips)
            ]
            if rows:
                supabase_service.client.table("growth_stage_tips").insert(rows).execute()

        return {"success": True, "message": "Stage tips updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to update stage tips: {str(e)}")


# ---- Condition Messages ----

@router.get("/condition-messages/config")
async def get_condition_messages(admin_user: dict = Depends(verify_admin)):
    try:
        response = supabase_service.client.table("condition_messages") \
            .select("condition_key, message_type, message, sort_order") \
            .order("condition_key").order("sort_order").execute()

        conditions: dict = {}
        for row in response.data:
            key = row["condition_key"]
            if key not in conditions:
                conditions[key] = {"condition_key": key, "warnings": [], "tips": []}
            if row["message_type"] == "warning":
                conditions[key]["warnings"].append(row["message"])
            elif row["message_type"] == "tip":
                conditions[key]["tips"].append(row["message"])

        return {"success": True, "config": {"conditions": list(conditions.values())}}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to fetch condition messages: {str(e)}")


@router.put("/condition-messages/config")
async def update_condition_messages(
    request: UpdateConditionMessagesRequest,
    admin_user: dict = Depends(verify_admin)
):
    try:
        for cond in request.conditions:
            supabase_service.client.table("condition_messages") \
                .delete().eq("condition_key", cond.condition_key).execute()

            rows = []
            for i, w in enumerate(cond.warnings):
                rows.append({"condition_key": cond.condition_key, "message_type": "warning",
                              "message": w, "sort_order": i + 1})
            for i, t in enumerate(cond.tips):
                rows.append({"condition_key": cond.condition_key, "message_type": "tip",
                              "message": t, "sort_order": i + 1})
            if rows:
                supabase_service.client.table("condition_messages").insert(rows).execute()

        return {"success": True, "message": "Condition messages updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to update condition messages: {str(e)}")


# ---- Users & Sessions ----

@router.get("/users")
async def get_all_users(admin_user: dict = Depends(verify_admin)):
    try:
        users_response = supabase_service.client.table("users") \
            .select("id, email, name, role, created_at") \
            .order("created_at", desc=True) \
            .execute()

        return {"success": True, "users": users_response.data}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to fetch users: {str(e)}")


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
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"Failed to fetch sessions: {str(e)}")
