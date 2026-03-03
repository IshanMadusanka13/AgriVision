import numpy as np
import cv2
import io
import base64
from datetime import datetime
from PIL import Image
from collections import Counter
from typing import Optional, Dict, List, Tuple
from uuid import uuid4
from tensorflow.keras.applications.efficientnet import preprocess_input

from configs.model_loader import leaf_model, disease_classifier, CLASS_NAMES
from configs.supabase_client import get_supabase_client


CONF_THRESHOLD = 0.4


class DiseaseService:
    def __init__(self):
        self.supabase = get_supabase_client()
        self._disease_cache = {}

    # ==========================================================
    # DATABASE HELPERS
    # ==========================================================

    def get_disease_info(self, disease_name: str) -> Optional[Dict]:
        if disease_name in self._disease_cache:
            return self._disease_cache[disease_name]

        try:
            response = (
                self.supabase.table("disease_info")
                .select("*")
                .eq("disease_name", disease_name)
                .execute()
            )

            if response.data:
                disease_info = response.data[0]
                self._disease_cache[disease_name] = disease_info
                return disease_info

            return None
        except Exception as e:
            print(f"Error fetching disease info: {e}")
            return None

    def upload_image_to_storage(self, image: Image.Image, user_id: str) -> Optional[str]:
        try:
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)

            file_name = f"{user_id}/detections/{uuid4()}.png"

            self.supabase.storage.from_("plant-images").upload(
                file_name,
                img_byte_arr.getvalue(),
                {"content-type": "image/png"}
            )

            public_url = self.supabase.storage.from_("plant-images").get_public_url(file_name)
            return public_url

        except Exception as e:
            print(f"Error uploading image: {e}")
            return None

    def insert_detection(
        self,
        user_id: str,
        annotated_image_url: Optional[str],
        total_detections: int,
        detections: List[Dict],
        disease_summary: Dict,
        conclusion: str,
        recommendations: Dict,
        status: str
    ) -> Optional[str]:

        try:
            detection_data = {
                "user_id": user_id,
                "annotated_image_url": annotated_image_url,
                "total_detections": total_detections,
                "detections": detections,
                "disease_summary": disease_summary,
                "conclusion": conclusion,
                "recommendations": recommendations,
                "status": status
            }

            response = (
                self.supabase.table("disease_detections")
                .insert(detection_data)
                .execute()
            )

            return response.data[0]["id"] if response.data else None

        except Exception as e:
            print(f"Error inserting detection: {e}")
            return None

    # ==========================================================
    # MAIN PIPELINE
    # ==========================================================

    def disease_scan(
        self,
        user_id: str,
        image: Image.Image,
        save_to_db: bool = False
    ) -> Dict:

        img_array = np.array(image)
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        # 1️⃣ Detect leaves using YOLO
        results = leaf_model.predict(
            source=image,
            imgsz=640,
            conf=CONF_THRESHOLD
        )

        boxes = results[0].boxes

        if boxes is None or len(boxes) == 0:
            result = {
                "status": "no_leaf_detected",
                "total_leaves": 0,
                "leaves": []
            }

            if save_to_db:
                self.insert_detection(
                    user_id=user_id,
                    annotated_image_url=None,
                    total_detections=0,
                    detections=[],
                    disease_summary={},
                    conclusion="No leaf detected",
                    recommendations={},
                    status="no_leaf_detected"
                )

            return result

        leaves_output = []
        disease_counts = Counter()
        recommendations = {}

        # 2️⃣ Process each leaf
        for i, box in enumerate(boxes):

            x1, y1, x2, y2 = map(int, box.xyxy[0])

            leaf_crop = img_bgr[y1:y2, x1:x2]
            if leaf_crop.size == 0:
                continue

            # 3️⃣ EfficientNet classification
            leaf_rgb = cv2.cvtColor(leaf_crop, cv2.COLOR_BGR2RGB)
            leaf_resized = cv2.resize(leaf_rgb, (224, 224))
            leaf_input = np.expand_dims(leaf_resized.astype(np.float32), axis=0)
            leaf_input = preprocess_input(leaf_input)

            predictions = disease_classifier.predict(leaf_input, verbose=0)[0]
            class_index = np.argmax(predictions)
            confidence = float(predictions[class_index])
            disease_name = CLASS_NAMES[class_index]

            # Hardcoded severity (for now)
            severity = "Moderate"

            disease_counts[disease_name] += 1

            # Fetch DB info
            disease_info = self.get_disease_info(disease_name)
            if disease_info:
                recommendations[disease_name] = disease_info.get("treatments", [])

            # Convert leaf image to base64
            leaf_pil = Image.fromarray(leaf_rgb)
            buffer = io.BytesIO()
            leaf_pil.save(buffer, format="PNG")
            leaf_base64 = base64.b64encode(buffer.getvalue()).decode()

            leaves_output.append({
                "leaf_id": i + 1,
                "disease": disease_name,
                "confidence": round(confidence * 100, 2),
                "severity": severity,
                "bbox": [x1, y1, x2, y2],
                "leaf_image": f"data:image/png;base64,{leaf_base64}"
            })

        # 4️⃣ Create annotated full image (bounding boxes only)
        annotated = img_bgr.copy()
        for leaf in leaves_output:
            x1, y1, x2, y2 = leaf["bbox"]
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)

        annotated_rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
        annotated_pil = Image.fromarray(annotated_rgb)

        # Convert annotated image to base64
        buffer = io.BytesIO()
        annotated_pil.save(buffer, format="PNG")
        img_base64 = base64.b64encode(buffer.getvalue()).decode()

        result = {
            "status": "success",
            "annotated_image": f"data:image/png;base64,{img_base64}",
            "total_leaves": len(leaves_output),
            "leaves": leaves_output,
            "disease_summary": dict(disease_counts),
            "recommendations": recommendations
        }

        # 5️⃣ Save to DB if required
        if save_to_db:
            annotated_url = self.upload_image_to_storage(annotated_pil, user_id)

            self.insert_detection(
                user_id=user_id,
                annotated_image_url=annotated_url,
                total_detections=len(leaves_output),
                detections=leaves_output,
                disease_summary=dict(disease_counts),
                conclusion="Scan completed",
                recommendations=recommendations,
                status="success"
            )

        return result

    # ==========================================================
    # HISTORY ENDPOINTS
    # ==========================================================

    def get_detections_by_user(self, user_id: str, limit: int = 10, offset: int = 0):
        try:
            response = (
                self.supabase.table("disease_detections")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
            return response.data
        except Exception as e:
            print(f"Error fetching user detections: {e}")
            return []

    def get_detection_by_id(self, detection_id: str):
        try:
            response = (
                self.supabase.table("disease_detections")
                .select("*")
                .eq("id", detection_id)
                .execute()
            )

            if not response.data:
                return None

            return response.data[0]

        except Exception as e:
            print(f"Error fetching detection by ID: {e}")
            return None


disease_service = DiseaseService()