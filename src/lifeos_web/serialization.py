"""Serialization helpers shared by Web API routers."""

from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import date, datetime, timezone
from enum import Enum
from typing import Any, cast
from uuid import UUID


def datetime_to_utc_iso(value: datetime) -> str:
    """Render stored datetimes as explicit UTC ISO strings for Web clients."""
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def to_jsonable(value: Any) -> Any:
    """Convert LifeOS dataclasses and scalar values into JSON-compatible values."""
    if is_dataclass(value) and not isinstance(value, type):
        return {key: to_jsonable(item) for key, item in asdict(value).items()}
    if hasattr(value, "__dict__") and not isinstance(value, type):
        return {
            key: to_jsonable(item) for key, item in vars(value).items() if not key.startswith("_")
        }
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, datetime):
        return datetime_to_utc_iso(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, tuple | list):
        return [to_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    return value


def to_jsonable_dict(value: Any) -> dict[str, object]:
    """Convert a dataclass-like object into a JSON-compatible object payload."""
    payload = to_jsonable(value)
    if not isinstance(payload, dict):
        raise TypeError(f"Expected JSON object payload, got {type(payload).__name__}")
    return cast(dict[str, object], payload)
