"""Shared collection helpers for service-layer code."""

from __future__ import annotations

from collections.abc import Iterable
from typing import TypeVar

T = TypeVar("T")


def deduplicate_preserving_order(values: Iterable[T]) -> list[T]:
    """Return items in first-seen order without duplicates."""
    return list(dict.fromkeys(values))
