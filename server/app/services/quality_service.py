import os
import uuid
import shutil
from typing import List
from fastapi import UploadFile
from PIL import Image
from configs.model_loader import quality_model

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
    - Polygons (if segmentation masks exist)
    - Confidence
    """

    detections = []
    first_image_width = 0
    first_image_height = 0
    pepper_id = 1

    for img_index, file in enumerate(files):
        temp_file = f"temp_{uuid.uuid4()}.jpg"

        try:
            # ===== SAVE TEMP FILE =====
            with open(temp_file, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # ===== GET IMAGE SIZE (FIRST IMAGE ONLY) =====
            if img_index == 0:
                with Image.open(temp_file) as img:
                    first_image_width, first_image_height = img.size

            # ===== YOLO PREDICTION =====
            results = quality_model.predict(
                source=temp_file,
                conf=0.3,
                iou=0.4,
                verbose=False
            )

            result = results[0]
            boxes = result.boxes
            masks_xy = result.masks.xy if result.masks is not None else None

            if boxes is not None:
                for i in range(len(boxes)):
                    cls_id = int(boxes.cls[i].item())
                    conf = float(boxes.conf[i].item())
                    bbox = [float(v) for v in boxes.xyxy[i].tolist()]

                    # Polygon in original image coordinates
                    polygon = []
                    if masks_xy is not None and i < len(masks_xy):
                        pts = masks_xy[i]
                        if pts is not None and len(pts) >= 3:
                            polygon = [[float(x), float(y)] for x, y in pts.tolist()]

                    detections.append({
                        "id": pepper_id,
                        "number": pepper_id,
                        "image_id": img_index,
                        "grade": CLASS_NAMES[cls_id],
                        "confidence": round(conf, 3),
                        "bbox": bbox,
                        "polygon": polygon
                    })

                    pepper_id += 1

        finally:
            # ===== CLEAN TEMP FILE =====
            if os.path.exists(temp_file):
                os.remove(temp_file)

    # ===== BIN BY CATEGORY =====
    bins = {c: [] for c in CLASS_NAMES}
    for det in detections:
        bins[det["grade"]].append(det)

    counts = {k: len(v) for k, v in bins.items()}

    # ===== FINAL RESPONSE =====
    return {
        "batch_id": str(uuid.uuid4()),  # Generate unique batch ID
        "total_images": len(files),
        "total_peppers": len(detections),
        "counts": counts,
        "category_counts": counts,  # optional alias
        "bins": bins,
        "image_width": first_image_width,
        "image_height": first_image_height
    }