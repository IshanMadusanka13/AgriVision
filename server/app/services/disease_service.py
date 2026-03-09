import numpy as np
import cv2
import io
import base64
from datetime import datetime
from PIL import Image
from collections import Counter
from typing import Optional, Dict, List
from uuid import uuid4
from tensorflow.keras.applications.efficientnet import preprocess_input

from configs.model_loader import leaf_model, disease_classifier, unet_model, CLASS_NAMES
from configs.supabase_client import get_supabase_client


# =============================================================
# CONFIGURATION
# =============================================================

CONF_THRESHOLD      = 0.4
UNET_IMG_SIZE       = 256
DISEASE_THRESHOLD   = 0.25          # U-Net pixel probability threshold

# Only these classes get severity analysis
SEVERITY_CLASSES    = {"bacterial_spot", "cercospora"}


# =============================================================
# HELPERS
# =============================================================

def _severity_label(percent: float) -> str:
    """Convert U-Net severity percentage to a human-readable label."""
    if percent <= 5:
        return "Low"
    elif percent <= 25:
        return "Moderate"
    elif percent <= 50:
        return "High"
    else:
        return "Severe"


def _run_unet_severity(leaf_bgr: np.ndarray, unet) -> str:
    """
    Run U-Net on a single cropped leaf (BGR numpy array).
    Returns a severity label string, or None if something goes wrong.
    """
    oh, ow = leaf_bgr.shape[:2]

    # ── Preprocess ────────────────────────────────────────────
    inp = cv2.cvtColor(leaf_bgr, cv2.COLOR_BGR2RGB)
    inp = cv2.resize(inp, (UNET_IMG_SIZE, UNET_IMG_SIZE))
    inp = inp / 255.0
    inp = np.expand_dims(inp, axis=0)

    # ── Predict ───────────────────────────────────────────────
    prediction   = unet.predict(inp, verbose=0)[0]          # (H, W, C)
    pred_mask    = np.argmax(prediction, axis=-1)
    leaf_mask    = (pred_mask == 2)
    disease_prob = prediction[:, :, 1]
    disease_mask = disease_prob > DISEASE_THRESHOLD

    # ── Restrict disease to (dilated) leaf region ─────────────
    k_small      = np.ones((3, 3), np.uint8)
    leaf_dilated = cv2.dilate(leaf_mask.astype(np.uint8),
                              k_small, iterations=1).astype(bool)
    disease_in_leaf = disease_mask & leaf_dilated

    # ── Resize masks back to original crop size ───────────────
    leaf_mask_orig = cv2.resize(
        (leaf_mask.astype(np.uint8) * 255),
        (ow, oh), interpolation=cv2.INTER_NEAREST)

    disease_mask_orig = cv2.resize(
        (disease_in_leaf.astype(np.uint8) * 255),
        (ow, oh), interpolation=cv2.INTER_NEAREST)

    # ── Morphological filling ─────────────────────────────────
    # Scale kernel to image size (~3% of shorter dimension, min 9)
    k           = max(9, int(min(oh, ow) * 0.03))
    kernel_fill = np.ones((k, k), np.uint8)

    # Step 1: close gaps between nearby disease pixels
    filled = cv2.morphologyEx(disease_mask_orig, cv2.MORPH_CLOSE, kernel_fill)
    # Step 2: dilate to grow blobs outward
    filled = cv2.dilate(filled, kernel_fill, iterations=2)

    # Step 3: flood-fill holes so the interior of each blob is solid
    filled_holes = filled.copy()
    flood_mask   = np.zeros((oh + 2, ow + 2), np.uint8)
    cv2.floodFill(filled_holes, flood_mask, (0, 0), 255)
    holes  = cv2.bitwise_not(filled_holes)
    filled = cv2.bitwise_or(filled, holes)

    # Step 4: restrict back to leaf area
    filled = cv2.bitwise_and(filled, leaf_mask_orig)

    # ── Severity % ────────────────────────────────────────────
    leaf_px    = int(np.sum(leaf_mask_orig > 0))
    disease_px = int(np.sum(filled        > 0))
    percent    = (disease_px / leaf_px * 100) if leaf_px > 0 else 0.0

    return _severity_label(percent)


# =============================================================
# SERVICE
# =============================================================

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

    # ==========================================================
    # DISEASE MANAGEMENT FUNCTIONS
    # ==========================================================

    def get_all_diseases(self) -> List[Dict]:
        try:
            response = (
                self.supabase.table("disease_info")
                .select("*")
                .order("disease_name")
                .execute()
            )

            if response.data:
                for disease in response.data:
                    self._disease_cache[disease["disease_name"]] = disease
                return response.data

            return []

        except Exception as e:
            print(f"Error fetching all diseases: {e}")
            return []

    def update_disease(self, disease_id: str, update_data: Dict) -> Optional[Dict]:
        try:
            if "disease_name" in update_data:
                raise ValueError("Disease name cannot be updated")

            if "severity_level" in update_data:
                valid_severities = ["High", "Moderate", "Low", "None"]
                if update_data["severity_level"] not in valid_severities:
                    raise ValueError(f"Severity level must be one of: {valid_severities}")

            update_data["updated_at"] = datetime.now().isoformat()

            response = (
                self.supabase.table("disease_info")
                .update(update_data)
                .eq("id", disease_id)
                .execute()
            )

            if response.data and len(response.data) > 0:
                updated_disease = response.data[0]
                disease_name = updated_disease["disease_name"]
                self._disease_cache[disease_name] = updated_disease
                return updated_disease

            return None

        except ValueError as ve:
            print(f"Validation error updating disease: {ve}")
            raise
        except Exception as e:
            print(f"Error updating disease: {e}")
            return None

    def upload_image_to_storage(self, image: Image.Image, user_id: str) -> Optional[str]:
        try:
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format="PNG")
            img_byte_arr.seek(0)

            file_name = f"{user_id}/detections/{uuid4()}.png"

            self.supabase.storage.from_("plant-images").upload(
                file_name,
                img_byte_arr.getvalue(),
                {"content-type": "image/png"},
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
        status: str,
    ) -> Optional[str]:
        try:
            detection_data = {
                "user_id"            : user_id,
                "annotated_image_url": annotated_image_url,
                "total_detections"   : total_detections,
                "detections"         : detections,
                "disease_summary"    : disease_summary,
                "conclusion"         : conclusion,
                "recommendations"    : recommendations,
                "status"             : status,
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
    # Scan For Diseases
    # ==========================================================

    def disease_scan(
        self,
        user_id: str,
        image: Image.Image,
        save_to_db: bool = False,
    ) -> Dict:

        img_array = np.array(image)
        img_bgr   = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

        # 1️⃣ Detect leaves using YOLO
        results = leaf_model.predict(
            source=image,
            imgsz=640,
            conf=CONF_THRESHOLD,
        )

        boxes = results[0].boxes

        if boxes is None or len(boxes) == 0:
            result = {
                "status"      : "no_leaf_detected",
                "total_leaves": 0,
                "leaves"      : [],
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
                    status="no_leaf_detected",
                )

            return result

        leaves_output  = []
        disease_counts = Counter()
        recommendations = {}

        # 2️⃣ Process each detected leaf
        for i, box in enumerate(boxes):
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            leaf_crop = img_bgr[y1:y2, x1:x2]
            if leaf_crop.size == 0:
                continue

            # 3️⃣ EfficientNet classification
            leaf_rgb     = cv2.cvtColor(leaf_crop, cv2.COLOR_BGR2RGB)
            leaf_resized = cv2.resize(leaf_rgb, (224, 224))
            leaf_input   = np.expand_dims(leaf_resized.astype(np.float32), axis=0)
            leaf_input   = preprocess_input(leaf_input)

            predictions  = disease_classifier.predict(leaf_input, verbose=0)[0]
            class_index  = np.argmax(predictions)
            confidence   = float(predictions[class_index])
            disease_name = CLASS_NAMES[class_index]

            disease_counts[disease_name] += 1

            # 4️⃣ U-Net severity — only for bacterial_spot & cercospora
            # Resize crop to fixed 640x640 so the dynamic kernel scaling
            # stays consistent regardless of the original image resolution.
            # This prevents over-inflation of severity on high-res inputs.
            if disease_name in SEVERITY_CLASSES:
                leaf_crop_for_unet = cv2.resize(leaf_crop, (640, 640))
                severity = _run_unet_severity(leaf_crop_for_unet, unet_model)
            else:
                severity = None

            # 5️⃣ Fetch DB info & recommendations
            disease_info = self.get_disease_info(disease_name)
            if disease_info:
                recommendations[disease_name] = disease_info.get("treatments", [])

            # 6️⃣ Convert cropped leaf to base64 for FE
            leaf_pil = Image.fromarray(leaf_rgb)
            buffer   = io.BytesIO()
            leaf_pil.save(buffer, format="PNG")
            leaf_base64 = base64.b64encode(buffer.getvalue()).decode()

            leaf_entry = {
                "leaf_id"   : i + 1,
                "disease"   : disease_name,
                "confidence": round(confidence * 100, 2),
                "bbox"      : [x1, y1, x2, y2],
                "leaf_image": f"data:image/png;base64,{leaf_base64}",
            }

            # Only include severity key for supported diseases
            if severity is not None:
                leaf_entry["severity"] = severity

            leaves_output.append(leaf_entry)

        # 7️⃣ Annotated full image (bounding boxes)
        annotated = img_bgr.copy()
        for leaf in leaves_output:
            x1, y1, x2, y2 = leaf["bbox"]
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 255, 0), 2)

        annotated_rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
        annotated_pil = Image.fromarray(annotated_rgb)

        buffer = io.BytesIO()
        annotated_pil.save(buffer, format="PNG")
        img_base64 = base64.b64encode(buffer.getvalue()).decode()

        result = {
            "status"          : "success",
            "annotated_image" : f"data:image/png;base64,{img_base64}",
            "total_leaves"    : len(leaves_output),
            "leaves"          : leaves_output,
            "disease_summary" : dict(disease_counts),
            "recommendations" : recommendations,
        }

        # 8️⃣ Persist to DB if requested
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
                status="success",
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