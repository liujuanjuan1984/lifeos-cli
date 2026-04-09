"""CLI entrypoint for the lifeos_cli package."""

from __future__ import annotations

import argparse
import asyncio
import sys
from collections.abc import Coroutine, Sequence
from importlib.metadata import PackageNotFoundError, version
from typing import Protocol
from uuid import UUID

from lifeos_cli.db.services import (
    NoteNotFoundError,
    create_note,
    delete_note,
    list_notes,
    update_note,
)
from lifeos_cli.db.session import session_scope


class NoteSummary(Protocol):
    """Protocol for CLI note rendering."""

    @property
    def id(self) -> UUID: ...

    @property
    def content(self) -> str: ...

    @property
    def created_at(self) -> object | None: ...

    @property
    def deleted_at(self) -> object | None: ...


def _format_note_summary(note: NoteSummary) -> str:
    """Render a note as a single-line summary for CLI output."""
    note_id = note.id
    created_at = getattr(note, "created_at", None)
    deleted_at = getattr(note, "deleted_at", None)
    content = getattr(note, "content", "")
    normalized_content = " ".join(str(content).split())
    if len(normalized_content) > 80:
        normalized_content = f"{normalized_content[:77]}..."
    created_label = created_at.isoformat() if created_at is not None else "-"
    status = "deleted" if deleted_at is not None else "active"
    return f"{note_id}\t{status}\t{created_label}\t{normalized_content}"


def _run_async(operation: Coroutine[object, object, int]) -> int:
    """Run an async CLI operation from the synchronous CLI entrypoint."""
    return int(asyncio.run(operation))


async def _handle_note_add_async(args: argparse.Namespace) -> int:
    """Create a new note."""
    async with session_scope() as session:
        note = await create_note(session, content=args.content)
    print(f"Created note {note.id}")
    return 0


def _handle_note_add(args: argparse.Namespace) -> int:
    """Create a new note."""
    return _run_async(_handle_note_add_async(args))


async def _handle_note_list_async(args: argparse.Namespace) -> int:
    """List notes."""
    async with session_scope() as session:
        notes = await list_notes(
            session,
            include_deleted=args.include_deleted,
            limit=args.limit,
            offset=args.offset,
        )
    if not notes:
        print("No notes found.")
        return 0
    for note in notes:
        print(_format_note_summary(note))
    return 0


def _handle_note_list(args: argparse.Namespace) -> int:
    """List notes."""
    return _run_async(_handle_note_list_async(args))


async def _handle_note_update_async(args: argparse.Namespace) -> int:
    """Update note content."""
    try:
        async with session_scope() as session:
            note = await update_note(session, note_id=args.note_id, content=args.content)
    except NoteNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"Updated note {note.id}")
    return 0


def _handle_note_update(args: argparse.Namespace) -> int:
    """Update note content."""
    return _run_async(_handle_note_update_async(args))


async def _handle_note_delete_async(args: argparse.Namespace) -> int:
    """Delete a note."""
    try:
        async with session_scope() as session:
            await delete_note(session, note_id=args.note_id, hard_delete=args.hard)
    except NoteNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    if args.hard:
        print(f"Deleted note {args.note_id}")
    else:
        print(f"Soft-deleted note {args.note_id}")
    return 0


def _handle_note_delete(args: argparse.Namespace) -> int:
    """Delete a note."""
    return _run_async(_handle_note_delete_async(args))


def _build_note_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the note command tree."""
    note_parser = subparsers.add_parser("note", help="Manage notes")
    note_subparsers = note_parser.add_subparsers(dest="note_command", required=True)

    add_parser = note_subparsers.add_parser("add", help="Create a note")
    add_parser.add_argument("content", help="Note content")
    add_parser.set_defaults(handler=_handle_note_add)

    list_parser = note_subparsers.add_parser("list", help="List notes")
    list_parser.add_argument(
        "--include-deleted",
        action="store_true",
        help="Include soft-deleted notes",
    )
    list_parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Maximum number of notes to return",
    )
    list_parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Number of notes to skip before listing",
    )
    list_parser.set_defaults(handler=_handle_note_list)

    update_parser = note_subparsers.add_parser("update", help="Update a note")
    update_parser.add_argument("note_id", type=UUID, help="Note identifier")
    update_parser.add_argument("content", help="Replacement note content")
    update_parser.set_defaults(handler=_handle_note_update)

    delete_parser = note_subparsers.add_parser("delete", help="Delete a note")
    delete_parser.add_argument("note_id", type=UUID, help="Note identifier")
    delete_parser.add_argument(
        "--hard",
        action="store_true",
        help="Permanently delete the note instead of soft-deleting it",
    )
    delete_parser.set_defaults(handler=_handle_note_delete)


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level CLI parser."""
    parser = argparse.ArgumentParser(prog="lifeos", description="LifeOS command-line interface")
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {get_version()}",
    )
    subparsers = parser.add_subparsers(dest="resource")
    _build_note_parser(subparsers)
    return parser


def get_version() -> str:
    """Return the installed distribution version when available."""
    try:
        return version("lifeos-cli")
    except PackageNotFoundError:
        return "0+unknown"


def main(argv: Sequence[str] | None = None) -> int:
    """Run the CLI."""
    parser = build_parser()
    args = parser.parse_args(argv)
    handler = getattr(args, "handler", None)
    if handler is None:
        parser.print_help()
        return 0
    return int(handler(args))
