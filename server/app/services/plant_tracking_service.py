"""
Plant Tracking Service with ArUco Marker Integration
Provides plant identification, height measurement, and growth monitoring
for Scotch Bonnet plants using ArUco markers and YOLOv8.
"""

import cv2
import cv2.aruco as aruco
import numpy as np
from ultralytics import YOLO
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import json
from pathlib import Path


class PlantTrackingService:
    """
    Service for tracking individual Scotch Bonnet plants using ArUco markers.

    Features:
    - Plant identification using ArUco marker IDs
    - Height measurement using marker as reference scale
    - Growth stage detection using YOLOv8
    - Weekly fertilizer recommendations based on stage, height, pH, and humidity
    """

    def __init__(
        self,
        yolo_model_path: Optional[str] = None,
        aruco_marker_size_cm: float = 5.0,
        aruco_dict_type: int = cv2.aruco.DICT_ARUCO_ORIGINAL
    ):
        """
        Initialize the plant tracking service.

        Args:
            yolo_model_path: Path to the YOLOv8 model trained for leaf/flower/fruit detection (optional for marker-only detection)
            aruco_marker_size_cm: Physical size of the ArUco marker in centimeters
            aruco_dict_type: ArUco dictionary type (default: 4x4_50)
        """
        # Load YOLO model for growth detection (only if path provided)
        self.yolo_model = YOLO(yolo_model_path) if yolo_model_path else None

        # ArUco marker configuration
        self.marker_size_cm = aruco_marker_size_cm
        self.aruco_dict = aruco.getPredefinedDictionary(aruco_dict_type)
        self.aruco_params = aruco.DetectorParameters()
        self.aruco_detector = aruco.ArucoDetector(self.aruco_dict, self.aruco_params)

        # Growth stage classification thresholds
        self.growth_stages = {
            'Early Vegetative Stage': {'leaves': (1, 10), 'flowers': 0, 'fruits': 0},
            'Vegetative Stage': {'leaves': (11, float('inf')), 'flowers': 0, 'fruits': 0},
            'Flowering Stage': {'flowers': (1, float('inf')), 'fruits': 0},
            'Fruiting Stage': {'fruits': (1, float('inf')), 'ripening': 0},
            'Ripening/Harvesting Stage': {'ripening': (1, float('inf'))}
        }

    def detect_aruco_marker(self, image: np.ndarray) -> Optional[Dict]:
        """
        Detect ArUco marker in the image and extract plant ID and position.

        Args:
            image: Input image (BGR format)

        Returns:
            Dictionary with marker info or None if no marker detected:
            {
                'plant_id': int,
                'corners': np.ndarray,
                'center': tuple,
                'bottom_center': tuple,
                'pixel_size': float
            }
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        corners, ids, rejected = self.aruco_detector.detectMarkers(gray)

        if ids is None or len(ids) == 0:
            return None

        # Use the first detected marker
        marker_id = int(ids[0][0])
        marker_corners = corners[0][0]

        # Calculate marker center
        center_x = int(np.mean(marker_corners[:, 0]))
        center_y = int(np.mean(marker_corners[:, 1]))

        # Calculate bottom center
        bottom_corners = marker_corners[np.argmax(marker_corners[:, 1])]
        bottom_neighbor = marker_corners[np.argsort(marker_corners[:, 1])[-2]]
        bottom_center_x = int((bottom_corners[0] + bottom_neighbor[0]) / 2)
        bottom_center_y = int((bottom_corners[1] + bottom_neighbor[1]) / 2)

        # Calculate top center (used as height reference)
        top_corners = marker_corners[np.argmin(marker_corners[:, 1])]
        top_neighbor = marker_corners[np.argsort(marker_corners[:, 1])[1]]
        top_center_x = int((top_corners[0] + top_neighbor[0]) / 2)
        top_center_y = int((top_corners[1] + top_neighbor[1]) / 2)

        # Y-component only of vertical edges — removes horizontal tilt error.
        # np.linalg.norm gives diagonal length (includes dx), abs(dy) gives true
        # vertical pixel span which directly maps to real-world height.
        left_v_y  = abs(float(marker_corners[0][1]) - float(marker_corners[3][1]))
        right_v_y = abs(float(marker_corners[1][1]) - float(marker_corners[2][1]))
        marker_pixel_size = (left_v_y + right_v_y) / 2

        return {
            'plant_id': marker_id,
            'corners': marker_corners,
            'center': (center_x, center_y),
            'bottom_center': (bottom_center_x, bottom_center_y),
            'top_center': (top_center_x, top_center_y),
            'pixel_size': marker_pixel_size
        }

    def detect_plant_parts(self, image: np.ndarray, conf_threshold: float = 0.45) -> Dict:
        """
        Run YOLOv8 inference to detect plant parts (leaves, flowers, fruits).

        Args:
            image: Input image (BGR format)
            conf_threshold: Confidence threshold for detections

        Returns:
            Dictionary with detection results:
            {
                'detections': List[Dict],
                'counts': Dict,
                'highest_leaf_point': tuple or None
            }
        """
        if self.yolo_model is None:
            raise ValueError("YOLO model not loaded. Please provide yolo_model_path during initialization.")

        results = self.yolo_model.predict(image, conf=conf_threshold, verbose=False)

        detections = []
        counts = {'leaf': 0, 'flower': 0, 'fruit': 0, 'ripening': 0}
        highest_leaf_point = None
        min_y = float('inf')

        for result in results:
            boxes = result.boxes
            for box in boxes:
                # Extract box information
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                confidence = float(box.conf[0])
                class_id = int(box.cls[0])
                class_name = result.names[class_id].lower()

                detection = {
                    'class': class_name,
                    'confidence': confidence,
                    'bbox': [int(x1), int(y1), int(x2), int(y2)],
                    'center': (int((x1 + x2) / 2), int((y1 + y2) / 2))
                }
                detections.append(detection)

                # Count detections
                if class_name in counts:
                    counts[class_name] += 1

                # Track highest leaf point (minimum Y coordinate)
                if class_name == 'leaf':
                    if y1 < min_y:
                        min_y = y1
                        highest_leaf_point = (int((x1 + x2) / 2), int(y1))

        return {
            'detections': detections,
            'counts': counts,
            'highest_leaf_point': highest_leaf_point
        }

    def calculate_plant_height(
        self,
        marker_info: Dict,
        highest_point: Optional[Tuple[int, int]]
    ) -> Optional[float]:
        """
        Calculate plant height in centimeters using ArUco marker as reference.

        Args:
            marker_info: Dictionary from detect_aruco_marker()
            highest_point: (x, y) coordinates of the highest plant point

        Returns:
            Height in centimeters or None if calculation not possible
        """
        if highest_point is None:
            return None

        # Calculate pixel-to-cm ratio
        pixels_per_cm = marker_info['pixel_size'] / self.marker_size_cm

        # Calculate vertical distance from marker bottom to highest point
        ground_level_y = marker_info['bottom_center'][1]
        top_point_y = highest_point[1]

        # Height in pixels (Y-axis is inverted in images)
        height_pixels = ground_level_y - top_point_y

        # Convert to centimeters
        height_cm = height_pixels / pixels_per_cm

        return max(0, height_cm)  # Ensure non-negative

    def classify_growth_stage(self, counts: Dict) -> Tuple[str, float]:
        """
        Classify growth stage based on detected plant parts.

        Args:
            counts: Dictionary with counts of each plant part

        Returns:
            Tuple of (stage_name, confidence)
        """
        # Ripening/Harvesting Stage
        if counts['ripening'] > 0:
            return 'Ripening/Harvesting Stage', 0.95

        # Fruiting Stage
        if counts['fruit'] > 0 and counts['ripening'] == 0:
            return 'Fruiting Stage', 0.90

        # Flowering Stage
        if counts['flower'] > 0 and counts['fruit'] == 0:
            return 'Flowering Stage', 0.85

        # Vegetative Stages
        if counts['leaf'] >= 11:
            return 'Vegetative Stage', 0.80
        elif counts['leaf'] >= 1:
            return 'Early Vegetative Stage', 0.75

        # No detections
        return 'Unknown', 0.0

    def generate_fertilizer_recommendation(
        self,
        growth_stage: str,
        height_cm: Optional[float],
        soil_ph: float,
        humidity: float
    ) -> Dict:
        """
        Generate weekly fertilizer recommendations based on growth stage, height, pH, and humidity.

        Args:
            growth_stage: Current growth stage
            height_cm: Plant height in centimeters
            soil_ph: Soil pH level
            humidity: Environmental humidity percentage

        Returns:
            Dictionary with fertilizer plan and recommendations
        """
        # Optimal pH range for Scotch Bonnet
        optimal_ph_min = 6.0
        optimal_ph_max = 6.8

        # Base fertilizer recommendations by growth stage
        stage_fertilizers = {
            'Early Vegetative Stage': {
                'primary': 'High Nitrogen (N) fertilizer',
                'ratio': '3-1-2 (N-P-K)',
                'frequency': '2 times per week',
                'examples': ['Urea', 'Ammonium Sulfate', 'Fish Emulsion']
            },
            'Vegetative Stage': {
                'primary': 'Balanced fertilizer with emphasis on Nitrogen',
                'ratio': '3-1-2 (N-P-K)',
                'frequency': '2-3 times per week',
                'examples': ['20-10-10', 'Compost Tea', 'Seaweed Extract']
            },
            'Flowering Stage': {
                'primary': 'Balanced fertilizer transitioning to higher Phosphorus',
                'ratio': '2-3-2 (N-P-K)',
                'frequency': '2 times per week',
                'examples': ['15-15-15', 'Bone Meal', 'Rock Phosphate']
            },
            'Fruiting Stage': {
                'primary': 'High Potassium (K) fertilizer with moderate Phosphorus',
                'ratio': '1-2-3 (N-P-K)',
                'frequency': '2 times per week',
                'examples': ['5-10-15', 'Kelp Meal', 'Wood Ash']
            },
            'Ripening/Harvesting Stage': {
                'primary': 'High Potassium (K) fertilizer',
                'ratio': '1-1-3 (N-P-K)',
                'frequency': '1-2 times per week',
                'examples': ['Potassium Sulfate', 'Langbeinite', 'Greensand']
            }
        }

        base_plan = stage_fertilizers.get(growth_stage, stage_fertilizers['Vegetative Stage'])

        # Weekly schedule
        weekly_schedule = []

        # Determine application days based on stage
        if growth_stage in ['Early Vegetative Stage', 'Vegetative Stage']:
            application_days = ['Monday', 'Thursday']
        elif growth_stage == 'Flowering Stage':
            application_days = ['Monday', 'Thursday']
        elif growth_stage == 'Fruiting Stage':
            application_days = ['Tuesday', 'Friday']
        else:  # Ripening
            application_days = ['Wednesday']

        for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
            if day in application_days:
                weekly_schedule.append({
                    'day': day,
                    'fertilizer_type': base_plan['primary'],
                    'ratio': base_plan['ratio'],
                    'method': 'Dilute and apply to soil around base',
                    'watering': 'Water lightly after application'
                })
            else:
                weekly_schedule.append({
                    'day': day,
                    'fertilizer_type': 'None',
                    'method': 'Monitor plant health',
                    'watering': 'Water as needed'
                })

        # Generate warnings and recommendations
        warnings = []
        recommendations = []

        # pH-based recommendations
        if soil_ph < optimal_ph_min:
            warnings.append(f"⚠️ Soil pH is too low ({soil_ph:.1f}). Optimal range: {optimal_ph_min}-{optimal_ph_max}")
            recommendations.append("Add lime or wood ash to raise pH gradually")
        elif soil_ph > optimal_ph_max:
            warnings.append(f"⚠️ Soil pH is too high ({soil_ph:.1f}). Optimal range: {optimal_ph_min}-{optimal_ph_max}")
            recommendations.append("Add sulfur or peat moss to lower pH gradually")
        else:
            recommendations.append(f"✓ Soil pH is optimal ({soil_ph:.1f})")

        # Humidity-based recommendations
        if humidity > 80:
            warnings.append(f"⚠️ High humidity ({humidity}%) increases disease risk")
            recommendations.append("Ensure good air circulation to prevent fungal diseases")
            recommendations.append("Reduce watering frequency in high humidity")
        elif humidity < 40:
            warnings.append(f"⚠️ Low humidity ({humidity}%) may stress plants")
            recommendations.append("Consider misting leaves in early morning")
            recommendations.append("Mulch around base to retain moisture")
        else:
            recommendations.append(f"✓ Humidity level is good ({humidity}%)")

        # Height-based recommendations
        if height_cm is not None:
            if growth_stage == 'Early Vegetative Stage' and height_cm < 10:
                recommendations.append("Plant is in early growth. Focus on root development.")
            elif growth_stage == 'Vegetative Stage' and height_cm < 20:
                recommendations.append("Plant growth is slower than expected. Check soil nutrients and water.")
            elif height_cm > 60:
                recommendations.append("Consider pruning to encourage bushier growth and better fruit production")

        # General stage-specific tips
        stage_tips = {
            'Early Vegetative Stage': [
                'Focus on establishing strong root system',
                'Avoid over-fertilizing young plants',
                'Ensure consistent moisture levels'
            ],
            'Vegetative Stage': [
                'Promote leaf and stem growth',
                'Pinch growing tips to encourage branching',
                'Monitor for early signs of pests'
            ],
            'Flowering Stage': [
                'Reduce nitrogen to promote flowering',
                'Ensure adequate phosphorus for flower development',
                'Maintain consistent watering to prevent flower drop'
            ],
            'Fruiting Stage': [
                'Increase potassium for fruit development',
                'Support heavy branches to prevent breakage',
                'Monitor for fruit pests and diseases'
            ],
            'Ripening/Harvesting Stage': [
                'Reduce fertilizer as fruits ripen',
                'Harvest regularly to encourage continued production',
                'Watch for signs of over-ripening'
            ]
        }

        recommendations.extend(stage_tips.get(growth_stage, []))

        return {
            'fertilizer_plan': {
                'growth_stage': growth_stage,
                'base_fertilizer': base_plan['primary'],
                'npk_ratio': base_plan['ratio'],
                'frequency': base_plan['frequency'],
                'examples': base_plan['examples'],
                'weekly_schedule': weekly_schedule
            },
            'environmental_parameters': {
                'soil_ph': soil_ph,
                'humidity': humidity,
                'plant_height_cm': height_cm
            },
            'warnings': warnings,
            'recommendations': recommendations
        }

    def process_plant_monitoring(
        self,
        image: np.ndarray,
        soil_ph: float,
        humidity: float,
        annotate: bool = True
    ) -> Dict:
        """
        Complete plant monitoring workflow: detect marker, measure height,
        classify growth stage, and generate recommendations.

        Args:
            image: Input image (BGR format)
            soil_ph: Soil pH level
            humidity: Environmental humidity percentage
            annotate: Whether to return annotated image

        Returns:
            Comprehensive dictionary with all monitoring data
        """
        result = {
            'timestamp': datetime.now().isoformat(),
            'success': False,
            'error': None
        }

        # Step 1: Detect ArUco marker
        marker_info = self.detect_aruco_marker(image)
        if marker_info is None:
            result['error'] = 'No ArUco marker detected. Please ensure marker is visible at soil level.'
            return result

        result['plant_id'] = marker_info['plant_id']

        # Step 2: Detect plant parts with YOLO
        yolo_results = self.detect_plant_parts(image)
        result['detections'] = yolo_results['detections']
        result['detection_counts'] = yolo_results['counts']

        # Step 3: Calculate plant height
        height_cm = self.calculate_plant_height(marker_info, yolo_results['highest_leaf_point'])
        result['plant_height_cm'] = round(height_cm, 2) if height_cm else None

        # Step 4: Classify growth stage
        growth_stage, confidence = self.classify_growth_stage(yolo_results['counts'])
        result['growth_stage'] = growth_stage
        result['growth_stage_confidence'] = confidence

        # Step 5: Generate fertilizer recommendations
        fertilizer_data = self.generate_fertilizer_recommendation(
            growth_stage, height_cm, soil_ph, humidity
        )
        result['fertilizer_recommendation'] = fertilizer_data

        # Step 6: Create annotated image
        if annotate:
            annotated_image = self._annotate_image(
                image.copy(),
                marker_info,
                yolo_results,
                height_cm,
                growth_stage
            )
            result['annotated_image'] = annotated_image

        result['success'] = True
        return result

    def _annotate_image(
        self,
        image: np.ndarray,
        marker_info: Dict,
        yolo_results: Dict,
        height_cm: Optional[float],
        growth_stage: str
    ) -> np.ndarray:
        """
        Annotate image with detections, measurements, and information.

        Args:
            image: Input image
            marker_info: ArUco marker information
            yolo_results: YOLO detection results
            height_cm: Calculated height
            growth_stage: Classified growth stage

        Returns:
            Annotated image
        """
        img = image.copy()

        # Draw ArUco marker
        corners = marker_info['corners'].astype(int)
        cv2.polylines(img, [corners], True, (0, 255, 0), 3)
        cv2.putText(
            img,
            f"Plant ID: {marker_info['plant_id']}",
            (corners[0][0], corners[0][1] - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )

        # Draw ground level line
        bottom_center = marker_info['bottom_center']
        cv2.circle(img, bottom_center, 5, (0, 0, 255), -1)
        cv2.line(img, (0, bottom_center[1]), (img.shape[1], bottom_center[1]), (0, 0, 255), 2)

        # Draw YOLO detections
        colors = {
            'leaf': (0, 255, 0),      # Green
            'flower': (255, 255, 0),   # Yellow
            'fruit': (255, 165, 0),    # Orange
            'ripening': (0, 0, 255)    # Red
        }

        for detection in yolo_results['detections']:
            x1, y1, x2, y2 = detection['bbox']
            class_name = detection['class']
            confidence = detection['confidence']
            color = colors.get(class_name, (255, 255, 255))

            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
            label = f"{class_name}: {confidence:.2f}"
            cv2.putText(
                img,
                label,
                (x1, y1 - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5,
                color,
                2
            )

        # Draw height measurement
        if yolo_results['highest_leaf_point'] and height_cm:
            top_point = yolo_results['highest_leaf_point']

            # Draw vertical line
            cv2.line(img, bottom_center, top_point, (255, 0, 255), 2)

            # Draw top point
            cv2.circle(img, top_point, 5, (255, 0, 255), -1)

            # Add height label
            mid_y = (bottom_center[1] + top_point[1]) // 2
            cv2.putText(
                img,
                f"Height: {height_cm:.1f} cm",
                (bottom_center[0] + 10, mid_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                (255, 0, 255),
                2
            )

        # Add growth stage label at top
        cv2.putText(
            img,
            f"Stage: {growth_stage}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            (255, 255, 255),
            2
        )

        return img

    def create_database_log(self, monitoring_result: Dict) -> Dict:
        """
        Create a structured JSON log for database storage.

        Args:
            monitoring_result: Result from process_plant_monitoring()

        Returns:
            JSON-serializable dictionary for database insertion
        """
        if not monitoring_result['success']:
            return {
                'success': False,
                'error': monitoring_result['error']
            }

        log = {
            'plant_id': monitoring_result['plant_id'],
            'timestamp': monitoring_result['timestamp'],
            'date': datetime.fromisoformat(monitoring_result['timestamp']).strftime('%Y-%m-%d'),
            'measurements': {
                'height_cm': monitoring_result['plant_height_cm'],
                'growth_stage': monitoring_result['growth_stage'],
                'growth_stage_confidence': monitoring_result['growth_stage_confidence']
            },
            'detections': {
                'leaf_count': monitoring_result['detection_counts']['leaf'],
                'flower_count': monitoring_result['detection_counts']['flower'],
                'fruit_count': monitoring_result['detection_counts']['fruit'],
                'ripening_count': monitoring_result['detection_counts']['ripening'],
                'total_detections': len(monitoring_result['detections'])
            },
            'environmental_data': monitoring_result['fertilizer_recommendation']['environmental_parameters'],
            'fertilizer_plan': monitoring_result['fertilizer_recommendation']['fertilizer_plan'],
            'recommendations': {
                'warnings': monitoring_result['fertilizer_recommendation']['warnings'],
                'suggestions': monitoring_result['fertilizer_recommendation']['recommendations']
            }
        }

        return log

    def save_log_to_file(self, log: Dict, output_path: str = None) -> str:
        """
        Save monitoring log to JSON file.

        Args:
            log: Database log dictionary
            output_path: Optional custom output path

        Returns:
            Path to saved file
        """
        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            plant_id = log.get('plant_id', 'unknown')
            output_path = f"plant_{plant_id}_log_{timestamp}.json"

        with open(output_path, 'w') as f:
            json.dump(log, f, indent=2)

        return output_path


# Example usage function
def example_usage():
    """
    Example demonstrating how to use the PlantTrackingService.
    """
    # Initialize service
    service = PlantTrackingService(
        yolo_model_path="path/to/growth.pt",
        aruco_marker_size_cm=5.0
    )

    # Load image
    image = cv2.imread("path/to/plant_image.jpg")

    # Process plant monitoring
    result = service.process_plant_monitoring(
        image=image,
        soil_ph=6.5,
        humidity=65,
        annotate=True
    )

    if result['success']:
        # Print results
        print(f"Plant ID: {result['plant_id']}")
        print(f"Height: {result['plant_height_cm']} cm")
        print(f"Growth Stage: {result['growth_stage']}")
        print(f"\nDetection Counts:")
        for part, count in result['detection_counts'].items():
            print(f"  {part}: {count}")

        # Save annotated image
        cv2.imwrite("annotated_plant.jpg", result['annotated_image'])

        # Create and save database log
        log = service.create_database_log(result)
        log_path = service.save_log_to_file(log)
        print(f"\nLog saved to: {log_path}")

        # Print fertilizer recommendations
        print("\nFertilizer Recommendations:")
        for rec in result['fertilizer_recommendation']['recommendations']:
            print(f"  • {rec}")
    else:
        print(f"Error: {result['error']}")


if __name__ == "__main__":
    example_usage()
