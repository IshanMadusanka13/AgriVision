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