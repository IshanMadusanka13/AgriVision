# create_tables.py
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.configs.database import engine, Base
from app.models.planting.planting_models import PlantingCalculation
from app.models.planting.field_models import Field  # <-- import your Field model

def create_tables():
    """Create all tables in the database"""
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")

if __name__ == "__main__":
    create_tables()
