from fastapi import APIRouter, UploadFile, File
from services.upload_service import process_uploaded_image

router = APIRouter()

@router.post("/")
async def upload_image(file: UploadFile = File(...)):
    result = await process_uploaded_image(file)
    return result
