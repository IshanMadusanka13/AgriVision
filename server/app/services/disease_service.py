import numpy as np
import cv2
from io import BytesIO
import os
from datetime import datetime
from PIL import Image
from configs.model_loader import disease_model
from PIL import Image

CONF_THRESHOLD = 0.15

def run_inference(image: Image.Image):
    results = disease_model.predict(
        source=image,
        imgsz=640,
        conf=CONF_THRESHOLD
    )

    detections = results[0].boxes

    if detections is None or len(detections) == 0:
        return None, {
            "status": "no_leaf_detected"
        }

    best_box = max(detections, key=lambda x: float(x.conf))
    class_id = int(best_box.cls)
    confidence = float(best_box.conf)
    class_name = disease_model.names[class_id]

    img_array = np.array(image)
    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    
    x1, y1, x2, y2 = map(int, best_box.xyxy[0])
    
    cv2.rectangle(img_bgr, (x1, y1), (x2, y2), (0, 255, 0), 2)
    
    label = f"{class_name}: {confidence:.2f}"
    (text_width, text_height), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    cv2.rectangle(img_bgr, (x1, y1 - text_height - 10), (x1 + text_width, y1), (0, 255, 0), -1)
    cv2.putText(img_bgr, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)
    
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    annotated_image = Image.fromarray(img_rgb)

    return annotated_image, {
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
