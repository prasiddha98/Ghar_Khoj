# 05) Final Combined Recommender

"""Python script converted from `ml_notebooks/05_final_combined_recommender.ipynb`.

Recombines all scoring parts from `apps/api/src/routes/recommendations.ts`.

Weights:
- distanceScore weight 0.25
- contentScore weight 0.3
- knnScore weight 0.25
- collabScore weight 0.2

This script loads the website dataset CSVs from `services/ml/datasets/` and prints the top `limit`.
"""

from __future__ import annotations

import math
import pathlib
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data_loader import load_rooms, load_interactions, load_users


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
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


def content_score(parking: bool, is_available: bool) -> float:
    return (0.2 if parking else 0.0) + (0.5 if is_available else 0.0) + 0.3


def main() -> None:
    base_dir = __file__
    # repo_root should be the repository root, since ml_datasets is at the repo root
    repo_root = str(__import__("pathlib").Path(base_dir).resolve().parents[3])

    rooms = load_rooms()
    interactions = load_interactions()
    users = load_users()


    query_lat = 27.7172
    query_lon = 85.3240
    limit = 3
    user_id = 1

    rooms["parking"] = rooms["parking"].astype(str).str.upper().map({"TRUE": True, "FALSE": False})
    rooms["isAvailable"] = rooms["isAvailable"].astype(str).str.upper().map({"TRUE": True, "FALSE": False})

    user_interactions = interactions[interactions["userId"] == user_id]
    viewed_room_ids = user_interactions[user_interactions["type"] == "view"]["roomId"].tolist()
    user_room_set = set(user_interactions["roomId"].tolist())

    room_scores: list[dict[str, object]] = []

    for _, room in rooms.iterrows():
        room_id = int(room["id"])
        score = 0.0

        # 1) distance score (weighted 0.25)
        distance = haversine_distance(query_lat, query_lon, float(room["latitude"]), float(room["longitude"]))
        distance_score = max(0.0, 1.0 - distance / 50.0)
        score += distance_score * 0.25

        # 2) content score (weighted 0.3)
        cs = content_score(bool(room["parking"]), bool(room["isAvailable"]))
        score += cs * 0.3

        # 3) knn-like score (weighted 0.25)
        if len(viewed_room_ids) > 0:
            similar_rooms = rooms[
                (
                    (rooms["id"].isin(viewed_room_ids))
                    & (rooms["roomType"] == room["roomType"])
                    & (abs(rooms["price"] - room["price"]) < room["price"] * 0.3)
                )
            ]
            knn_score = min(1.0, (len(similar_rooms) / max(len(viewed_room_ids), 1)) * 0.5)
            score += knn_score * 0.25
        else:
            score += 0.1 * 0.25

        # 4) collaborative score (weighted 0.2)
        if len(users) > 1:
            similarity_sum = 0.0
            similar_users_count = 0

            for _, other_user in users.iterrows():
                other_uid = int(other_user["id"])
                if other_uid == user_id:
                    continue

                other_room_set = set(interactions[interactions["userId"] == other_uid]["roomId"].tolist())
                if len(other_room_set) == 0:
                    continue

                intersection = user_room_set.intersection(other_room_set)
                union = user_room_set.union(other_room_set)

                if len(union) > 0:
                    jaccard_similarity = len(intersection) / len(union)
                    if room_id in other_room_set:
                        similarity_sum += jaccard_similarity
                        similar_users_count += 1

            collab_score = (
                min(1.0, similarity_sum / max(similar_users_count, 1))
                if similar_users_count > 0
                else 0.05
            )
            score += collab_score * 0.2
        else:
            score += 0.05 * 0.2

        room_scores.append({"room": room.to_dict(), "finalScore": float(score)})

    result = [
        {
            **rs["room"],
            "recommendationScore": rs["finalScore"],
        }
        for rs in sorted(room_scores, key=lambda x: x["finalScore"], reverse=True)[:limit]
    ]

    print("Top recommendations (combined scoring):")
    for r in result:
        print(r["id"], r["recommendationScore"])


if __name__ == "__main__":
    main()

