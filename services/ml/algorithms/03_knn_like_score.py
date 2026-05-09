# 03) KNN-like Score (Viewed Rooms + roomType + Price Proximity)

"""Python script converted from `ml_notebooks/03_knn_like_score.ipynb`.

Implements the **KNN scoring** part of `artifacts/api-server/src/routes/recommendations.ts`.

In the route (weighted 0.25):
- `viewedRoomIds = userInteractions where type == "view"`
- similar rooms satisfy:
  - room id is in `viewedRoomIds`
  - `r.roomType === room.roomType`
  - `abs(r.price - room.price) < room.price * 0.3`
- `knnScore = min(1, (similarRooms.length / viewedRoomIds.length) * 0.5)`
- contribution: `knnScore * 0.25`

This script loads the synthetic CSV datasets from `ml_datasets/`.
"""

from __future__ import annotations

import pathlib
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data_loader import load_rooms, load_interactions, load_users


def main() -> None:
    rooms = load_rooms()
    interactions = load_interactions()
    users = load_users()


    # Choose the same user_id as demo.ipynb
    user_id = 1

    # viewed rooms for this user
    user_interactions = interactions[interactions["userId"] == user_id]
    viewed_room_ids = user_interactions[user_interactions["type"] == "view"]["roomId"].tolist()

    rows: list[dict[str, float | int]] = []

    for _, room in rooms.iterrows():
        similar_rooms = rooms[
            (rooms["id"].isin(viewed_room_ids))
            & (rooms["roomType"] == room["roomType"])
            & (abs(rooms["price"] - room["price"]) < room["price"] * 0.3)
        ]

        if len(viewed_room_ids) > 0:
            knn_score = min(1.0, (len(similar_rooms) / max(len(viewed_room_ids), 1)) * 0.5)
            weighted = knn_score * 0.25
        else:
            knn_score = 0.1
            weighted = knn_score * 0.25

        rows.append({"roomId": int(room["id"]), "knnScore": float(knn_score), "weighted": float(weighted)})

    df = pd.DataFrame(rows).sort_values("weighted", ascending=False)
    print(df.to_string(index=False))
    print(df.head(5).to_string(index=False))


if __name__ == "__main__":
    main()

