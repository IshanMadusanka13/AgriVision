# app/services/planting/layout_generator.py
import numpy as np
from typing import List, Dict, Tuple
import math

class LayoutGenerator:
    """Generate planting grid within field boundary"""
    
    def generate_grid(
        self,
        boundary_coords: List[List[float]],
        row_spacing_cm: float,
        plant_spacing_cm: float
    ) -> Dict:
        """
        Generate planting points within polygon
        
        Args:
            boundary_coords: Polygon coordinates in meters
            row_spacing_cm: Row spacing in centimeters
            plant_spacing_cm: Plant spacing in centimeters
        
        Returns:
            Dictionary with plant positions and grid parameters
        """
        try:
            # Convert cm to meters for calculations
            row_spacing_m = row_spacing_cm / 100
            plant_spacing_m = plant_spacing_cm / 100
            
            # Validate inputs
            if not boundary_coords or len(boundary_coords) < 3:
                raise ValueError("Invalid boundary coordinates")
            
            # Get bounding box
            x_coords = [coord[0] for coord in boundary_coords]
            y_coords = [coord[1] for coord in boundary_coords]
            min_x, max_x = min(x_coords), max(x_coords)
            min_y, max_y = min(y_coords), max(y_coords)
            
            # Generate grid
            plants = []
            plant_id = 1
            
            x = min_x
            while x <= max_x:
                y = min_y
                while y <= max_y:
                    # Check if point is inside polygon
                    if self._is_point_in_polygon([x, y], boundary_coords):
                        plants.append({
                            "id": plant_id,
                            "x": round(x, 2),
                            "y": round(y, 2),
                            "row": int((x - min_x) / row_spacing_m),
                            "col": int((y - min_y) / plant_spacing_m)
                        })
                        plant_id += 1
                    y += plant_spacing_m
                x += row_spacing_m
            
            # Calculate area of polygon in square meters
            polygon_area_m2 = self._calculate_polygon_area(boundary_coords)
            
            # Calculate coverage
            plant_area_m2 = len(plants) * (row_spacing_m * plant_spacing_m)
            coverage_percent = min(100, (plant_area_m2 / polygon_area_m2) * 100) if polygon_area_m2 > 0 else 0
            
            return {
                "total_plants": len(plants),
                "plants": plants[:1000],  # Limit for storage
                "grid_parameters": {
                    "row_spacing_cm": row_spacing_cm,
                    "plant_spacing_cm": plant_spacing_cm,
                    "bounds": {
                        "min_x": min_x,
                        "max_x": max_x,
                        "min_y": min_y,
                        "max_y": max_y
                    },
                    "polygon_area_m2": round(polygon_area_m2, 2),
                    "grid_points_generated": len(plants)
                },
                "coverage_percentage": round(coverage_percent, 2)
            }
            
        except Exception as e:
            # Return empty but valid structure
            return {
                "total_plants": 0,
                "plants": [],
                "grid_parameters": {
                    "row_spacing_cm": row_spacing_cm,
                    "plant_spacing_cm": plant_spacing_cm,
                    "error": str(e)
                },
                "coverage_percentage": 0
            }
    
    def calculate_coverage(self, field_area_m2: float, plant_count: int, 
                          plant_spacing_cm: float) -> float:
        """
        Calculate field coverage percentage
        
        Args:
            field_area_m2: Field area in square meters
            plant_count: Number of plants
            plant_spacing_cm: Spacing between plants in centimeters
        
        Returns:
            Coverage percentage (0-100)
        """
        if field_area_m2 <= 0:
            return 0.0
        
        # Convert cm to meters for area calculation
        plant_spacing_m = plant_spacing_cm / 100
        plant_area_m2 = plant_count * (plant_spacing_m ** 2)
        coverage = (plant_area_m2 / field_area_m2) * 100
        return round(min(coverage, 100), 2)
    
    def _is_point_in_polygon(self, point: List[float], polygon: List[List[float]]) -> bool:
        """Ray casting algorithm for point-in-polygon test"""
        x, y = point
        n = len(polygon)
        inside = False
        
        for i in range(n):
            j = (i + 1) % n
            xi, yi = polygon[i]
            xj, yj = polygon[j]
            
            # Check if point is on horizontal edge
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
        
        return inside
    
    def _calculate_polygon_area(self, coordinates: List[List[float]]) -> float:
        """
        Calculate polygon area using Shoelace formula
        
        Returns area in square meters
        """
        if len(coordinates) < 3:
            return 0.0
        
        area = 0.0
        n = len(coordinates)
        
        for i in range(n):
            j = (i + 1) % n
            area += coordinates[i][0] * coordinates[j][1]
            area -= coordinates[j][0] * coordinates[i][1]
        
        return abs(area) / 2.0

# Singleton instance
layout_generator = LayoutGenerator()