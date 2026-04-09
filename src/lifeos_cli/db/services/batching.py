"""Shared batch operation result types."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class BatchDeleteResult:
    """Summary for a batch delete operation."""

    deleted_count: int
    failed_ids: tuple[UUID, ...]
    errors: tuple[str, ...]
