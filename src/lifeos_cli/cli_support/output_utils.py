"""CLI output formatting helpers."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol
from uuid import UUID

from lifeos_cli.application.time_preferences import to_preferred_timezone


class NoteSummary(Protocol):
    """Protocol for CLI note summary rendering."""

    @property
    def id(self) -> UUID: ...

    @property
    def content(self) -> str: ...

    @property
    def created_at(self) -> object | None: ...

    @property
    def deleted_at(self) -> object | None: ...


class NoteDetail(Protocol):
    """Protocol for detailed note rendering."""

    @property
    def id(self) -> UUID: ...

    @property
    def content(self) -> str: ...

    @property
    def created_at(self) -> object | None: ...

    @property
    def updated_at(self) -> object | None: ...

    @property
    def deleted_at(self) -> object | None: ...


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


def format_note_summary(note: NoteSummary) -> str:
    """Render a note as a single-line summary for CLI output."""
    created_at = getattr(note, "created_at", None)
    deleted_at = getattr(note, "deleted_at", None)
    content = getattr(note, "content", "")
    normalized_content = " ".join(str(content).split())
    if len(normalized_content) > 80:
        normalized_content = f"{normalized_content[:77]}..."
    created_label = format_timestamp(created_at)
    status = "deleted" if deleted_at is not None else "active"
    return f"{note.id}\t{status}\t{created_label}\t{normalized_content}"


def format_note_detail(note: NoteDetail) -> str:
    """Render a note with full metadata and multi-line content."""
    created_at = getattr(note, "created_at", None)
    updated_at = getattr(note, "updated_at", None)
    deleted_at = getattr(note, "deleted_at", None)
    status = "deleted" if deleted_at is not None else "active"
    lines = [
        f"id: {note.id}",
        f"status: {status}",
        f"created_at: {format_timestamp(created_at)}",
        f"updated_at: {format_timestamp(updated_at)}",
        f"deleted_at: {format_timestamp(deleted_at)}",
        "content:",
        str(getattr(note, "content", "")),
    ]
    return "\n".join(lines)
