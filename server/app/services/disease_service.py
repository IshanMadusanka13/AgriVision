import numpy as np
import cv2
import os
from datetime import datetime
from PIL import Image
from collections import Counter
from configs.model_loader import disease_model
from utils.disease_util import (
    CONF_THRESHOLD,
    get_color_for_disease,
    get_most_severe_disease,
    generate_conclusion
)

def run_inference(image: Image.Image):
    """Run inference on a single image and return annotated image with results"""
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
        
        # Annotate image
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
    
    # Generate results
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