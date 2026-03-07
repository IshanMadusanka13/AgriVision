import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import os

import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Load dataset


data_path = os.path.join(BASE_DIR, "data", "capsicum_soil_dataset.csv")
data = pd.read_csv(data_path)

X = data[['N', 'P', 'K', 'pH', 'moisture']]
y = data['zone']

# Split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Train model
model = RandomForestClassifier(
    n_estimators=200,
    max_depth=10,
    random_state=42
)

model.fit(X_train, y_train)

# Evaluate
pred = model.predict(X_test)
acc = accuracy_score(y_test, pred)

print("Accuracy:", acc)

# Save model
joblib.dump(model, "soil_zone_model.pkl")

print("Model saved!")