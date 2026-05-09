# 04) Collaborative Filtering Score (User-User Jaccard)

"""Python script converted from `ml_notebooks/04_collaborative_jaccard_score.ipynb`.

Implements the collaborative filtering part of `artifacts/api-server/src/routes/recommendations.ts`.

For the current user:
- `userRoomSet` = set of roomIds from this user's interactions
- For each `otherUser`:
  - `otherRoomSet` = set of roomIds from that other user's interactions
  - `jaccardSimilarity = |intersection| / |union|`
  - if the candidate room is in `otherRoomSet`, then add that similarity
- `collabScore = min(1, similaritySum/similarUsersCount)` else `0.05`
- weighted contribution: `collabScore * 0.2`

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


    user_id = 1

    user_interactions = interactions[interactions["userId"] == user_id]
    user_room_set = set(user_interactions["roomId"].tolist())

    rows: list[dict[str, float | int]] = []

    for _, room in rooms.iterrows():
        room_id = int(room["id"])

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
            weighted = collab_score * 0.2
        else:
            collab_score = 0.05
            weighted = collab_score * 0.2

        rows.append({"roomId": room_id, "collabScore": float(collab_score), "weighted": float(weighted)})

    df = pd.DataFrame(rows).sort_values("weighted", ascending=False)
    print(df.to_string(index=False))
    print(df.head(5).to_string(index=False))


if __name__ == "__main__":
    main()

