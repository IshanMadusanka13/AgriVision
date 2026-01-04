from ultralytics import YOLO

DISEASE_MODEL_PATH = "models/disease_v1.pt"
QUALITY_MODEL_PATH = "models/qualityV2.pt"

disease_model = YOLO(DISEASE_MODEL_PATH)
quality_model = YOLO(QUALITY_MODEL_PATH)