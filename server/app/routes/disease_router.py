from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from services.disease_service import run_inference
from utils.disease_util import (
    SUPPORTED_IMAGE_TYPES,
    get_recommendations,
    get_overall_severity
)
from PIL import Image
import io
import base64

class FolderRequest(BaseModel):
    folder_path: str

router = APIRouter()

@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    # Validate image type
    if file.content_type not in SUPPORTED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image type")

    # Process image
    image = Image.open(file.file).convert("RGB")
    annotated_image, result = run_inference(image)

    # If no detection, return JSON response
    if annotated_image is None:
        return JSONResponse(content=result)

    # Convert annotated image to base64
    img_byte_arr = io.BytesIO()
    annotated_image.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    img_base64 = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

    # Get comprehensive recommendations based on all detected diseases
    all_recommendations = []
    unique_diseases = set()
    
    for detection in result.get("detections", []):
        disease = detection["disease"]
        if disease not in unique_diseases:
            unique_diseases.add(disease)
            disease_recs = get_recommendations(disease)
            all_recommendations.extend(disease_recs)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_recommendations = []
    for rec in all_recommendations:
        if rec not in seen:
            seen.add(rec)
            unique_recommendations.append(rec)

    # Determine overall severity
    overall_severity = get_overall_severity(result.get("detections", []))

    # Return comprehensive response
    return JSONResponse(content={
        "annotatedImage": f"data:image/png;base64,{img_base64}",
        "diagnosis": result.get("primary_disease", "Unknown"),
        "confidence": result.get("primary_confidence", 0),
        "severity": overall_severity,
        "total_detections": result.get("total_detections", 0),
        "detections": result.get("detections", []),
        "disease_summary": result.get("disease_summary", {}),
        "conclusion": result.get("conclusion", ""),
        "recommendations": unique_recommendations,
        "status": result.get("status", "success")
    })