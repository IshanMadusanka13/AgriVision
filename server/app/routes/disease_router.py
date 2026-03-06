from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from PIL import Image
import io
from services.disease_service import disease_service
from services.supabase_service import SupabaseService

SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png"]

router = APIRouter()
supabase_service = SupabaseService()


@router.post("/predict")
async def predict(
    file: UploadFile = File(...),
    user_email: str = Form(None),
    save_to_db: bool = Form(False)
):
    if file.content_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid image type. Supported types: {', '.join(SUPPORTED_IMAGE_TYPES)}"
        )
    
    user_id = None
    if save_to_db:
        if not user_email:
            raise HTTPException(
                status_code=400,
                detail="user_email is required when save_to_db is True"
            )
        
        user = supabase_service.get_user_by_email(user_email)
        if not user:
            raise HTTPException(
                status_code=404,
                detail=f"User not found with email: {user_email}"
            )
        
        user_id = user["id"]
    
    try:
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Error processing image: {str(e)}"
        )
    
    try:
        scan_user_id = user_id if user_id else "anonymous"
        result = disease_service.disease_scan(
            user_id=scan_user_id,
            image=image,
            save_to_db=save_to_db
        )
        
        return JSONResponse(content=result)
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error performing disease detection: {str(e)}"
        )


@router.get("/detections/user/{user_email}")
async def get_user_detections(
    user_email: str,
    limit: int = 10,
    offset: int = 0
):
    user = supabase_service.get_user_by_email(user_email)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User not found with email: {user_email}"
        )
    
    user_id = user["id"]
    
    try:
        detections = disease_service.get_detections_by_user(
            user_id=user_id,
            limit=limit,
            offset=offset
        )
        
        return JSONResponse(content={
            "status": "success",
            "total": len(detections),
            "detections": detections
        })
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching detections: {str(e)}"
        )


@router.get("/detections/{detection_id}")
async def get_detection(detection_id: str):
    try:
        detection = disease_service.get_detection_by_id(detection_id)
        
        if not detection:
            raise HTTPException(
                status_code=404,
                detail=f"Detection not found with ID: {detection_id}"
            )
        
        return JSONResponse(content=detection)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching detection: {str(e)}"
        )