from fastapi import APIRouter, UploadFile, File
from services.disease_service import run_inference_on_folder, run_inference
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image
import io
import base64
from fastapi.responses import JSONResponse

class FolderRequest(BaseModel):
    folder_path: str

router = APIRouter()

@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Invalid image type")

    image = Image.open(file.file).convert("RGB")
    annotated_image, result = run_inference(image)

    print("Prediction result:", result)

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


def get_overall_severity(detections: list) -> str:
    """Determine overall severity based on all detections"""
    if not detections:
        return "None"
    
    severity_scores = []
    for detection in detections:
        disease = detection["disease"]
        severity_scores.append(get_disease_severity_level(disease))
    
    # Return highest severity found
    if "High" in severity_scores:
        return "High"
    elif "Moderate" in severity_scores:
        return "Moderate"
    elif "Low" in severity_scores:
        return "Low"
    else:
        return "None"


def get_disease_severity_level(disease_name: str) -> str:
    """Determine severity level for a disease"""
    severe_diseases = ["bacterial_leaf_spot", "cercospora_leaf_spot"]
    moderate_diseases = ["leaf_curl", "powdery_mildew"]
    
    disease_lower = (disease_name or "").lower().replace(" ", "_")
    
    if any(severe in disease_lower for severe in severe_diseases):
        return "High"
    elif any(moderate in disease_lower for moderate in moderate_diseases):
        return "Moderate"
    elif "healthy" in disease_lower or "nothing" in disease_lower:
        return "None"
    else:
        return "Low"


def get_severity(disease_name: str) -> str:
    """Determine severity based on disease type (kept for backward compatibility)"""
    return get_disease_severity_level(disease_name)


def get_recommendations(disease_name: str) -> list:
    """Get treatment recommendations based on disease"""
    recommendations_map = {
        "leaf_curl": [
            "Remove and destroy heavily infected leaves",
            "Improve plant nutrition and avoid excessive nitrogen",
            "Prune infected areas and dispose of debris",
            "Control vectors if disease is vector-transmitted",
            "Monitor nearby plants and rotate crops when possible"
        ],
        "bacterial_leaf_spot": [
            "Remove and destroy infected tissue promptly",
            "Avoid overhead irrigation and wet foliage",
            "Apply copper-based bactericides where recommended",
            "Disinfect tools and avoid handling plants when wet",
            "Start with certified disease-free seed or transplants"
        ],
        "powdery_mildew": [
            "Remove heavily infected leaves and increase airflow",
            "Apply fungicides labeled for powdery mildew (e.g., sulfur or potassium bicarbonate)",
            "Avoid excessive nitrogen fertilization",
            "Space plants to reduce humidity and improve ventilation",
            "Treat early to limit spread"
        ],
        "cercospora_leaf_spot": [
            "Remove and destroy affected leaves to lower inoculum",
            "Apply appropriate fungicides (follow label instructions)",
            "Avoid overhead watering and reduce leaf wetness duration",
            "Practice crop rotation and clear plant debris",
            "Ensure balanced fertilization to reduce susceptibility"
        ],
        "healthy": [
            "Continue current care and regular monitoring",
            "Maintain proper watering, nutrition, and ventilation",
            "Keep tools and area clean to prevent disease introduction",
            "Record observations and act quickly if symptoms appear"
        ],
        "nothing_detected": [
            "No disease detected in the submitted image",
            "Continue routine monitoring and good cultural practices"
        ]
    }
    
    disease_lower = (disease_name or "").lower().replace(" ", "_")
    
    for key, recommendations in recommendations_map.items():
        if key in disease_lower:
            return recommendations
    
    # Default recommendations
    return [
        "Monitor the plant closely for changes",
        "Ensure proper watering and drainage",
        "Remove any affected plant parts if they appear",
        "Consider consulting a local agricultural extension",
        "Maintain good plant hygiene"
    ]


@router.post("/predict-folder")
def predict_folder(request: FolderRequest):
    try:
        saved_images = run_inference_on_folder(request.folder_path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not saved_images:
        return {
            "status": "completed",
            "message": "No detections found",
            "saved_images": []
        }

    return {
        "status": "completed",
        "processed_images": len(saved_images),
        "saved_images": saved_images
    }