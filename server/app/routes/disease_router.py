from fastapi import APIRouter, UploadFile, File
from services.disease_service import process_uploaded_image, run_inference_on_folder, run_inference
from pydantic import BaseModel

from fastapi import FastAPI, UploadFile, File, HTTPException
from PIL import Image

app = FastAPI(title="Scotch Bonnet Leaf Disease Detection")

class FolderRequest(BaseModel):
    folder_path: str

router = APIRouter()

@router.post("/")
async def upload_image(file: UploadFile = File(...)):
    result = await process_uploaded_image(file)
    return result


@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    if file.content_type not in ["image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Invalid image type")

    image = Image.open(file.file).convert("RGB")
    result = run_inference(image)

    return result

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