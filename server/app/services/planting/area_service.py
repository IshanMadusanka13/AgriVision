import numpy as np
from pyproj import Transformer

# Sri Lanka UTM Zone 44N
TRANSFORMER = Transformer.from_crs("EPSG:4326", "EPSG:32644", always_xy=True)

def calculate_area_polygon(coords):
    """
    coords: [(lat, lon), ...]
    returns: area in square meters
    """

    if len(coords) < 3:
        return 0.0

    projected = [TRANSFORMER.transform(lon, lat) for lat, lon in coords]

    x = np.array([p[0] for p in projected])
    y = np.array([p[1] for p in projected])

    area = 0.5 * abs(
        np.dot(x, np.roll(y, 1)) -
        np.dot(y, np.roll(x, 1))
    )

    return float(area)