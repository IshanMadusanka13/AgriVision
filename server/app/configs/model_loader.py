from ultralytics import YOLO

DISEASE_MODEL_PATH = "models/disease_v1.pt"

disease_model = YOLO(DISEASE_MODEL_PATH)
