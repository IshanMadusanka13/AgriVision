from ultralytics import YOLO

DISEASE_MODEL_PATH = "models/disease_v1.pt"
QUALITY_MODEL_PATH = "models/quality.pt"

disease_model = YOLO(DISEASE_MODEL_PATH)
quality_model = YOLO(QUALITY_MODEL_PATH)