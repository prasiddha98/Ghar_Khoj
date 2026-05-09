# Ghar-Khoj Recommendation Algorithm Demo

"""Python script converted from `demo.ipynb`.

Reproduces the logic from `artifacts/api-server/src/routes/recommendations.ts`
(POST `/api/recommendations`) using a small synthetic dataset (no DB needed).

What it does
For each room, it computes:
- distance score (Haversine, weighted 0.25)
- content score (parking/availability constants, weighted 0.3)
- KNN-like score based on viewed rooms + roomType + price proximity (weighted 0.25)
- collaborative score using Jaccard overlap between users’ interacted room sets (weighted 0.2)

and returns the top-N rooms by total score.
"""

from __future__ import annotations

import math
import pathlib
import sys
from pathlib import Path
from pprint import pprint
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from data_loader import load_rooms, load_interactions, load_users


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance between (lat1,lon1) and (lat2,lon2) in kilometers.

    Matches the TS implementation (R=6371).
    """

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


def recommend_rooms(
    *,
    latitude: float,
    longitude: float,
    limit: int,
    rooms: list[dict[str, Any]],
    users: list[dict[str, Any]],
    interactions: list[dict[str, Any]],
    user_id: int,
) -> list[dict[str, Any]]:
    """Reimplementation of the TS scoring in recommendations.ts.

    rooms: list of dicts: id, latitude, longitude, parking, isAvailable, roomType, price

    interactions: list of dicts: userId, roomId, type (view/save/rent)
    """

    # Simulate: const userInteractions = interactions where userId == req.user.id
    user_interactions = [i for i in interactions if i["userId"] == user_id]

    all_users = users
    all_rooms = rooms

    room_scores: list[dict[str, Any]] = []

    for room in all_rooms:
        score = 0.0

        lat = float(latitude)
        lon = float(longitude)

        # Haversine scoring (0.25 weight)
        if room.get("latitude") is not None and room.get("longitude") is not None:
            distance = haversine_distance(lat, lon, room["latitude"], room["longitude"])
            distance_score = max(0.0, 1.0 - distance / 50.0)
            score += distance_score * 0.25

        # Content-based filtering (0.3 weight)
        content_score = (
            (0.2 if room.get("parking") else 0.0)
            + (0.5 if room.get("isAvailable") else 0.0)
            + 0.3
        )
        score += content_score * 0.3

        # KNN scoring (0.25 weight) based on viewed rooms
        viewed_room_ids = [i["roomId"] for i in user_interactions if i["type"] == "view"]

        if len(viewed_room_ids) > 0:
            similar_rooms = [
                r
                for r in all_rooms
                if (
                    r["id"] in viewed_room_ids
                    and r["roomType"] == room["roomType"]
                    and abs(r["price"] - room["price"]) < room["price"] * 0.3
                )
            ]

            knn_score = min(1.0, (len(similar_rooms) / max(len(viewed_room_ids), 1)) * 0.5)
            score += knn_score * 0.25
        else:
            score += 0.1 * 0.25

        # Collaborative filtering (0.2 weight) via user-user Jaccard overlap
        if len(all_users) > 1:
            user_room_set = set([i["roomId"] for i in user_interactions])

            similarity_sum = 0.0
            similar_users_count = 0

            for other_user in all_users:
                if other_user["id"] == user_id:
                    continue

                other_room_set = set(
                    [i["roomId"] for i in user_interactions if i["userId"] == other_user["id"]]
                )

                if len(other_room_set) == 0:
                    continue

                intersection = set([x for x in user_room_set if x in other_room_set])
                union = set(list(user_room_set) + list(other_room_set))

                if len(union) > 0:
                    jaccard_similarity = len(intersection) / len(union)

                    if room["id"] in other_room_set:
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

        room_scores.append({"room": room, "score": score})

    top_rooms = sorted(room_scores, key=lambda x: x["score"], reverse=True)[:limit]

    return [{**rs["room"], "recommendationScore": rs["score"]} for rs in top_rooms]


if __name__ == "__main__":
    rooms = load_rooms().to_dict(orient="records")
    users = load_users().to_dict(orient="records")
    interactions = load_interactions().to_dict(orient="records")

    # Synthetic dataset
    if len(rooms) == 0 or len(users) == 0:
        rooms = [
        {
            "id": 1,
            "latitude": 27.7172,
            "longitude": 85.3240,
            "parking": True,
            "isAvailable": True,
            "roomType": "studio",
            "price": 15000,
        },
        {
            "id": 2,
            "latitude": 27.7000,
            "longitude": 85.3500,
            "parking": False,
            "isAvailable": True,
            "roomType": "studio",
            "price": 15500,
        },
        {
            "id": 3,
            "latitude": 27.7300,
            "longitude": 85.3000,
            "parking": True,
            "isAvailable": False,
            "roomType": "1bhk",
            "price": 22000,
        },
        {
            "id": 4,
            "latitude": 27.6800,
            "longitude": 85.3200,
            "parking": True,
            "isAvailable": True,
            "roomType": "studio",
            "price": 30000,
        },
        {
            "id": 5,
            "latitude": 27.7150,
            "longitude": 85.3100,
            "parking": False,
            "isAvailable": True,
            "roomType": "1bhk",
            "price": 21000,
        },
    ]

    users = [{"id": 1}, {"id": 2}, {"id": 3}]

    # interactions: includes types view/save/rent
    interactions = [
        {"userId": 1, "roomId": 1, "type": "view"},
        {"userId": 1, "roomId": 2, "type": "save"},
        {"userId": 2, "roomId": 1, "type": "view"},
        {"userId": 2, "roomId": 3, "type": "rent"},
        {"userId": 3, "roomId": 2, "type": "view"},
        {"userId": 3, "roomId": 5, "type": "save"},
    ]

    recs = recommend_rooms(
        latitude=27.7172,
        longitude=85.3240,
        limit=3,
        rooms=rooms,
        users=users,
        interactions=interactions,
        user_id=1,
    )

    print("Top recommendations (reproduced scoring):")
    pprint(recs)

