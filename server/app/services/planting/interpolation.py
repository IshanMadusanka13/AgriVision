import numpy as np

def idw_interpolation(points, power=2):

    coords = np.array([[p.latitude, p.longitude] for p in points])
    values = np.array([p.N for p in points])  # Example: Nitrogen

    interpolated = []

    for i in range(len(coords)):
        distances = np.linalg.norm(coords - coords[i], axis=1)
        weights = 1 / (distances + 1e-10) ** power
        weights /= weights.sum()
        interpolated_value = np.sum(weights * values)
        interpolated.append(float(interpolated_value))

    return interpolated