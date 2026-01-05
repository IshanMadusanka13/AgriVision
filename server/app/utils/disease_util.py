CONF_THRESHOLD = 0.45
SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png"]
SUPPORTED_EXTENSIONS = (".jpg", ".jpeg", ".png")

SEVERITY_LEVELS = {
    "HIGH": "High",
    "MODERATE": "Moderate", 
    "LOW": "Low",
    "NONE": "None"
}

SEVERE_DISEASES = ["bacterial_spot", "cercospora_leaf_spot"]
MODERATE_DISEASES = ["leaf_curl", "powdery_mildew"]

DISEASE_COLORS = {
    "healthy": (0, 255, 0),        # Green
    "bacterial": (0, 0, 255),      # Red
    "cercospora": (255, 0, 0),     # Blue
    "powdery": (0, 165, 255),      # Orange
    "leaf_curl": (255, 0, 255),    # Magenta
    "curl": (255, 0, 255),         # Magenta
    "default": (128, 128, 128)     # Gray
}

TREATMENT_RECOMMENDATIONS = {
    "leaf_curl": [
        "Remove and destroy heavily infected leaves",
        "Improve plant nutrition and avoid excessive nitrogen",
        "Prune infected areas and dispose of debris",
        "Control vectors if disease is vector-transmitted",
        "Monitor nearby plants and rotate crops when possible"
    ],
    "bacterial_spot": [
        "Remove and destroy infected tissue promptly",
        "Avoid overhead irrigation and wet foliage",
        "Apply copper-based bactericides where recommended",
        "Disinfect tools and avoid handling plants when wet",
        "Start with certified disease-free seed or transplants"
    ],
    "powdery_mildew": [
        "Remove heavily infected leaves and increase airflow",
        "Apply fungicides labeled for powdery mildew (e.g., sulfur or potassium bicarbonate)",
        "Avoid excessive nitrogen fertilization",
        "Space plants to reduce humidity and improve ventilation",
        "Treat early to limit spread"
    ],
    "cercospora_leaf_spot": [
        "Remove and destroy affected leaves to lower inoculum",
        "Apply appropriate fungicides (follow label instructions)",
        "Avoid overhead watering and reduce leaf wetness duration",
        "Practice crop rotation and clear plant debris",
        "Ensure balanced fertilization to reduce susceptibility"
    ],
    "healthy": [
        "Continue current care and regular monitoring",
        "Maintain proper watering, nutrition, and ventilation",
        "Keep tools and area clean to prevent disease introduction",
        "Record observations and act quickly if symptoms appear"
    ],
    "nothing_detected": [
        "No disease detected in the submitted image",
        "Continue routine monitoring and good cultural practices"
    ],
    "default": [
        "Monitor the plant closely for changes",
        "Ensure proper watering and drainage",
        "Remove any affected plant parts if they appear",
        "Consider consulting a local agricultural extension",
        "Maintain good plant hygiene"
    ]
}

RESPONSE_MESSAGES = {
    "no_leaf_detected": "No leaf detected in the image",
    "no_disease_detected": "No diseases detected",
    "multiple_diseases": "Multiple diseases detected",
    "plant_healthy": "Plant appears healthy",
    "treatment_required": "Immediate treatment recommended",
    "comprehensive_treatment": "Comprehensive treatment plan required"
}


def get_color_for_disease(disease_name: str):
    """Assign colors based on disease type"""
    disease_lower = disease_name.lower()
    
    for key, color in DISEASE_COLORS.items():
        if key in disease_lower and key != "default":
            return color
    
    return DISEASE_COLORS["default"]


def get_disease_severity_score(disease_name: str) -> int:
    """Return severity score for prioritization (higher = more severe)"""
    disease_lower = disease_name.lower()
    
    if any(severe in disease_lower for severe in SEVERE_DISEASES):
        return 3  # High
    elif any(moderate in disease_lower for moderate in MODERATE_DISEASES):
        return 2  # Moderate
    elif "healthy" in disease_lower:
        return 0  # None
    else:
        return 1  # Low


def get_disease_severity_level(disease_name: str) -> str:
    """Determine severity level for a disease"""
    disease_lower = (disease_name or "").lower().replace(" ", "_")
    
    if any(severe in disease_lower for severe in SEVERE_DISEASES):
        return SEVERITY_LEVELS["HIGH"]
    elif any(moderate in disease_lower for moderate in MODERATE_DISEASES):
        return SEVERITY_LEVELS["MODERATE"]
    elif "healthy" in disease_lower or "nothing" in disease_lower:
        return SEVERITY_LEVELS["NONE"]
    else:
        return SEVERITY_LEVELS["LOW"]


def get_recommendations(disease_name: str) -> list:
    """Get treatment recommendations based on disease"""
    disease_lower = (disease_name or "").lower().replace(" ", "_")
    
    for key, recommendations in TREATMENT_RECOMMENDATIONS.items():
        if key in disease_lower:
            return recommendations
    
    return TREATMENT_RECOMMENDATIONS["default"]


def get_overall_severity(detections: list) -> str:
    """Determine overall severity based on all detections"""
    if not detections:
        return SEVERITY_LEVELS["NONE"]
    
    severity_scores = []
    for detection in detections:
        disease = detection["disease"]
        severity_scores.append(get_disease_severity_level(disease))
    
    # Return highest severity found
    if SEVERITY_LEVELS["HIGH"] in severity_scores:
        return SEVERITY_LEVELS["HIGH"]
    elif SEVERITY_LEVELS["MODERATE"] in severity_scores:
        return SEVERITY_LEVELS["MODERATE"]
    elif SEVERITY_LEVELS["LOW"] in severity_scores:
        return SEVERITY_LEVELS["LOW"]
    else:
        return SEVERITY_LEVELS["NONE"]


def generate_conclusion(disease_counts: dict, all_detections: list) -> str:
    """Generate a comprehensive conclusion based on all detections"""
    total = sum(disease_counts.values())
    
    if total == 0:
        return f"{RESPONSE_MESSAGES['no_disease_detected']}."
    
    # Check if all healthy
    if len(disease_counts) == 1 and any("healthy" in d.lower() for d in disease_counts.keys()):
        return f"{RESPONSE_MESSAGES['plant_healthy']}. {total} healthy leaf area(s) detected."
    
    # Multiple disease types
    disease_list = [d for d in disease_counts.keys() if "healthy" not in d.lower()]
    
    if len(disease_list) == 0:
        return f"All {total} detected areas appear healthy."
    elif len(disease_list) == 1:
        disease = disease_list[0]
        count = disease_counts[disease]
        return f"Detected {count} instance(s) of {disease}. {RESPONSE_MESSAGES['treatment_required']}."
    else:
        # Multiple diseases
        summary = ", ".join([f"{count}x {disease}" for disease, count in disease_counts.items() 
                           if "healthy" not in disease.lower()])
        return f"{RESPONSE_MESSAGES['multiple_diseases']}: {summary}. {RESPONSE_MESSAGES['comprehensive_treatment']}."


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