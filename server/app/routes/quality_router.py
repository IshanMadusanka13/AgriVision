from fastapi import APIRouter, UploadFile, File, Query
from typing import List
from pydantic import BaseModel
from services.quality_service import grade_images
from services.batch_service import (
    save_batch_to_supabase,
    get_all_batches,
    get_batch_by_id,
    get_latest_batches
)

router = APIRouter()


# ========== Pydantic Models ==========
class BatchSaveRequest(BaseModel):
    batch_id: str
    total_peppers: int
    grade_counts: dict
    user_id: str = "userId"


# ========== Quality Grading Endpoints ==========
@router.post("/grade")
async def grade(
    files: List[UploadFile] = File(...),
    save_to_db: bool = Query(True),
    user_id: str = Query("public_user")
):
    """
    Accepts 1–4 images from mobile app and grades them.
    Automatically saves results to Supabase database.
    """
    result = await grade_images(files)
    
    # Automatically save to database if grading was successful
    if save_to_db and "counts" in result and "batch_id" in result:
        db_result = await save_batch_to_supabase(
            batch_id=result["batch_id"],
            total_peppers=result.get("total_peppers", 0),
            grade_counts=result["counts"],
            user_id=user_id
        )
        result["database"] = db_result
    
    return result


# ========== Batch Management Endpoints ==========
@router.post("/batch/save")
async def save_batch(request: BatchSaveRequest):
    """
    Manually save batch analysis results to database
    """
    return await save_batch_to_supabase(
        batch_id=request.batch_id,
        total_peppers=request.total_peppers,
        grade_counts=request.grade_counts,
        user_id=request.user_id
    )


@router.get("/batches")
async def get_batches(
    user_id: str = Query("public_user"),
    limit: int = Query(50, ge=1, le=100)
):
    """
    Get all batches for a user (default: public_user)
    """
    return await get_all_batches(user_id=user_id, limit=limit)


@router.get("/batch/{batch_uuid}")
async def get_batch(batch_uuid: str):
    """
    Get details of a specific batch by UUID
    """
    return await get_batch_by_id(batch_uuid)


@router.get("/batches/latest")
async def get_latest(
    user_id: str = Query("public_user"),
    count: int = Query(2, ge=1, le=10)
):
    """
    Get the most recent batches for comparison
    """
    batches = await get_latest_batches(user_id=user_id, count=count)
    return {"success": True, "batches": batches}
