import numpy as np

def _value(p, field):
    if isinstance(p, dict):
        return float(p[field])
    return float(getattr(p, field))


def idw_interpolation(points, power=2):

    coords = np.array([
        [_value(p, "latitude"), _value(p, "longitude")]
        for p in points
    ])

    values = np.array([
        _value(p, "N")   # Nitrogen interpolation
        for p in points
    ])

    interpolated = []

    for i in range(len(coords)):

        distances = np.linalg.norm(coords - coords[i], axis=1)

        weights = 1 / (distances + 1e-10) ** power
        weights /= weights.sum()

        interpolated_value = np.sum(weights * values)

        interpolated.append(float(interpolated_value))

    return interpolated