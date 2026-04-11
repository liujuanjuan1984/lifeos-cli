"""CLI output formatting helpers."""

from __future__ import annotations

import sys
from collections.abc import Sequence
from datetime import datetime
from typing import Protocol
from uuid import UUID

from lifeos_cli.application.time_preferences import to_preferred_timezone


class BatchResult(Protocol):
    """Protocol for batch command result rendering."""

    @property
    def failed_ids(self) -> Sequence[UUID]: ...

    @property
    def errors(self) -> Sequence[str]: ...


def format_timestamp(value: object | None) -> str:
    """Render a timestamp-like object."""
    if value is None:
        return "-"
    if isinstance(value, datetime):
        return to_preferred_timezone(value).isoformat()
    isoformat = getattr(value, "isoformat", None)
    if callable(isoformat):
        return str(isoformat())
    return str(value)


def format_id_lines(label: str, identifiers: Sequence[UUID]) -> str:
    """Render a labeled list of identifiers."""
    if not identifiers:
        return f"{label}: -"
    return "\n".join([f"{label}:"] + [f"  {identifier}" for identifier in identifiers])


def print_batch_result(
    *,
    success_label: str,
    success_count: int,
    failed_label: str,
    result: BatchResult,
) -> int:
    """Print a standard batch command result and return the command exit code."""
    print(f"{success_label}: {success_count}")
    if result.failed_ids:
        print(format_id_lines(failed_label, result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


def format_note_summary(note: object) -> str:
    """Render a note as a single-line summary for CLI output."""
    created_at = getattr(note, "created_at", None)
    deleted_at = getattr(note, "deleted_at", None)
    content = getattr(note, "content", "")
    task = getattr(note, "task", None)
    people = getattr(note, "people", []) or []
    timelogs = getattr(note, "timelogs", []) or []
    normalized_content = " ".join(str(content).split())
    if len(normalized_content) > 80:
        normalized_content = f"{normalized_content[:77]}..."
    created_label = format_timestamp(created_at)
    status = "deleted" if deleted_at is not None else "active"
    task_id = getattr(task, "id", "-") if task is not None else "-"
    note_id = getattr(note, "id", "-")
    return (
        f"{note_id}\t{status}\t{created_label}\t{task_id}\t"
        f"{len(people)}\t{len(timelogs)}\t{normalized_content}"
    )


def format_note_detail(note: object) -> str:
    """Render a note with full metadata and multi-line content."""
    created_at = getattr(note, "created_at", None)
    updated_at = getattr(note, "updated_at", None)
    deleted_at = getattr(note, "deleted_at", None)
    task = getattr(note, "task", None)
    people = getattr(note, "people", []) or []
    timelogs = getattr(note, "timelogs", []) or []
    status = "deleted" if deleted_at is not None else "active"
    people_names = ", ".join(
        getattr(person, "name", str(getattr(person, "id", person))) for person in people
    )
    task_label = "-"
    if task is not None:
        task_id = getattr(task, "id", "-")
        task_content = getattr(task, "content", "-")
        task_label = f"{task_id} | {task_content}"
    timelog_labels = ", ".join(
        f"{getattr(timelog, 'id', '-')} | {getattr(timelog, 'title', '-')}" for timelog in timelogs
    )
    lines = [
        f"id: {getattr(note, 'id', '-')}",
        f"status: {status}",
        f"created_at: {format_timestamp(created_at)}",
        f"updated_at: {format_timestamp(updated_at)}",
        f"deleted_at: {format_timestamp(deleted_at)}",
        f"task: {task_label}",
        f"people: {people_names or '-'}",
        f"timelogs: {timelog_labels or '-'}",
        "content:",
        str(getattr(note, "content", "")),
    ]
    return "\n".join(lines)
