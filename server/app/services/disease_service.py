import numpy as np
import cv2
from io import BytesIO
import os
from datetime import datetime
from PIL import Image
from configs.model_loader import disease_model
from collections import Counter

CONF_THRESHOLD = 0.45

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

    img_array = np.array(image)
    img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    
    all_detections = []
    disease_counts = Counter()
    
    for box in detections:
        class_id = int(box.cls)
        confidence = float(box.conf)
        class_name = disease_model.names[class_id]
        
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        
        detection_info = {
            "disease": class_name,
            "confidence": round(confidence * 100, 2),
            "bbox": [x1, y1, x2, y2]
        }
        all_detections.append(detection_info)
        
        disease_counts[class_name] += 1
        
        color = get_color_for_disease(class_name)
        cv2.rectangle(img_bgr, (x1, y1), (x2, y2), color, 2)
        
        label = f"{class_name}: {confidence:.2f}"
        (text_width, text_height), baseline = cv2.getTextSize(
            label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2
        )
        cv2.rectangle(
            img_bgr, 
            (x1, y1 - text_height - 10), 
            (x1 + text_width, y1), 
            color, 
            -1
        )
        cv2.putText(
            img_bgr, 
            label, 
            (x1, y1 - 5), 
            cv2.FONT_HERSHEY_SIMPLEX, 
            0.5, 
            (255, 255, 255), 
            2
        )
    
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    annotated_image = Image.fromarray(img_rgb)
    
    conclusion = generate_conclusion(disease_counts, all_detections)
    
    most_severe = get_most_severe_disease(all_detections)
    
    return annotated_image, {
        "status": "success",
        "total_detections": len(all_detections),
        "detections": all_detections,
        "disease_summary": dict(disease_counts),
        "primary_disease": most_severe["disease"],
        "primary_confidence": most_severe["confidence"],
        "conclusion": conclusion
    }


def get_color_for_disease(disease_name: str):
    """Assign colors based on disease type"""
    disease_lower = disease_name.lower()
    
    if "healthy" in disease_lower:
        return (0, 255, 0)  # Green
    elif "bacterial" in disease_lower:
        return (0, 0, 255)  # Red
    elif "cercospora" in disease_lower:
        return (255, 0, 0)  # Blue
    elif "powdery" in disease_lower:
        return (0, 165, 255)  # Orange
    elif "leaf_curl" in disease_lower or "curl" in disease_lower:
        return (255, 0, 255)  # Magenta
    else:
        return (128, 128, 128)  # Gray


def get_disease_severity_score(disease_name: str) -> int:
    """Return severity score for prioritization"""
    disease_lower = disease_name.lower()
    
    if "bacterial" in disease_lower or "cercospora" in disease_lower:
        return 3  # High
    elif "curl" in disease_lower or "powdery" in disease_lower:
        return 2  # Moderate
    elif "healthy" in disease_lower:
        return 0  # None
    else:
        return 1  # Low


def get_most_severe_disease(detections: list) -> dict:
    """Get the most severe disease with highest confidence"""
    if not detections:
        return {"disease": "Unknown", "confidence": 0}
    
    # Sort by severity score first, then by confidence
    sorted_detections = sorted(
        detections,
        key=lambda x: (get_disease_severity_score(x["disease"]), x["confidence"]),
        reverse=True
    )
    
    return sorted_detections[0]


def generate_conclusion(disease_counts: Counter, all_detections: list) -> str:
    """Generate a comprehensive conclusion based on all detections"""
    total = sum(disease_counts.values())
    
    if total == 0:
        return "No diseases detected."
    
    # Check if all healthy
    if len(disease_counts) == 1 and any("healthy" in d.lower() for d in disease_counts.keys()):
        return f"Plant appears healthy. {total} healthy leaf area(s) detected."
    
    # Multiple disease types
    disease_list = [d for d in disease_counts.keys() if "healthy" not in d.lower()]
    
    if len(disease_list) == 0:
        return f"All {total} detected areas appear healthy."
    elif len(disease_list) == 1:
        disease = disease_list[0]
        count = disease_counts[disease]
        return f"Detected {count} instance(s) of {disease}. Immediate treatment recommended."
    else:
        # Multiple diseases
        summary = ", ".join([f"{count}x {disease}" for disease, count in disease_counts.items() if "healthy" not in disease.lower()])
        return f"Multiple diseases detected: {summary}. Comprehensive treatment plan required."


# -------------------testing model function ------------------------------------------

CONF_THRESHOLD_TEST = 0.55
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
            conf=CONF_THRESHOLD_TEST
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