"""Shared helpers for CLI formatting, parser wiring, and runtime errors."""

from __future__ import annotations

import argparse
import asyncio
import sys
from collections.abc import Callable, Coroutine, Sequence
from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from sqlalchemy.exc import OperationalError

from lifeos_cli.config import (
    ConfigurationError,
    DatabaseSettings,
    clear_config_cache,
    get_database_settings,
)


@dataclass(frozen=True)
class HelpContent:
    """Structured help content for CLI parsers."""

    summary: str
    description: str
    examples: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()


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


def build_epilog(*, examples: tuple[str, ...] = (), notes: tuple[str, ...] = ()) -> str | None:
    """Build an argparse epilog from examples and notes."""
    sections: list[str] = []
    if examples:
        example_lines = "\n".join(f"  {example}" for example in examples)
        sections.append(f"Examples:\n{example_lines}")
    if notes:
        note_lines = "\n".join(f"  {note}" for note in notes)
        sections.append(f"Notes:\n{note_lines}")
    if not sections:
        return None
    return "\n\n".join(sections)


def make_help_handler(parser: argparse.ArgumentParser) -> Callable[[argparse.Namespace], int]:
    """Return a handler that prints parser help for resource-level commands."""

    def _handler(_: argparse.Namespace) -> int:
        parser.print_help()
        return 0

    return _handler


def add_documented_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
    name: str,
    *,
    help_content: HelpContent,
) -> argparse.ArgumentParser:
    """Add a parser with structured description and examples."""
    return subparsers.add_parser(
        name,
        help=help_content.summary,
        description=help_content.description,
        epilog=build_epilog(examples=help_content.examples, notes=help_content.notes),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )


def format_note_summary(note: NoteSummary) -> str:
    """Render a note as a single-line summary for CLI output."""
    created_at = getattr(note, "created_at", None)
    deleted_at = getattr(note, "deleted_at", None)
    content = getattr(note, "content", "")
    normalized_content = " ".join(str(content).split())
    if len(normalized_content) > 80:
        normalized_content = f"{normalized_content[:77]}..."
    created_label = created_at.isoformat() if created_at is not None else "-"
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
        f"created_at: {created_at.isoformat() if created_at is not None else '-'}",
        f"updated_at: {updated_at.isoformat() if updated_at is not None else '-'}",
        f"deleted_at: {deleted_at.isoformat() if deleted_at is not None else '-'}",
        "content:",
        str(getattr(note, "content", "")),
    ]
    return "\n".join(lines)


def format_note_id_lines(label: str, note_ids: Sequence[UUID]) -> str:
    """Render a labeled list of note identifiers."""
    if not note_ids:
        return f"{label}: -"
    return "\n".join([f"{label}:"] + [f"  {note_id}" for note_id in note_ids])


def run_async(operation: Coroutine[object, object, int]) -> int:
    """Run an async CLI operation from the synchronous CLI entrypoint."""
    return int(asyncio.run(operation))


def refresh_runtime_configuration() -> None:
    """Clear cached configuration and session state in the current process."""
    clear_config_cache()
    from lifeos_cli.db.session import clear_session_cache

    clear_session_cache()


def format_config_summary(settings: DatabaseSettings, *, show_secrets: bool = False) -> str:
    """Render effective config values for display."""
    lines = [
        f"Config file: {settings.config_file}",
        f"Database URL: {settings.render_database_url(show_secrets=show_secrets)}",
        f"Database schema: {settings.database_schema}",
        f"Database echo: {'true' if settings.database_echo else 'false'}",
    ]
    return "\n".join(lines)


def print_database_runtime_error(exc: BaseException) -> int:
    """Render actionable database configuration or connectivity failures."""
    if isinstance(exc, ConfigurationError):
        print(str(exc), file=sys.stderr)
        return 1

    settings = get_database_settings()
    print("Database operation failed.", file=sys.stderr)
    print(
        f"Configured database URL: {settings.render_database_url(show_secrets=False)}",
        file=sys.stderr,
    )
    print(f"Configured schema: {settings.database_schema}", file=sys.stderr)
    guidance = None
    if isinstance(exc, OperationalError):
        details = str(exc).lower()
        if "no password supplied" in details or "password authentication failed" in details:
            guidance = (
                "Authentication failed. Check the username/password in the database URL, "
                "or update them with `lifeos init`."
            )
        elif "does not exist" in details:
            guidance = (
                "The configured PostgreSQL database does not exist yet. Create it first, "
                "then run `lifeos db upgrade`."
            )
        elif "connection refused" in details or "could not connect" in details:
            guidance = (
                "PostgreSQL is not reachable. Ensure the server is installed, running, "
                "and listening on the configured host/port."
            )
    if guidance is not None:
        print(guidance, file=sys.stderr)
    print("Run `lifeos init` to create or update local configuration.", file=sys.stderr)
    print(
        "Then run `lifeos db ping` to verify connectivity and `lifeos db upgrade` to apply "
        "migrations.",
        file=sys.stderr,
    )
    print(f"Original error: {exc}", file=sys.stderr)
    return 1
