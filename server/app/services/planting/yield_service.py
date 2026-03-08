import joblib
import numpy as np
from pathlib import Path

# Resolve model path relative to project structure, not process cwd.
BASE_DIR = Path(__file__).resolve().parents[2]
MODEL_PATH = BASE_DIR / "models" / "yield_model.pkl"
model = joblib.load(MODEL_PATH)

def predict_yield(N, P, K, pH, moisture):
    data = np.array([[N, P, K, pH, moisture]])
    prediction = model.predict(data)

    return float(prediction[0])