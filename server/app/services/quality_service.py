import os
import uuid
import shutil
from typing import List
from fastapi import UploadFile
from ultralytics import YOLO
from PIL import Image

# ===== LOAD MODEL ONCE =====
MODEL_PATH = "../QualityGradingModel/best.pt"

model = YOLO(MODEL_PATH)

CLASS_NAMES = [
    "Category A",
    "Category B",
    "Category C",
    "Category D"
]

async def grade_images(files: List[UploadFile]):
    """
    Mobile-safe YOLO inference
    - Sequential numbering (1,2,3...)
    - Bounding boxes
    - Confidence
    """

    detections = []
    first_image_width = 0
    first_image_height = 0
    pepper_id = 1

    for img_index, file in enumerate(files):

        temp_file = f"temp_{uuid.uuid4()}.jpg"

        # ===== SAVE TEMP FILE =====
        with open(temp_file, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # ===== GET IMAGE SIZE (FIRST IMAGE ONLY) =====
        if img_index == 0:
            with Image.open(temp_file) as img:
                first_image_width, first_image_height = img.size

        # ===== YOLO PREDICTION =====
        results = model.predict(
            source=temp_file,
            conf=0.3,
            iou=0.4,
            verbose=False
        )

        boxes = results[0].boxes

        if boxes is not None:
            for i in range(len(boxes)):
                cls_id = int(boxes.cls[i].item())
                conf = float(boxes.conf[i].item())
                bbox = boxes.xyxy[i].tolist()

                detections.append({
                    "id": pepper_id,
                    "number": pepper_id,
                    "image_id": img_index,
                    "grade": CLASS_NAMES[cls_id],
                    "confidence": round(conf, 3),
                    "bbox": bbox
                })

                pepper_id += 1

        # ===== CLEAN TEMP FILE =====
        os.remove(temp_file)

    # ===== BIN BY CATEGORY =====
    bins = {c: [] for c in CLASS_NAMES}
    for det in detections:
        bins[det["grade"]].append(det)

    counts = {k: len(v) for k, v in bins.items()}

    # ===== FINAL RESPONSE =====
    return {
        "total_images": len(files),
        "total_peppers": len(detections),
        "counts": counts,
        "bins": bins,
        "image_width": first_image_width,
        "image_height": first_image_height
    }
