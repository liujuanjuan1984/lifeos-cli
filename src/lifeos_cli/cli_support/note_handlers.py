"""Async note command handlers and note input helpers."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from lifeos_cli.cli_support.shared import (
    format_id_lines,
    format_note_detail,
    format_note_summary,
    run_async,
)
from lifeos_cli.config import ConfigurationError
from lifeos_cli.db.services import (
    NoteNotFoundError,
    batch_delete_notes,
    batch_update_note_content,
    create_note,
    delete_note,
    get_note,
    list_notes,
    search_notes,
    update_note,
)
from lifeos_cli.db.session import session_scope


def resolve_note_content(args: argparse.Namespace) -> str:
    """Resolve note content from inline text, stdin, or a file."""
    provided_sources = sum(
        1
        for candidate in (args.content is not None, args.stdin, args.file is not None)
        if candidate
    )
    if provided_sources != 1:
        raise ConfigurationError(
            "Provide note content with exactly one source: inline `content`, `--stdin`, or "
            "`--file`."
        )
    if args.stdin:
        content = sys.stdin.read()
    elif args.file is not None:
        try:
            content = Path(args.file).read_text(encoding="utf-8")
        except OSError as exc:
            raise ConfigurationError(
                f"Could not read note content from {args.file}: {exc}"
            ) from exc
    else:
        content = args.content
    normalized = content.rstrip("\n")
    if not normalized.strip():
        raise ConfigurationError("Note content must not be empty.")
    return normalized


async def handle_note_add_async(args: argparse.Namespace) -> int:
    """Create a new note."""
    content = resolve_note_content(args)
    async with session_scope() as session:
        note = await create_note(session, content=content)
    print(f"Created note {note.id}")
    return 0


def handle_note_add(args: argparse.Namespace) -> int:
    """Create a new note."""
    return run_async(handle_note_add_async(args))


async def handle_note_list_async(args: argparse.Namespace) -> int:
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
        print(format_note_summary(note))
    return 0


def handle_note_list(args: argparse.Namespace) -> int:
    """List notes."""
    return run_async(handle_note_list_async(args))


async def handle_note_search_async(args: argparse.Namespace) -> int:
    """Search notes by keyword tokens."""
    normalized_query = args.query.strip()
    if not normalized_query:
        raise ConfigurationError("Search query must not be empty.")

    async with session_scope() as session:
        notes = await search_notes(
            session,
            query=normalized_query,
            include_deleted=args.include_deleted,
            limit=args.limit,
            offset=args.offset,
        )
    if not notes:
        print("No matching notes found.")
        return 0
    for note in notes:
        print(format_note_summary(note))
    return 0


def handle_note_search(args: argparse.Namespace) -> int:
    """Search notes by keyword tokens."""
    return run_async(handle_note_search_async(args))


async def handle_note_show_async(args: argparse.Namespace) -> int:
    """Show a note with full content."""
    async with session_scope() as session:
        note = await get_note(
            session,
            note_id=args.note_id,
            include_deleted=args.include_deleted,
        )
    if note is None:
        print(f"Note {args.note_id} was not found", file=sys.stderr)
        return 1
    print(format_note_detail(note))
    return 0


def handle_note_show(args: argparse.Namespace) -> int:
    """Show a note with full content."""
    return run_async(handle_note_show_async(args))


async def handle_note_update_async(args: argparse.Namespace) -> int:
    """Update note content."""
    try:
        async with session_scope() as session:
            note = await update_note(session, note_id=args.note_id, content=args.content)
    except NoteNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"Updated note {note.id}")
    return 0


def handle_note_update(args: argparse.Namespace) -> int:
    """Update note content."""
    return run_async(handle_note_update_async(args))


async def handle_note_delete_async(args: argparse.Namespace) -> int:
    """Delete a note."""
    try:
        async with session_scope() as session:
            await delete_note(session, note_id=args.note_id)
    except NoteNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"Soft-deleted note {args.note_id}")
    return 0


def handle_note_delete(args: argparse.Namespace) -> int:
    """Delete a note."""
    return run_async(handle_note_delete_async(args))


async def handle_note_batch_update_content_async(args: argparse.Namespace) -> int:
    """Apply a batch content replacement across notes."""
    if not args.find_text.strip():
        raise ConfigurationError("Find text must not be empty.")

    async with session_scope() as session:
        result = await batch_update_note_content(
            session,
            note_ids=list(args.note_ids),
            find_text=args.find_text,
            replace_text=args.replace_text,
            case_sensitive=args.case_sensitive,
        )

    print(f"Updated notes: {result.updated_count}")
    print(f"Replacements applied: {result.replacement_count}")
    if result.unchanged_ids:
        print(format_id_lines("Unchanged note IDs", result.unchanged_ids))
    if result.failed_ids:
        print(format_id_lines("Failed note IDs", result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


def handle_note_batch_update_content(args: argparse.Namespace) -> int:
    """Apply a batch content replacement across notes."""
    return run_async(handle_note_batch_update_content_async(args))


async def handle_note_batch_delete_async(args: argparse.Namespace) -> int:
    """Delete multiple notes in one command."""
    async with session_scope() as session:
        result = await batch_delete_notes(
            session,
            note_ids=list(args.note_ids),
        )

    print(f"Deleted notes: {result.deleted_count}")
    if result.failed_ids:
        print(format_id_lines("Failed note IDs", result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


def handle_note_batch_delete(args: argparse.Namespace) -> int:
    """Delete multiple notes in one command."""
    return run_async(handle_note_batch_delete_async(args))
