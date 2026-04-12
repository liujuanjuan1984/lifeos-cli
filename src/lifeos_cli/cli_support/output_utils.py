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
    tags = getattr(note, "tags", []) or []
    people = getattr(note, "people", []) or []
    tasks = getattr(note, "tasks", []) or []
    visions = getattr(note, "visions", []) or []
    events = getattr(note, "events", []) or []
    timelogs = getattr(note, "timelogs", []) or []
    normalized_content = " ".join(str(content).split())
    if len(normalized_content) > 80:
        normalized_content = f"{normalized_content[:77]}..."
    created_label = format_timestamp(created_at)
    status = "deleted" if deleted_at is not None else "active"
    note_id = getattr(note, "id", "-")
    return (
        f"{note_id}\t{status}\t{created_label}\t{len(tasks)}\t{len(visions)}\t"
        f"{len(events)}\t{len(people)}\t{len(timelogs)}\t{len(tags)}\t{normalized_content}"
    )


def format_note_detail(note: object) -> str:
    """Render a note with full metadata and multi-line content."""
    created_at = getattr(note, "created_at", None)
    updated_at = getattr(note, "updated_at", None)
    deleted_at = getattr(note, "deleted_at", None)
    tags = getattr(note, "tags", []) or []
    people = getattr(note, "people", []) or []
    tasks = getattr(note, "tasks", []) or []
    visions = getattr(note, "visions", []) or []
    events = getattr(note, "events", []) or []
    timelogs = getattr(note, "timelogs", []) or []
    status = "deleted" if deleted_at is not None else "active"
    tag_names = ", ".join(getattr(tag, "name", str(getattr(tag, "id", tag))) for tag in tags)
    people_names = ", ".join(
        getattr(person, "name", str(getattr(person, "id", person))) for person in people
    )
    task_labels = ", ".join(
        f"{getattr(task, 'id', '-')} | {getattr(task, 'content', '-')}" for task in tasks
    )
    vision_labels = ", ".join(
        f"{getattr(vision, 'id', '-')} | {getattr(vision, 'name', '-')}" for vision in visions
    )
    event_labels = ", ".join(
        f"{getattr(event, 'id', '-')} | {getattr(event, 'title', '-')}" for event in events
    )
    timelog_labels = ", ".join(
        f"{getattr(timelog, 'id', '-')} | {getattr(timelog, 'title', '-')}" for timelog in timelogs
    )
    lines = [
        f"id: {getattr(note, 'id', '-')}",
        f"status: {status}",
        f"created_at: {format_timestamp(created_at)}",
        f"updated_at: {format_timestamp(updated_at)}",
        f"deleted_at: {format_timestamp(deleted_at)}",
        f"tags: {tag_names or '-'}",
        f"tasks: {task_labels or '-'}",
        f"visions: {vision_labels or '-'}",
        f"events: {event_labels or '-'}",
        f"people: {people_names or '-'}",
        f"timelogs: {timelog_labels or '-'}",
        "content:",
        str(getattr(note, "content", "")),
    ]
    return "\n".join(lines)
