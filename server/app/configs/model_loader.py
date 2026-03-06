from ultralytics import YOLO

DISEASE_MODEL_PATH = "app/models/disease_v2.pt"
QUALITY_MODEL_PATH = "app/models/qualityV2.pt"
GROWTH_MODEL_PATH = "app/models/growth.pt"


disease_model = YOLO(DISEASE_MODEL_PATH)
quality_model = YOLO(QUALITY_MODEL_PATH)
growth_model = YOLO(GROWTH_MODEL_PATH)