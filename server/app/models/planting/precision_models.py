from pydantic import BaseModel
from typing import List


class SoilPoint(BaseModel):
    latitude: float
    longitude: float
    N: float
    P: float
    K: float
    pH: float
    moisture: float


class BoundaryPoint(BaseModel):
    latitude: float
    longitude: float


class SoilRequest(BaseModel):
    points: List[SoilPoint]


class BoundaryRequest(BaseModel):
    boundary: List[BoundaryPoint]


# ✅ NEW: Combined request for full field processing
class ProcessRequest(BaseModel):
    boundary: List[BoundaryPoint]
    points: List[SoilPoint]



class YieldInput(BaseModel):
    N: float
    P: float
    K: float
    pH: float
    moisture: float


class SoilZoneResult(BaseModel):
    zones: List[int]                    # e.g. [0, 2, 1, 2]
    dominant_zone: int                  # most common: 0=rich, 1=medium, 2=poor
    zone_summary: dict                  # e.g. {"rich": 1, "medium": 1, "poor": 2}
    silhouette_score: float | None      # cluster quality score
    proximity_scores: List[float]       # how optimal each point is for capsicum
    recommendation: str  