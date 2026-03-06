from ultralytics import YOLO
from tensorflow.keras.models import load_model
import os

LEAF_MODEL_PATH = "models/disease_v2.pt"
DISEASE_CLASSIFIER_PATH = "models/final_Efficent_model.keras"
QUALITY_MODEL_PATH = "models/qualityV4.pt"
GROWTH_MODEL_PATH = "models/growth.pt"

leaf_model = YOLO(LEAF_MODEL_PATH)
disease_classifier = '' #load_model(DISEASE_CLASSIFIER_PATH, compile=False)
quality_model = YOLO(QUALITY_MODEL_PATH)
growth_model = YOLO(GROWTH_MODEL_PATH)

_growth_model = None

def get_growth_model():
    global _growth_model
    if _growth_model is None:
        if os.path.exists(GROWTH_MODEL_PATH):
            _growth_model = YOLO(GROWTH_MODEL_PATH)
        else:
            raise FileNotFoundError(f"Growth model not found at {GROWTH_MODEL_PATH}")
    return _growth_model

CLASS_NAMES = [
    "bacterial_spot",
    "cercospora",
    "healthy",
    "leaf_curl",
    "powdery_mildew"
]