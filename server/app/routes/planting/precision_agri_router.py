from fastapi import APIRouter
from app.models.planting.precision_models import BoundaryRequest, ProcessRequest ,YieldInput
from app.services.planting.area_service import calculate_area_polygon
from app.services.planting.interpolation import idw_interpolation
from app.services.planting.clustering import perform_kmeans
from app.services.planting.yield_service import predict_yield
from app.services.planting.rules import spacing_rule
from app.services.planting.model_train import train_model

router = APIRouter()


# ---------------- AREA ----------------
@router.post("/area")
def calculate_area(request: BoundaryRequest):

    coords = [(p.latitude, p.longitude) for p in request.boundary]
    area_m2 = calculate_area_polygon(coords)

    return {
        "area_m2": area_m2,
        "area_perches": area_m2 / 25,
        "hectares": area_m2 / 10000,
        "acres": area_m2 * 0.000247105
    }


# ---------------- PROCESS FULL FIELD ----------------


@router.post("/process")
def process_soil(request: ProcessRequest):

    # ---------------- AREA ----------------
    boundary_coords = [(p.latitude, p.longitude) for p in request.boundary]
    area_m2 = calculate_area_polygon(boundary_coords)

    INTER_ROW_SPACING = 0.75
    LAND_EFFICIENCY = 0.90

    points = request.points
    zones = perform_kmeans(points)

    enriched_points = []
    densities = []

    # ---------------- SPACING + DENSITY ----------------
    for i, point in enumerate(points):

        intra_spacing = spacing_rule(zones[i], point.moisture)

        # Avoid division by zero
        if intra_spacing <= 0:
            intra_spacing = 0.5  # safe fallback

        point_density = 1 / (intra_spacing * INTER_ROW_SPACING)
        densities.append(point_density)

        enriched_points.append({
            "latitude": point.latitude,
            "longitude": point.longitude,
            "zone": zones[i],
            "intra_spacing_m": intra_spacing,
            "inter_row_spacing_m": INTER_ROW_SPACING,
            "density_per_m2": round(point_density, 3)
        })

    if len(densities) == 0:
        return {"error": "No soil points provided"}

    # ---------------- PLANT COUNT ----------------
    avg_density = sum(densities) / len(densities)
    total_plant_count = area_m2 * avg_density * LAND_EFFICIENCY

    # ---------------- YIELD PREDICTION ----------------
   # predicted_yield = predict_yield(points)

    # ---------------- RESPONSE ----------------
    return {
        "area_m2": round(area_m2, 2),
        "area_perches": round(area_m2 / 25.29, 2),
        "total_plant_count": int(total_plant_count),
        #"predicted_yield": round(predicted_yield, 2),
        "points": enriched_points
    }


@router.post("/predict-yield")
def predict(data: YieldInput):

    result = predict_yield(
        data.N,
        data.P,
        data.K,
        data.pH,
        data.moisture
    )

    return {"predicted_yield": result}



