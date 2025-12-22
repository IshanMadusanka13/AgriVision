import numpy as np
import cv2
from io import BytesIO
import os
from datetime import datetime
from PIL import Image
from configs.model_loader import disease_model
from PIL import Image

REFERENCE_IMAGE_PATH = r"D:\Projects\AgriVision\server\app\img.JPG"

if os.path.exists(REFERENCE_IMAGE_PATH):
    ref_img_bgr = cv2.imread(REFERENCE_IMAGE_PATH)
    ref_img_hsv = cv2.cvtColor(ref_img_bgr, cv2.COLOR_BGR2HSV)

    reference_hist = cv2.calcHist([ref_img_hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
    reference_hist = cv2.normalize(reference_hist, reference_hist).flatten()
else:
    reference_hist = None
    print("Reference image not found at:", REFERENCE_IMAGE_PATH)


async def process_uploaded_image(file):

    if file is None:
        return {
            "error": "No file received. Ensure the client sends FormData properly."
        }

    if isinstance(file, str):
        return {
            "error": "Received a string instead of an UploadFile. Check FE image append logic."
        }

    contents = await file.read()

    if not contents:
        return {"error": "Empty file uploaded."}

    try:
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"error": "Could not decode uploaded image."}

        hsv_img = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    except Exception as e:
        return {"error": f"Failed to process uploaded image: {str(e)}"}

    if reference_hist is None:
        return {"error": "Reference image missing on server."}

    try:
        uploaded_hist = cv2.calcHist([hsv_img], [0, 1], None, [50, 60], [0, 180, 0, 256])
        uploaded_hist = cv2.normalize(uploaded_hist, uploaded_hist).flatten()
    except Exception as e:
        return {"error": f"Failed to compute histogram: {str(e)}"}

    similarity = cv2.compareHist(reference_hist, uploaded_hist, cv2.HISTCMP_CORREL)

    return {
        "filename": file.filename,
        "content_type": file.content_type,
        "similarity_score": float(similarity),
        "message": "Comparison completed successfully",
        "uploaded_hsv_shape": hsv_img.shape,
        "reference_path": REFERENCE_IMAGE_PATH
    }

# ---------------------Model Inference--------------------------------
CONF_THRESHOLD = 0.15

def run_inference(image: Image.Image):
    results = disease_model.predict(
        source=image,
        imgsz=640,
        conf=CONF_THRESHOLD
    )

    detections = results[0].boxes

    if detections is None or len(detections) == 0:
        return {
            "status": "no_leaf_detected"
        }

    best_box = max(detections, key=lambda x: float(x.conf))
    class_id = int(best_box.cls)
    confidence = float(best_box.conf)

    class_name = disease_model.names[class_id]

    return {
        "status": "success",
        "prediction": class_name,
        "confidence": round(confidence * 100, 2)
    }



# -------------------testing model function ------------------------------------------

CONF_THRESHOLD = 0.55
OUTPUT_DIR = "modelTesting/outputs"

os.makedirs(OUTPUT_DIR, exist_ok=True)

SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png")

def run_inference_on_folder(folder_path: str):
    if not os.path.isdir(folder_path):
        raise ValueError("Invalid folder path")

    saved_files = []

    for filename in os.listdir(folder_path):
        if not filename.lower().endswith(SUPPORTED_EXTENSIONS):
            continue

        image_path = os.path.join(folder_path, filename)

        try:
            image = Image.open(image_path).convert("RGB")
        except Exception:
            continue

        results = disease_model.predict(
            source=image,
            imgsz=640,
            conf=CONF_THRESHOLD
        )

        result = results[0]

        if result.boxes is None or len(result.boxes) == 0:
            continue

        annotated_image = result.plot()
        annotated_pil = Image.fromarray(annotated_image)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        output_path = os.path.join(
            OUTPUT_DIR,
            f"{os.path.splitext(filename)[0]}_{timestamp}.jpg"
        )

        annotated_pil.save(output_path, format="JPEG")
        saved_files.append(output_path)

    return saved_files
