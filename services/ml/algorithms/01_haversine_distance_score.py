# 01) Haversine Distance Score

"""Python script converted from `ml_notebooks/01_haversine_distance_score.ipynb`.

Implements the **distance score** part of `artifacts/api-server/src/routes/recommendations.ts`.

- Haversine distance (km) with Earth radius **R=6371**
- `distanceScore = max(0, 1 - distance/50)`
- weighted contribution: `distanceScore * 0.25`

This script loads the synthetic CSV dataset from `ml_datasets/rooms.csv`.
"""

from __future__ import annotations

import math
import pathlib
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data_loader import load_rooms


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between (lat1,lon1) and (lat2,lon2) in kilometers (R=6371)."""

    R = 6371

    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)

    a = (
        math.sin(dLat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dLon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def distance_score_km(distance_km: float) -> float:
    return max(0.0, 1.0 - distance_km / 50.0)


def main() -> None:
    rooms = load_rooms()


    # Example input (same as demo.ipynb)
    query_lat = 27.7172
    query_lon = 85.3240

    rows: list[dict[str, float | int]] = []

    for _, room in rooms.iterrows():
        d = haversine_distance(query_lat, query_lon, float(room["latitude"]), float(room["longitude"]))
        ds = distance_score_km(d)
        rows.append(
            {
                "roomId": int(room["id"]),
                "distance_km": float(d),
                "distanceScore": float(ds),
                "weighted": float(ds * 0.25),
            }
        )

    df = pd.DataFrame(rows).sort_values("weighted", ascending=False)

    # Show top-N by distanceScore contribution
    print(df.head(5).to_string(index=False))


if __name__ == "__main__":
    main()

