"""Shared batch operation helpers and result types."""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class BatchDeleteResult:
    """Summary for a batch delete operation."""

    deleted_count: int
    failed_ids: tuple[UUID, ...]
    errors: tuple[str, ...]


@dataclass(frozen=True)
class BatchRestoreResult:
    """Summary for a batch restore operation."""

    restored_count: int
    failed_ids: tuple[UUID, ...]
    errors: tuple[str, ...]


async def _run_batch_operation(
    *,
    identifiers: Iterable[UUID],
    operation: Callable[[UUID], Awaitable[object]],
    handled_exceptions: tuple[type[Exception], ...],
) -> tuple[int, tuple[UUID, ...], tuple[str, ...]]:
    success_count = 0
    failed_ids: list[UUID] = []
    errors: list[str] = []

    for record_id in identifiers:
        try:
            await operation(record_id)
            success_count += 1
        except handled_exceptions as exc:
            failed_ids.append(record_id)
            errors.append(str(exc))

    return success_count, tuple(failed_ids), tuple(errors)


async def batch_delete_records(
    *,
    identifiers: Iterable[UUID],
    delete_record: Callable[[UUID], Awaitable[object]],
    handled_exceptions: tuple[type[Exception], ...],
) -> BatchDeleteResult:
    """Run a batch delete operation with per-record error reporting."""
    deleted_count, failed_ids, errors = await _run_batch_operation(
        identifiers=identifiers,
        operation=delete_record,
        handled_exceptions=handled_exceptions,
    )
    return BatchDeleteResult(
        deleted_count=deleted_count,
        failed_ids=failed_ids,
        errors=errors,
    )


async def batch_restore_records(
    *,
    identifiers: Iterable[UUID],
    restore_record: Callable[[UUID], Awaitable[object]],
    handled_exceptions: tuple[type[Exception], ...],
) -> BatchRestoreResult:
    """Run a batch restore operation with per-record error reporting."""
    restored_count, failed_ids, errors = await _run_batch_operation(
        identifiers=identifiers,
        operation=restore_record,
        handled_exceptions=handled_exceptions,
    )
    return BatchRestoreResult(
        restored_count=restored_count,
        failed_ids=failed_ids,
        errors=errors,
    )
