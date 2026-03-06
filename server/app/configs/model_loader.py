from ultralytics import YOLO
from tensorflow.keras.models import load_model
import os

LEAF_MODEL_PATH = "models/disease_v2.pt"
DISEASE_CLASSIFIER_PATH = "models/final_Efficent_model.keras"
QUALITY_MODEL_PATH = "models/qualityV4.pt"
GROWTH_MODEL_PATH = "models/growth.pt"

# Lazy loading models - only load when they exist
_disease_model = None
_quality_model = None
_growth_model = None

def get_disease_model():
    global _disease_model
    if _disease_model is None:
        if os.path.exists(DISEASE_MODEL_PATH):
            _leaf_model = YOLO(LEAF_MODEL_PATH)
        else:
            raise FileNotFoundError(f"Disease model not found at {DISEASE_MODEL_PATH}")
    return _disease_model

def get_quality_model():
    global _quality_model
    if _quality_model is None:
        if os.path.exists(QUALITY_MODEL_PATH):
            _disease_classifier = ''#load_model(DISEASE_CLASSIFIER_PATH, compile=False)
quality_model = YOLO(QUALITY_MODEL_PATH)
        else:
            raise FileNotFoundError(f"Quality model not found at {QUALITY_MODEL_PATH}")
    return _quality_model

def get_growth_model():
    global _growth_model
    if _growth_model is None:
        if os.path.exists(GROWTH_MODEL_PATH):
            _growth_model = YOLO(GROWTH_MODEL_PATH)
        else:
            raise FileNotFoundError(f"Growth model not found at {GROWTH_MODEL_PATH}")
    return _growth_model

# For backward compatibility
disease_model = None
quality_model = None
growth_model = None

CLASS_NAMES = [
    "bacterial_spot",
    "cercospora",
    "healthy",
    "leaf_curl",
    "powdery_mildew"
]