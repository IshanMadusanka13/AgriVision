import numpy as np
import joblib
from pathlib import Path


# Get project base directory
BASE_DIR = Path(__file__).resolve().parents[2]

MODEL_PATH = BASE_DIR / "models" / "soil_zone_model.pkl"

model = joblib.load(MODEL_PATH)


def _value(point, primary: str, fallback: str | None = None) -> float:
    """
    Extract numeric value from dict or object.
    """
    if isinstance(point, dict):
        if primary in point:
            return float(point[primary])
        if fallback and fallback in point:
            return float(point[fallback])
        raise KeyError(f"Missing field '{primary}'")

    if hasattr(point, primary):
        return float(getattr(point, primary))
    if fallback and hasattr(point, fallback):
        return float(getattr(point, fallback))

    raise AttributeError(f"Missing attribute '{primary}'")


def predict_soil_zones(points):
    """
    Predict soil fertility zones using trained RandomForest model.

    Zone Labels:
    0 = Rich soil
    1 = Medium soil
    2 = Poor soil
    """

    if not points:
        return []

    try:
        # Build feature matrix
        data = np.array(
            [
                [
                    _value(p, "N", "nitrogen"),
                    _value(p, "P", "phosphorus"),
                    _value(p, "K", "potassium"),
                    _value(p, "pH", "ph"),
                    _value(p, "moisture"),
                ]
                for p in points
            ],
            dtype=float,
        )

        # Predict zones
        predictions = model.predict(data)

        return predictions.tolist()

    except Exception as e:
        print("Soil zone prediction error:", e)
        return []