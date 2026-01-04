from fastapi import APIRouter, UploadFile, File
from typing import List
from services.quality_service import grade_images

router = APIRouter()

@router.post("/grade")
async def grade(files: List[UploadFile] = File(...)):
    """
    Accepts 1–4 images from mobile app
    """
    return await grade_images(files)
