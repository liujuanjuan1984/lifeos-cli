"""Async note command handlers and note input helpers."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from lifeos_cli.cli_support.output_utils import (
    NOTE_SUMMARY_COLUMNS,
    format_id_lines,
    format_note_detail,
    format_note_summary,
    print_batch_result,
    print_summary_rows,
)
from lifeos_cli.cli_support.runtime_utils import run_async
from lifeos_cli.config import ConfigurationError
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import notes as note_services


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
    try:
        async with db_session.session_scope() as session:
            if (
                args.tag_ids is None
                and args.person_ids is None
                and args.task_ids is None
                and args.vision_ids is None
                and args.event_ids is None
                and args.timelog_ids is None
            ):
                note = await note_services.create_note(session, content=content)
            else:
                note = await note_services.create_note(
                    session,
                    content=content,
                    tag_ids=args.tag_ids,
                    person_ids=args.person_ids,
                    task_ids=args.task_ids,
                    vision_ids=args.vision_ids,
                    event_ids=args.event_ids,
                    timelog_ids=args.timelog_ids,
                )
    except (LookupError, note_services.NoteValidationError) as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"Created note {note.id}")
    return 0


def handle_note_add(args: argparse.Namespace) -> int:
    """Create a new note."""
    return run_async(handle_note_add_async(args))


async def handle_note_list_async(args: argparse.Namespace) -> int:
    """List notes."""
    async with db_session.session_scope() as session:
        if (
            args.tag_id is None
            and args.event_id is None
            and args.person_id is None
            and args.task_id is None
            and args.timelog_id is None
            and args.vision_id is None
        ):
            notes = await note_services.list_notes(
                session,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        else:
            notes = await note_services.list_notes(
                session,
                include_deleted=args.include_deleted,
                tag_id=args.tag_id,
                event_id=args.event_id,
                person_id=args.person_id,
                task_id=args.task_id,
                timelog_id=args.timelog_id,
                vision_id=args.vision_id,
                limit=args.limit,
                offset=args.offset,
            )
    print_summary_rows(
        items=notes,
        columns=NOTE_SUMMARY_COLUMNS,
        row_formatter=format_note_summary,
        empty_message="No notes found.",
    )
    return 0


def handle_note_list(args: argparse.Namespace) -> int:
    """List notes."""
    return run_async(handle_note_list_async(args))


async def handle_note_search_async(args: argparse.Namespace) -> int:
    """Search notes by keyword tokens."""
    normalized_query = args.query.strip()
    if not normalized_query:
        raise ConfigurationError("Search query must not be empty.")

    async with db_session.session_scope() as session:
        if (
            args.tag_id is None
            and args.event_id is None
            and args.person_id is None
            and args.task_id is None
            and args.timelog_id is None
            and args.vision_id is None
        ):
            notes = await note_services.search_notes(
                session,
                query=normalized_query,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        else:
            notes = await note_services.search_notes(
                session,
                query=normalized_query,
                include_deleted=args.include_deleted,
                tag_id=args.tag_id,
                event_id=args.event_id,
                person_id=args.person_id,
                task_id=args.task_id,
                timelog_id=args.timelog_id,
                vision_id=args.vision_id,
                limit=args.limit,
                offset=args.offset,
            )
    print_summary_rows(
        items=notes,
        columns=NOTE_SUMMARY_COLUMNS,
        row_formatter=format_note_summary,
        empty_message="No matching notes found.",
    )
    return 0


def handle_note_search(args: argparse.Namespace) -> int:
    """Search notes by keyword tokens."""
    return run_async(handle_note_search_async(args))


async def handle_note_show_async(args: argparse.Namespace) -> int:
    """Show a note with full content."""
    async with db_session.session_scope() as session:
        note = await note_services.get_note(
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
    conflicts = (
        (args.clear_tags and args.tag_ids is not None, "--tag-id", "--clear-tags"),
        (args.clear_people and args.person_ids is not None, "--person-id", "--clear-people"),
        (args.clear_tasks and args.task_ids is not None, "--task-id", "--clear-tasks"),
        (args.clear_visions and args.vision_ids is not None, "--vision-id", "--clear-visions"),
        (args.clear_events and args.event_ids is not None, "--event-id", "--clear-events"),
        (args.clear_timelogs and args.timelog_ids is not None, "--timelog-id", "--clear-timelogs"),
    )
    for is_conflict, value_flag, clear_flag in conflicts:
        if is_conflict:
            print(f"Use either {value_flag} or {clear_flag}, not both.", file=sys.stderr)
            return 1

    try:
        async with db_session.session_scope() as session:
            if (
                args.tag_ids is None
                and not args.clear_tags
                and args.person_ids is None
                and not args.clear_people
                and args.task_ids is None
                and not args.clear_tasks
                and args.vision_ids is None
                and not args.clear_visions
                and args.event_ids is None
                and not args.clear_events
                and args.timelog_ids is None
                and not args.clear_timelogs
            ):
                note = await note_services.update_note(
                    session,
                    note_id=args.note_id,
                    content=args.content,
                )
            else:
                note = await note_services.update_note(
                    session,
                    note_id=args.note_id,
                    content=args.content,
                    tag_ids=args.tag_ids,
                    clear_tags=args.clear_tags,
                    person_ids=args.person_ids,
                    clear_people=args.clear_people,
                    task_ids=args.task_ids,
                    clear_tasks=args.clear_tasks,
                    vision_ids=args.vision_ids,
                    clear_visions=args.clear_visions,
                    event_ids=args.event_ids,
                    clear_events=args.clear_events,
                    timelog_ids=args.timelog_ids,
                    clear_timelogs=args.clear_timelogs,
                )
    except (note_services.NoteNotFoundError, note_services.NoteValidationError, LookupError) as exc:
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
        async with db_session.session_scope() as session:
            await note_services.delete_note(session, note_id=args.note_id)
    except note_services.NoteNotFoundError as exc:
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

    async with db_session.session_scope() as session:
        result = await note_services.batch_update_note_content(
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
    async with db_session.session_scope() as session:
        result = await note_services.batch_delete_notes(
            session,
            note_ids=list(args.note_ids),
        )

    return print_batch_result(
        success_label="Deleted notes",
        success_count=result.deleted_count,
        failed_label="Failed note IDs",
        result=result,
    )


def handle_note_batch_delete(args: argparse.Namespace) -> int:
    """Delete multiple notes in one command."""
    return run_async(handle_note_batch_delete_async(args))
