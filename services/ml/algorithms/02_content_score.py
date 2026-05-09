# 02) Content Score (Parking + Availability)

"""Python script converted from `ml_notebooks/02_content_score.ipynb`.

Implements the **content-based score** part of `artifacts/api-server/src/routes/recommendations.ts`.

From the route:
- `contentScore = (room.parking ? 0.2 : 0) + (room.isAvailable ? 0.5 : 0) + 0.3`
- weighted contribution: `contentScore * 0.3`

This script loads the synthetic CSV dataset from `ml_datasets/rooms.csv`.
"""

from __future__ import annotations

import pathlib
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data_loader import load_rooms


def content_score(parking: bool, is_available: bool) -> float:
    return (0.2 if parking else 0.0) + (0.5 if is_available else 0.0) + 0.3


def main() -> None:
    rooms = load_rooms()


    # CSV stores booleans as TRUE/FALSE strings
    rooms["parking"] = rooms["parking"].astype(str).str.upper().map({"TRUE": True, "FALSE": False})
    rooms["isAvailable"] = rooms["isAvailable"].astype(str).str.upper().map({"TRUE": True, "FALSE": False})

    rows: list[dict[str, float | int]] = []

    for _, room in rooms.iterrows():
        cs = content_score(bool(room["parking"]), bool(room["isAvailable"]))
        rows.append({"roomId": int(room["id"]), "contentScore": float(cs), "weighted": float(cs * 0.3)})

    df = pd.DataFrame(rows).sort_values("weighted", ascending=False)
    print(df.to_string(index=False))


if __name__ == "__main__":
    main()

