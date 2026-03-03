from ultralytics import YOLO
from tensorflow.keras.models import load_model

LEAF_MODEL_PATH = "models/disease_v2.pt"
DISEASE_CLASSIFIER_PATH = "models/final_Efficent_model.keras"
QUALITY_MODEL_PATH = "models/qualityV2.pt"
GROWTH_MODEL_PATH = "models/growth.pt"


leaf_model = YOLO(LEAF_MODEL_PATH)
disease_classifier = load_model(DISEASE_CLASSIFIER_PATH, compile=False)
quality_model = YOLO(QUALITY_MODEL_PATH)
growth_model = YOLO(GROWTH_MODEL_PATH)

CLASS_NAMES = [
    "bacterial_spot",
    "cercospora",
    "healthy",
    "leaf_curl",
    "powdery_mildew"
]