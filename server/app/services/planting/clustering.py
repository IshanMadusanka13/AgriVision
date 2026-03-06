import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def _value(point, primary: str, fallback: str | None = None) -> float:
    if isinstance(point, dict):
        if primary in point:
            return float(point[primary])
        if fallback and fallback in point:
            return float(point[fallback])
        raise KeyError(f"Missing field '{primary}'")

    if hasattr(point, primary):
        return float(getattr(point, primary))
    if fallback and hasattr(point, fallback):
        return float(getattr(point, fallback))
    raise AttributeError(f"Missing attribute '{primary}'")


def _soil_score(center: np.ndarray) -> float:
    n, p, k, ph = center
    ph_penalty = abs(ph - 6.5)
    return float(n + p + k - (10.0 * ph_penalty))


def perform_kmeans(points):
    """Return zone labels per point: 0=rich, 1=medium, 2=poor."""
    if not points:
        return []

    data = np.array(
        [
            [
                _value(p, "N", "nitrogen"),
                _value(p, "P", "phosphorus"),
                _value(p, "K", "potassium"),
                _value(p, "pH", "ph"),
            ]
            for p in points
        ],
        dtype=float,
    )

    n_samples = len(data)
    if n_samples == 1:
        return [1]

    k = min(3, n_samples)

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(data)

    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    cluster_ids = kmeans.fit_predict(scaled_data)
    centers = scaler.inverse_transform(kmeans.cluster_centers_)

    cluster_scores = [(idx, _soil_score(center)) for idx, center in enumerate(centers)]
    cluster_scores.sort(key=lambda item: item[1], reverse=True)

    if k == 1:
        cluster_to_zone = {cluster_scores[0][0]: 1}
    elif k == 2:
        cluster_to_zone = {
            cluster_scores[0][0]: 0,
            cluster_scores[1][0]: 2,
        }
    else:
        cluster_to_zone = {
            cluster_scores[0][0]: 0,
            cluster_scores[1][0]: 1,
            cluster_scores[2][0]: 2,
        }

    return [cluster_to_zone[int(cluster_id)] for cluster_id in cluster_ids]