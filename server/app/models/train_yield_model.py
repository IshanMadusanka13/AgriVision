import pandas as pd
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

data_path = os.path.join(BASE_DIR, "data", "yield_dataset.csv")

data = pd.read_csv(data_path)

X = data[["N", "P", "K", "pH", "moisture"]]
y = data["yield_kg"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestRegressor()

model.fit(X_train, y_train)

model_path = os.path.join(BASE_DIR, "models", "yield_model.pkl")

joblib.dump(model, model_path)

print("Model saved at:", model_path)