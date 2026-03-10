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

CONF_THRESHOLD      = 0.4
UNET_IMG_SIZE       = 256
DISEASE_THRESHOLD   = 0.25

SEVERITY_CLASSES    = {"bacterial_spot", "cercospora"}

EFFNET_LOW_CONF     = 0.10
EFFNET_FALLBACK_CONF= 0.30
EFFNET_IMG_SIZE     = (260, 260) 

YOLO_CLASS_NAMES    = {0: "leaf_curl", 1: "scotch_bonnet_leaf"}


def _severity_label(percent: float, thresholds: list[dict]) -> str:
    for tier in thresholds:
        max_score = tier.get("severity_max_score")
        print(f"Checking percent {percent:.2f} against tier {tier['severity_level']} with max_score {max_score}")
        if max_score is not None and percent <= max_score:
            return tier["severity_level"]
    return thresholds[-1]["severity_level"]


def _run_unet_severity(leaf_bgr: np.ndarray, unet) -> str:
    oh, ow = leaf_bgr.shape[:2]

    inp = cv2.cvtColor(leaf_bgr, cv2.COLOR_BGR2RGB)
    inp = cv2.resize(inp, (UNET_IMG_SIZE, UNET_IMG_SIZE))
    inp = inp / 255.0
    inp = np.expand_dims(inp, axis=0)

    prediction   = unet.predict(inp, verbose=0)[0]
    pred_mask    = np.argmax(prediction, axis=-1)
    leaf_mask    = (pred_mask == 2)
    disease_prob = prediction[:, :, 1]
    disease_mask = disease_prob > DISEASE_THRESHOLD

    k_small      = np.ones((3, 3), np.uint8)
    leaf_dilated = cv2.dilate(leaf_mask.astype(np.uint8),
                              k_small, iterations=1).astype(bool)
    disease_in_leaf = disease_mask & leaf_dilated

    leaf_mask_orig = cv2.resize(
        (leaf_mask.astype(np.uint8) * 255),
        (ow, oh), interpolation=cv2.INTER_NEAREST)

    disease_mask_orig = cv2.resize(
        (disease_in_leaf.astype(np.uint8) * 255),
        (ow, oh), interpolation=cv2.INTER_NEAREST)

    k           = max(9, int(min(oh, ow) * 0.03))
    kernel_fill = np.ones((k, k), np.uint8)

    filled = cv2.morphologyEx(disease_mask_orig, cv2.MORPH_CLOSE, kernel_fill)
    filled = cv2.dilate(filled, kernel_fill, iterations=2)

    filled_holes = filled.copy()
    flood_mask   = np.zeros((oh + 2, ow + 2), np.uint8)
    cv2.floodFill(filled_holes, flood_mask, (0, 0), 255)
    holes  = cv2.bitwise_not(filled_holes)
    filled = cv2.bitwise_or(filled, holes)
    filled = cv2.bitwise_and(filled, leaf_mask_orig)

    leaf_px    = int(np.sum(leaf_mask_orig > 0))
    disease_px = int(np.sum(filled        > 0))
    percent    = (disease_px / leaf_px * 100) if leaf_px > 0 else 0.0

    return _severity_label(percent)


def _resolve_leaf_curl(
    eff_class: str,
    eff_conf: float,
    all_preds: np.ndarray,
    yolo_class: str,
) -> str:
    if eff_conf < EFFNET_LOW_CONF:
        return "uncertain"

    if eff_class == "leaf_curl":
        if yolo_class == "leaf_curl":
            return "leaf_curl"
        else:
            sorted_indices = np.argsort(all_preds)[::-1]
            for idx in sorted_indices[1:]:
                second_cls  = CLASS_NAMES[idx]
                second_conf = float(all_preds[idx])
                if second_cls != "leaf_curl":
                    return second_cls if second_conf >= EFFNET_FALLBACK_CONF else "uncertain"
            return "uncertain"

    return eff_class

class DiseaseService:
    def __init__(self):
        self.supabase = get_supabase_client()
        self._disease_cache: Dict[str, Dict] = {}
        self._severity_thresholds_cache: Dict[str, list] = {}

    @staticmethod
    def _cache_key(disease_name: str, severity_level: Optional[str] = None) -> str:
        return f"{disease_name}::{severity_level or 'ANY'}"

    def get_severity_thresholds(self, disease_name: str) -> list:

        if disease_name in self._severity_thresholds_cache:
            return self._severity_thresholds_cache[disease_name]

        try:
            response = (
                self.supabase.table("disease_info")
                .select("severity_level, severity_max_score")
                .eq("disease_name", disease_name)
                .order("severity_max_score", desc=False)
                .execute()
            )

            thresholds = response.data if response.data else []
            self._severity_thresholds_cache[disease_name] = thresholds
            return thresholds

        except Exception as e:
            print(f"Error fetching severity thresholds for {disease_name}: {e}")
            return []

    def get_disease_info(
        self,
        disease_name: str,
        severity_level: Optional[str] = None,
    ) -> Optional[Dict]:
        key = self._cache_key(disease_name, severity_level)
        if key in self._disease_cache:
            return self._disease_cache[key]

        try:
            query = (
                self.supabase.table("disease_info")
                .select("*")
                .eq("disease_name", disease_name)
            )

            if severity_level:
                query = query.eq("severity_level", severity_level)

            response = query.execute()

            if response.data:
                row = response.data[0]
                self._disease_cache[key] = row
                return row

            return None

        except Exception as e:
            print(f"Error fetching disease info: {e}")
            return None

    def get_all_diseases(self) -> List[Dict]:
        try:
            response = (
                self.supabase.table("disease_info")
                .select("*")
                .order("disease_name")
                .order("severity_max_score")
                .execute()
            )

            if response.data:
                for row in response.data:
                    key = self._cache_key(row["disease_name"], row["severity_level"])
                    self._disease_cache[key] = row
                return response.data

            return []

        except Exception as e:
            print(f"Error fetching all diseases: {e}")
            return []

    def update_disease(self, disease_id: str, update_data: Dict) -> Optional[Dict]:
        try:
            if "disease_name" in update_data:
                raise ValueError("disease_name cannot be updated.")
            if "severity_level" in update_data:
                raise ValueError(
                    "severity_level cannot be updated — it is part of the row identity. "
                    "To change severity content, target the correct row by its UUID."
                )

            if "severity_max_score" in update_data:
                invalidate_threshold_cache = True
            else:
                invalidate_threshold_cache = False

            update_data["updated_at"] = datetime.now().isoformat()

            response = (
                self.supabase.table("disease_info")
                .update(update_data)
                .eq("id", disease_id)
                .execute()
            )

            if response.data and len(response.data) > 0:
                updated = response.data[0]
                key = self._cache_key(updated["disease_name"], updated["severity_level"])
                self._disease_cache[key] = updated

                if invalidate_threshold_cache:
                    self._severity_thresholds_cache.pop(updated["disease_name"], None)

                return updated

            return None

        except ValueError as ve:
            print(f"Validation error: {ve}")
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

            return self.supabase.storage.from_("plant-images").get_public_url(file_name)

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
            response = (
                self.supabase.table("disease_detections")
                .insert({
                    "user_id"            : user_id,
                    "annotated_image_url": annotated_image_url,
                    "total_detections"   : total_detections,
                    "detections"         : detections,
                    "disease_summary"    : disease_summary,
                    "conclusion"         : conclusion,
                    "recommendations"    : recommendations,
                    "status"             : status,
                })
                .execute()
            )

            return response.data[0]["id"] if response.data else None

        except Exception as e:
            print(f"Error inserting detection: {e}")
            return None


    def disease_scan(
        self,
        user_id: str,
        image: Image.Image,
        save_to_db: bool = False,
    ) -> Dict:

        img_array = np.array(image)
        img_bgr   = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

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

        leaves_output   = []
        disease_counts  = Counter()
        recommendations = {}

        severity_thresholds_map: Dict[str, list] = {}

        for i, box in enumerate(boxes):
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            yolo_cls_id     = int(box.cls[0])
            yolo_class      = YOLO_CLASS_NAMES.get(yolo_cls_id, "unknown")

            leaf_crop = img_bgr[y1:y2, x1:x2]
            if leaf_crop.size == 0:
                continue

            leaf_rgb     = cv2.cvtColor(leaf_crop, cv2.COLOR_BGR2RGB)
            leaf_resized = cv2.resize(leaf_rgb, EFFNET_IMG_SIZE)
            leaf_input   = np.expand_dims(leaf_resized.astype(np.float32), axis=0)
            leaf_input   = preprocess_input(leaf_input)

            predictions  = disease_classifier.predict(leaf_input, verbose=0)[0]
            class_index  = int(np.argmax(predictions))
            confidence   = float(predictions[class_index])
            eff_class    = CLASS_NAMES[class_index]

            final_class = _resolve_leaf_curl(
                eff_class=eff_class,
                eff_conf=confidence,
                all_preds=predictions,
                yolo_class=yolo_class,
            )

            disease_counts[final_class] += 1

            severity: Optional[str] = None
            if final_class in SEVERITY_CLASSES:
                if final_class not in severity_thresholds_map:
                    severity_thresholds_map[final_class] = self.get_severity_thresholds(final_class)

                thresholds = severity_thresholds_map[final_class]

                if thresholds:
                    leaf_crop_for_unet = cv2.resize(leaf_crop, (640, 640))

                    oh, ow = leaf_crop_for_unet.shape[:2]
                    inp = cv2.cvtColor(leaf_crop_for_unet, cv2.COLOR_BGR2RGB)
                    inp = cv2.resize(inp, (UNET_IMG_SIZE, UNET_IMG_SIZE))
                    inp = inp / 255.0
                    inp = np.expand_dims(inp, axis=0)

                    prediction   = unet_model.predict(inp, verbose=0)[0]
                    pred_mask    = np.argmax(prediction, axis=-1)
                    leaf_mask    = (pred_mask == 2)
                    disease_prob = prediction[:, :, 1]
                    disease_mask_raw = disease_prob > DISEASE_THRESHOLD

                    k_small      = np.ones((3, 3), np.uint8)
                    leaf_dilated = cv2.dilate(leaf_mask.astype(np.uint8),
                                              k_small, iterations=1).astype(bool)
                    disease_in_leaf = disease_mask_raw & leaf_dilated

                    leaf_mask_orig = cv2.resize(
                        (leaf_mask.astype(np.uint8) * 255),
                        (ow, oh), interpolation=cv2.INTER_NEAREST)

                    disease_mask_orig = cv2.resize(
                        (disease_in_leaf.astype(np.uint8) * 255),
                        (ow, oh), interpolation=cv2.INTER_NEAREST)

                    k           = max(9, int(min(oh, ow) * 0.03))
                    kernel_fill = np.ones((k, k), np.uint8)

                    filled = cv2.morphologyEx(disease_mask_orig, cv2.MORPH_CLOSE, kernel_fill)
                    filled = cv2.dilate(filled, kernel_fill, iterations=2)

                    filled_holes = filled.copy()
                    flood_mask_arr = np.zeros((oh + 2, ow + 2), np.uint8)
                    cv2.floodFill(filled_holes, flood_mask_arr, (0, 0), 255)
                    holes  = cv2.bitwise_not(filled_holes)
                    filled = cv2.bitwise_or(filled, holes)
                    filled = cv2.bitwise_and(filled, leaf_mask_orig)

                    leaf_px    = int(np.sum(leaf_mask_orig > 0))
                    disease_px = int(np.sum(filled        > 0))
                    percent    = (disease_px / leaf_px * 100) if leaf_px > 0 else 0.0

                    severity = _severity_label(percent, thresholds)

            rec_key = (
                f"{final_class}::{severity}"
                if severity is not None
                else final_class
            )

            if rec_key not in recommendations:
                disease_info = self.get_disease_info(
                    disease_name=final_class,
                    severity_level=severity,
                )
                if disease_info:
                    recommendations[rec_key] = {
                        "disease"    : final_class,
                        "severity"   : severity,
                        "treatments" : disease_info.get("treatments", []),
                        "description": disease_info.get("description", ""),
                    }

            leaf_pil = Image.fromarray(leaf_rgb)
            buffer   = io.BytesIO()
            leaf_pil.save(buffer, format="PNG")
            leaf_base64 = base64.b64encode(buffer.getvalue()).decode()

            leaf_entry: Dict = {
                "leaf_id"   : i + 1,
                "disease"   : final_class,
                "confidence": round(confidence * 100, 2),
                "bbox"      : [x1, y1, x2, y2],
                "leaf_image": f"data:image/png;base64,{leaf_base64}",
            }

            if severity is not None:
                leaf_entry["severity"] = severity

            leaves_output.append(leaf_entry)

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

        if save_to_db:
            annotated_url = self.upload_image_to_storage(annotated_pil, user_id)

            detections_for_db = [
                {k: v for k, v in leaf.items() if k != "leaf_image"}
                for leaf in leaves_output
            ]

            self.insert_detection(
                user_id=user_id,
                annotated_image_url=annotated_url,
                total_detections=len(leaves_output),
                detections=detections_for_db,
                disease_summary=dict(disease_counts),
                conclusion="Scan completed",
                recommendations=recommendations,
                status="success",
            )

        return result

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
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error fetching detection by ID: {e}")
            return None


disease_service = DiseaseService()