from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    HAS_PSYCO = True
except ImportError:
    HAS_PSYCO = False


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _datasets_dir() -> Path:
    return _repo_root() / "services" / "ml" / "datasets"


def _db_config() -> dict[str, str | int]:
    return {
        "host": os.getenv("POSTGRES_HOST", "127.0.0.1"),
        "port": int(os.getenv("POSTGRES_PORT", "5432")),
        "user": os.getenv("POSTGRES_USER", "postgres"),
        "password": os.getenv("POSTGRES_PASSWORD", "postgres"),
        "dbname": os.getenv("POSTGRES_DB", "ghar_khoj"),
    }


def _connect_db():
    if not HAS_PSYCO:
        raise RuntimeError("psycopg2 is not installed")

    return psycopg2.connect(**_db_config())


def _load_room_csv() -> pd.DataFrame:
    return pd.read_csv(_datasets_dir() / "rooms.csv")


def _load_user_csv() -> pd.DataFrame:
    return pd.read_csv(_datasets_dir() / "users.csv")


def _load_interaction_csv() -> pd.DataFrame:
    return pd.read_csv(_datasets_dir() / "interactions.csv")


def _load_rooms_from_db() -> pd.DataFrame:
    with _connect_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT
                  id,
                  latitude,
                  longitude,
                  parking,
                  is_available AS "isAvailable",
                  room_type AS "roomType",
                  price
                FROM rooms
                ORDER BY id
                """
            )
            rows = cursor.fetchall()
    return pd.DataFrame(rows)


def _load_users_from_db() -> pd.DataFrame:
    with _connect_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT id FROM users ORDER BY id")
            rows = cursor.fetchall()
    return pd.DataFrame(rows)


def _load_interactions_from_db() -> pd.DataFrame:
    with _connect_db() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                "SELECT user_id AS \"userId\", room_id AS \"roomId\", type FROM interactions ORDER BY id"
            )
            rows = cursor.fetchall()
    return pd.DataFrame(rows)


def _should_use_db() -> bool:
    return os.getenv("ML_USE_DB", "1") != "0" and HAS_PSYCO


def load_rooms() -> pd.DataFrame:
    if _should_use_db():
        try:
            return _load_rooms_from_db()
        except Exception as error:
            print(f"Warning: failed to load rooms from DB, falling back to CSV: {error}")
    return _load_room_csv()


def load_users() -> pd.DataFrame:
    if _should_use_db():
        try:
            return _load_users_from_db()
        except Exception as error:
            print(f"Warning: failed to load users from DB, falling back to CSV: {error}")
    return _load_user_csv()


def load_interactions() -> pd.DataFrame:
    if _should_use_db():
        try:
            return _load_interactions_from_db()
        except Exception as error:
            print(f"Warning: failed to load interactions from DB, falling back to CSV: {error}")
    return _load_interaction_csv()
