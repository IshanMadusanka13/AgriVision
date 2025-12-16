import numpy as np
import cv2
from io import BytesIO
import os

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
