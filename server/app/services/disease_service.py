import numpy as np
import cv2
import io
import base64
from datetime import datetime
from PIL import Image
from collections import Counter
from typing import Optional, Dict, List, Tuple
from uuid import uuid4
from configs.model_loader import disease_model
from configs.supabase_client import get_supabase_client

CONF_THRESHOLD = 0.45
RESPONSE_MESSAGES = {
    "no_leaf_detected": "No leaf detected in the image",
    "no_disease_detected": "No diseases detected",
    "multiple_diseases": "Multiple diseases detected",
    "plant_healthy": "Plant appears healthy",
    "treatment_required": "Immediate treatment recommended",
    "comprehensive_treatment": "Comprehensive treatment plan required"
}


class DiseaseService:
    """Service class for disease detection operations"""

    def __init__(self):
        self.supabase = get_supabase_client()
        self._disease_cache = {}

    def get_disease_info(self, disease_name: str) -> Optional[Dict]:
        """
        Get disease information from database with caching
        
        Args:
            disease_name: Name of the disease
            
        Returns:
            Dict: Disease information or None
        """
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

    def get_all_diseases_info(self, disease_names: List[str]) -> Dict[str, Dict]:
        """
        Bulk fetch disease information for multiple diseases
        
        Args:
            disease_names: List of disease names
            
        Returns:
            Dict: Dictionary mapping disease names to their info
        """
        diseases_info = {}
        
        uncached_diseases = [d for d in disease_names if d not in self._disease_cache]
        
        if uncached_diseases:
            try:
                response = (
                    self.supabase.table("disease_info")
                    .select("*")
                    .in_("disease_name", uncached_diseases)
                    .execute()
                )
                
                for disease_info in response.data:
                    disease_name = disease_info["disease_name"]
                    self._disease_cache[disease_name] = disease_info
            except Exception as e:
                print(f"Error fetching diseases info: {e}")
        
        for disease_name in disease_names:
            if disease_name in self._disease_cache:
                diseases_info[disease_name] = self._disease_cache[disease_name]
        
        return diseases_info

    def _get_color_for_disease(self, disease_info: Optional[Dict]) -> Tuple[int, int, int]:
        """Get BGR color tuple for disease"""
        if disease_info:
            return (disease_info["color_b"], disease_info["color_g"], disease_info["color_r"])
        return (128, 128, 128)  # Default gray

    def _get_severity_score(self, severity_level: str) -> int:
        """Convert severity level to numeric score for sorting"""
        severity_map = {
            "High": 3,
            "Moderate": 2,
            "Low": 1,
            "None": 0
        }
        return severity_map.get(severity_level, 1)

    def _generate_conclusion(self, disease_counts: Dict, all_detections: List[Dict]) -> str:
        """Generate conclusion based on detections"""
        total = sum(disease_counts.values())
        
        if total == 0:
            return f"{RESPONSE_MESSAGES['no_disease_detected']}."
        
        if len(disease_counts) == 1 and any("healthy" in d.lower() for d in disease_counts.keys()):
            return f"{RESPONSE_MESSAGES['plant_healthy']}. {total} healthy leaf area(s) detected."
        
        disease_list = [d for d in disease_counts.keys() if "healthy" not in d.lower()]
        
        if len(disease_list) == 0:
            return f"All {total} detected areas appear healthy."
        elif len(disease_list) == 1:
            disease = disease_list[0]
            count = disease_counts[disease]
            return f"Detected {count} instance(s) of {disease}. {RESPONSE_MESSAGES['treatment_required']}."
        else:
            summary = ", ".join([f"{count}x {disease}" for disease, count in disease_counts.items() 
                               if "healthy" not in disease.lower()])
            return f"{RESPONSE_MESSAGES['multiple_diseases']}: {summary}. {RESPONSE_MESSAGES['comprehensive_treatment']}."

    def _get_most_severe_detection(self, detections: List[Dict]) -> Dict:
        """Get the most severe disease detection"""
        if not detections:
            return {"disease": "Unknown", "confidence": 0, "severity": "None"}
        
        sorted_detections = sorted(
            detections,
            key=lambda x: (self._get_severity_score(x["severity"]), x["confidence"]),
            reverse=True
        )
        
        return sorted_detections[0]

    def upload_image_to_storage(self, image: Image.Image, user_id: str) -> Optional[str]:
        """
        Upload image to Supabase Storage
        
        Args:
            image: PIL Image
            user_id: User ID
            
        Returns:
            str: Public URL of uploaded image or None
        """
        try:
            img_byte_arr = io.BytesIO()
            image.save(img_byte_arr, format='PNG')
            img_byte_arr.seek(0)
            
            file_name = f"{user_id}/detections/{uuid4()}.png"
            
            response = self.supabase.storage.from_("plant-images").upload(
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
        """
        Insert disease detection record into database
        
        Args:
            user_id: User ID
            annotated_image_url: URL of annotated image
            total_detections: Total number of detections
            detections: List of detection details
            disease_summary: Summary of diseases detected
            conclusion: Analysis conclusion
            recommendations: Treatment recommendations
            status: Detection status
            
        Returns:
            str: Created detection ID or None
        """
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

    def disease_scan(
        self, 
        user_id: str, 
        image: Image.Image, 
        save_to_db: bool = False
    ) -> Dict:
        """
        Perform disease detection scan on image
        
        Args:
            user_id: User ID
            image: PIL Image
            save_to_db: Whether to save results to database
            
        Returns:
            Dict: Detection results with annotated image
        """
        results = disease_model.predict(
            source=image,
            imgsz=640,
            conf=CONF_THRESHOLD
        )

        detections_boxes = results[0].boxes

        if detections_boxes is None or len(detections_boxes) == 0:
            result = {
                "status": "no_leaf_detected",
                "annotated_image": None,
                "total_detections": 0,
                "detections": [],
                "disease_summary": {},
                "conclusion": RESPONSE_MESSAGES["no_leaf_detected"],
                "recommendations": {}
            }
            
            if save_to_db:
                self.insert_detection(
                    user_id=user_id,
                    annotated_image_url=None,
                    total_detections=0,
                    detections=[],
                    disease_summary={},
                    conclusion=RESPONSE_MESSAGES["no_leaf_detected"],
                    recommendations={},
                    status="no_leaf_detected"
                )
            
            return result

        img_array = np.array(image)
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        
        all_detections = []
        disease_counts = Counter()
        detected_disease_names = set()
        
        for box in detections_boxes:
            class_id = int(box.cls)
            confidence = float(box.conf)
            class_name = disease_model.names[class_id]
            
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            
            detected_disease_names.add(class_name)
            disease_counts[class_name] += 1
            
            detection_info = {
                "disease": class_name,
                "confidence": round(confidence * 100, 2),
                "bbox": [x1, y1, x2, y2]
            }
            all_detections.append(detection_info)
        
        diseases_info = self.get_all_diseases_info(list(detected_disease_names))
        
        for detection in all_detections:
            disease_name = detection["disease"]
            disease_info = diseases_info.get(disease_name)
            
            detection["severity"] = disease_info["severity_level"] if disease_info else "Low"
            
            bbox = detection["bbox"]
            x1, y1, x2, y2 = bbox
            color = self._get_color_for_disease(disease_info)
            
            cv2.rectangle(img_bgr, (x1, y1), (x2, y2), color, 2)
            
            label = f"{disease_name}: {detection['confidence']/100:.2f}"
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
        
        conclusion = self._generate_conclusion(disease_counts, all_detections)
        
        most_severe = self._get_most_severe_detection(all_detections)
        
        recommendations = {}
        for disease_name in detected_disease_names:
            disease_info = diseases_info.get(disease_name)
            if disease_info:
                recommendations[disease_name] = disease_info["treatments"]
        
        img_byte_arr = io.BytesIO()
        annotated_image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        img_base64 = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
        
        result = {
            "status": "success",
            "annotated_image": f"data:image/png;base64,{img_base64}",
            "total_detections": len(all_detections),
            "detections": all_detections,
            "disease_summary": dict(disease_counts),
            "conclusion": conclusion,
            "recommendations": recommendations
        }
        
        if save_to_db:
            annotated_image_url = self.upload_image_to_storage(annotated_image, user_id)
            
            self.insert_detection(
                user_id=user_id,
                annotated_image_url=annotated_image_url,
                total_detections=len(all_detections),
                detections=all_detections,
                disease_summary=dict(disease_counts),
                conclusion=conclusion,
                recommendations=recommendations,
                status="success"
            )
        
        return result

    def get_detections_by_user(
        self, 
        user_id: str, 
        limit: int = 10, 
        offset: int = 0
    ) -> List[Dict]:
        """
        Get all disease detections for a user
        
        Args:
            user_id: User ID
            limit: Number of records to return
            offset: Offset for pagination
            
        Returns:
            List[Dict]: List of detection records
        """
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

    def get_detection_by_id(self, detection_id: str) -> Optional[Dict]:
        """
        Get a specific disease detection by ID
        
        Args:
            detection_id: Detection ID
            
        Returns:
            Dict: Detection data formatted for frontend or None
        """
        try:
            response = (
                self.supabase.table("disease_detections")
                .select("*")
                .eq("id", detection_id)
                .execute()
            )
            
            if not response.data:
                return None
            
            detection = response.data[0]
            
            annotated_image = detection["annotated_image_url"]
            if annotated_image and not annotated_image.startswith("data:"):
                # If it's a storage URL, keep it as is
                # Frontend can handle both base64 and URLs
                pass
            
            return {
                "status": detection["status"],
                "annotated_image": annotated_image,
                "total_detections": detection["total_detections"],
                "detections": detection["detections"],
                "disease_summary": detection["disease_summary"],
                "conclusion": detection["conclusion"],
                "recommendations": detection["recommendations"],
                "created_at": detection["created_at"]
            }
        except Exception as e:
            print(f"Error fetching detection by ID: {e}")
            return None

disease_service = DiseaseService()