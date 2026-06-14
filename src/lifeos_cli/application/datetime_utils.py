"""Datetime helpers for storage and API boundaries."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import overload


@overload
def normalize_storage_datetime(value: None) -> None: ...


@overload
def normalize_storage_datetime(value: datetime) -> datetime: ...


def normalize_storage_datetime(value: datetime | None) -> datetime | None:
    """Return stored datetimes as UTC-aware values, treating naive storage values as UTC."""
    if value is None:
        return None
    if value.tzinfo is not None and value.utcoffset() is not None:
        return value.astimezone(timezone.utc)
    return value.replace(tzinfo=timezone.utc)


def format_utc_iso(value: datetime) -> str:
    """Render one stored datetime as an explicit UTC ISO string."""
    return normalize_storage_datetime(value).isoformat().replace("+00:00", "Z")
