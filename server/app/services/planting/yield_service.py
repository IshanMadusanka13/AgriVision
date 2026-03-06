import joblib
import numpy as np

model = joblib.load("app/models/yield_model.pkl")

def predict_yield(N, P, K, pH, moisture):
    data = np.array([[N, P, K, pH, moisture]])
    prediction = model.predict(data)

    return float(prediction[0])