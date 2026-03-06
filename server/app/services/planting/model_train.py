# app/services/model_train.py

import os
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score, mean_squared_error


MODEL_PATH = "app/saved_models/random_forest.pkl"
DATA_PATH = "app/data/yeild_dataset.csv"


def train_model():

    df = pd.read_csv(DATA_PATH)

    # Example features (adjust to your CSV columns)
    X = df[["N", "P", "K", "moisture","density"]]
    y = df["yield_kg"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    r2 = r2_score(y_test, predictions)
    rmse = mean_squared_error(y_test, predictions) ** 0.5

    os.makedirs("app/saved_models", exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    return {
        "r2_score": r2,
        "rmse": rmse
    }