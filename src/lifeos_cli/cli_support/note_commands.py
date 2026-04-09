"""Note resource CLI commands."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from uuid import UUID

from lifeos_cli.cli_support.shared import (
    HelpContent,
    add_documented_parser,
    format_note_detail,
    format_note_id_lines,
    format_note_summary,
    make_help_handler,
    run_async,
)
from lifeos_cli.config import ConfigurationError


def _resolve_note_content(args: argparse.Namespace) -> str:
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
            raise ConfigurationError(f"Could not read note content from {args.file}: {exc}") from exc
    else:
        content = args.content
    normalized = content.rstrip("\n")
    if not normalized.strip():
        raise ConfigurationError("Note content must not be empty.")
    return normalized


async def _handle_note_add_async(args: argparse.Namespace) -> int:
    """Create a new note."""
    from lifeos_cli.db.services import create_note
    from lifeos_cli.db.session import session_scope

    content = _resolve_note_content(args)
    async with session_scope() as session:
        note = await create_note(session, content=content)
    print(f"Created note {note.id}")
    return 0


def _handle_note_add(args: argparse.Namespace) -> int:
    """Create a new note."""
    return run_async(_handle_note_add_async(args))


async def _handle_note_list_async(args: argparse.Namespace) -> int:
    """List notes."""
    from lifeos_cli.db.services import list_notes
    from lifeos_cli.db.session import session_scope

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


def _handle_note_list(args: argparse.Namespace) -> int:
    """List notes."""
    return run_async(_handle_note_list_async(args))


async def _handle_note_search_async(args: argparse.Namespace) -> int:
    """Search notes by keyword tokens."""
    from lifeos_cli.db.services import search_notes
    from lifeos_cli.db.session import session_scope

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


def _handle_note_search(args: argparse.Namespace) -> int:
    """Search notes by keyword tokens."""
    return run_async(_handle_note_search_async(args))


async def _handle_note_show_async(args: argparse.Namespace) -> int:
    """Show a note with full content."""
    from lifeos_cli.db.services import get_note
    from lifeos_cli.db.session import session_scope

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


def _handle_note_show(args: argparse.Namespace) -> int:
    """Show a note with full content."""
    return run_async(_handle_note_show_async(args))


async def _handle_note_update_async(args: argparse.Namespace) -> int:
    """Update note content."""
    from lifeos_cli.db.services import NoteNotFoundError, update_note
    from lifeos_cli.db.session import session_scope

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
    return run_async(_handle_note_update_async(args))


async def _handle_note_delete_async(args: argparse.Namespace) -> int:
    """Delete a note."""
    from lifeos_cli.db.services import NoteNotFoundError, delete_note
    from lifeos_cli.db.session import session_scope

    try:
        async with session_scope() as session:
            await delete_note(session, note_id=args.note_id, hard_delete=args.hard)
    except NoteNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    print(f"{'Deleted' if args.hard else 'Soft-deleted'} note {args.note_id}")
    return 0


def _handle_note_delete(args: argparse.Namespace) -> int:
    """Delete a note."""
    return run_async(_handle_note_delete_async(args))


async def _handle_note_batch_update_content_async(args: argparse.Namespace) -> int:
    """Apply a batch content replacement across notes."""
    from lifeos_cli.db.services import batch_update_note_content
    from lifeos_cli.db.session import session_scope

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
        print(format_note_id_lines("Unchanged note IDs", result.unchanged_ids))
    if result.failed_ids:
        print(format_note_id_lines("Failed note IDs", result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


def _handle_note_batch_update_content(args: argparse.Namespace) -> int:
    """Apply a batch content replacement across notes."""
    return run_async(_handle_note_batch_update_content_async(args))


async def _handle_note_batch_delete_async(args: argparse.Namespace) -> int:
    """Delete multiple notes in one command."""
    from lifeos_cli.db.services import batch_delete_notes
    from lifeos_cli.db.session import session_scope

    async with session_scope() as session:
        result = await batch_delete_notes(
            session,
            note_ids=list(args.note_ids),
            hard_delete=args.hard,
        )

    print(f"Deleted notes: {result.deleted_count}")
    if result.failed_ids:
        print(format_note_id_lines("Failed note IDs", result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


def _handle_note_batch_delete(args: argparse.Namespace) -> int:
    """Delete multiple notes in one command."""
    return run_async(_handle_note_batch_delete_async(args))


def build_note_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the note command tree."""
    note_parser = add_documented_parser(
        subparsers,
        "note",
        help_content=HelpContent(
            summary="Capture and manage notes",
            description=(
                "Create, inspect, update, and delete note records.\n\n"
                "The note resource is the reference command family for LifeOS.\n"
                "Future resources should follow the same command grammar:\n"
                "  lifeos <resource> <action> [arguments] [options]"
            ),
            examples=(
                "lifeos init",
                'lifeos note add "Capture an idea"',
                "lifeos note list --limit 20",
                'lifeos note search "sprint retrospective"',
                "lifeos note show 11111111-1111-1111-1111-111111111111",
                "lifeos note batch update-content --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222 "
                '--find-text "draft" --replace-text "final"',
                'lifeos note update 11111111-1111-1111-1111-111111111111 "Rewrite the note"',
                "lifeos note delete 11111111-1111-1111-1111-111111111111",
            ),
            notes=(
                "Run `lifeos init` before using note commands for the first time.",
                "Resource names stay singular, such as note or timelog.",
                "Action names stay short verbs, such as add, list, update, and delete.",
                "Use the `batch` namespace when one command operates on multiple note records.",
                "The list command prints tab-separated columns: id, status, created_at, content.",
                "Use `show` to inspect the full note body with preserved line breaks.",
                "Delete performs a soft delete by default. Use --hard for permanent removal.",
            ),
        ),
    )
    note_parser.set_defaults(handler=make_help_handler(note_parser))
    note_subparsers = note_parser.add_subparsers(dest="note_command", title="actions", metavar="action")

    add_parser = add_documented_parser(
        note_subparsers,
        "add",
        help_content=HelpContent(
            summary="Create a note",
            description=(
                "Create a new note from inline text, stdin, or a file.\n\n"
                "Use this action to capture short thoughts, prompts, or raw text before\n"
                "they are linked to other domains such as tasks or people."
            ),
            examples=(
                "lifeos init",
                'lifeos note add "Capture the sprint retrospective idea"',
                "printf 'line one\\nline two\\n' | lifeos note add --stdin",
                "lifeos note add --file ./note.md",
                'lifeos note add "Review the monthly budget assumptions"',
            ),
            notes=(
                "Wrap inline content in quotes when it contains spaces.",
                "Use `--stdin` or `--file` for multi-line note content.",
            ),
        ),
    )
    add_parser.add_argument("content", nargs="?", help="Inline note content")
    add_parser.add_argument("--stdin", action="store_true", help="Read note content from standard input")
    add_parser.add_argument("--file", help="Read note content from a UTF-8 text file")
    add_parser.set_defaults(handler=_handle_note_add)

    list_parser = add_documented_parser(
        note_subparsers,
        "list",
        help_content=HelpContent(
            summary="List notes",
            description=(
                "List notes in reverse creation order.\n\n"
                "The output is tab-separated and currently includes: id, status,\n"
                "created_at, and a normalized content preview."
            ),
            examples=(
                "lifeos note list",
                "lifeos note list --limit 20 --offset 20",
                "lifeos note list --include-deleted",
            ),
            notes=(
                "Use --include-deleted when reviewing soft-deleted records.",
                "Use --limit and --offset together for pagination.",
            ),
        ),
    )
    list_parser.add_argument("--include-deleted", action="store_true", help="Include soft-deleted notes")
    list_parser.add_argument("--limit", type=int, default=100, help="Maximum number of notes to return")
    list_parser.add_argument("--offset", type=int, default=0, help="Number of notes to skip before listing")
    list_parser.set_defaults(handler=_handle_note_list)

    search_parser = add_documented_parser(
        note_subparsers,
        "search",
        help_content=HelpContent(
            summary="Search notes",
            description=(
                "Search notes by keyword tokens.\n\n"
                "The current implementation uses a PostgreSQL-backed ILIKE token search.\n"
                "Each token is matched against note content, and any matching token keeps\n"
                "the note in the result set."
            ),
            examples=(
                'lifeos note search "meeting notes"',
                'lifeos note search "budget q2" --limit 20',
                'lifeos note search "archived idea" --include-deleted',
            ),
            notes=(
                "Results use the same summary format as `lifeos note list`.",
                "Multi-word queries are split into tokens and matched with OR semantics.",
            ),
        ),
    )
    search_parser.add_argument("query", help="Search query string")
    search_parser.add_argument(
        "--include-deleted",
        action="store_true",
        help="Include soft-deleted notes in the search scope",
    )
    search_parser.add_argument("--limit", type=int, default=100, help="Maximum number of matching notes to return")
    search_parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Number of matching notes to skip before printing results",
    )
    search_parser.set_defaults(handler=_handle_note_search)

    show_parser = add_documented_parser(
        note_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show full note content",
            description=(
                "Show a single note with full metadata and the original content body.\n\n"
                "Use this action when you need to inspect preserved line breaks instead of the "
                "single-line summary from `note list`."
            ),
            examples=(
                "lifeos note show 11111111-1111-1111-1111-111111111111",
                "lifeos note show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
            notes=("Use `--include-deleted` to inspect a soft-deleted note.",),
        ),
    )
    show_parser.add_argument("note_id", type=UUID, help="Note identifier")
    show_parser.add_argument("--include-deleted", action="store_true", help="Allow loading a soft-deleted note")
    show_parser.set_defaults(handler=_handle_note_show)

    update_parser = add_documented_parser(
        note_subparsers,
        "update",
        help_content=HelpContent(
            summary="Replace note content",
            description=(
                "Replace the full content of an existing note.\n\n"
                "This action updates the current note body in place. It does not apply\n"
                "partial patches or keep revision history yet."
            ),
            examples=(
                'lifeos note update 11111111-1111-1111-1111-111111111111 "Rewrite the note"',
            ),
        ),
    )
    update_parser.add_argument("note_id", type=UUID, help="Note identifier")
    update_parser.add_argument("content", help="Replacement note content")
    update_parser.set_defaults(handler=_handle_note_update)

    delete_parser = add_documented_parser(
        note_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete a note",
            description=(
                "Delete a note by identifier.\n\n"
                "By default the note is soft-deleted so it can remain visible in audit\n"
                "or recovery flows. Use --hard to remove it permanently."
            ),
            examples=(
                "lifeos note delete 11111111-1111-1111-1111-111111111111",
                "lifeos note delete 11111111-1111-1111-1111-111111111111 --hard",
            ),
        ),
    )
    delete_parser.add_argument("note_id", type=UUID, help="Note identifier")
    delete_parser.add_argument(
        "--hard",
        action="store_true",
        help="Permanently delete the note instead of soft-deleting it",
    )
    delete_parser.set_defaults(handler=_handle_note_delete)

    batch_parser = add_documented_parser(
        note_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch note operations",
            description=(
                "Run operations that target multiple notes in a single command.\n\n"
                "Use this namespace for bulk workflows so the CLI keeps a stable shape as\n"
                "new note capabilities are introduced."
            ),
            examples=(
                "lifeos note batch update-content --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222 "
                '--find-text "draft" --replace-text "final"',
                "lifeos note batch delete --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222",
            ),
            notes=(
                "Batch commands currently accept note IDs directly.",
                "Future note batch operations should be added under this namespace.",
            ),
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="note_batch_command",
        title="operations",
        metavar="operation",
    )

    batch_update_parser = add_documented_parser(
        batch_subparsers,
        "update-content",
        help_content=HelpContent(
            summary="Find and replace note content in bulk",
            description=(
                "Apply a find/replace operation across multiple active notes.\n\n"
                "This is the first batch-editing primitive for notes and provides a base\n"
                "shape for future bulk operations."
            ),
            examples=(
                "lifeos note batch update-content --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222 "
                '--find-text "draft" --replace-text "final"',
                "lifeos note batch update-content --ids "
                "11111111-1111-1111-1111-111111111111 "
                '--find-text "TODO" --replace-text "DONE" --case-sensitive',
            ),
            notes=(
                "Only active notes are updated by this command.",
                "Failed note IDs are printed to stderr while successful updates stay on stdout.",
            ),
        ),
    )
    batch_update_parser.add_argument(
        "--ids",
        dest="note_ids",
        metavar="note-id",
        nargs="+",
        required=True,
        type=UUID,
        help="One or more note identifiers to update",
    )
    batch_update_parser.add_argument("--find-text", required=True, help="Text to find in each target note")
    batch_update_parser.add_argument(
        "--replace-text",
        default="",
        help="Replacement text for matched content",
    )
    batch_update_parser.add_argument(
        "--case-sensitive",
        action="store_true",
        help="Use a case-sensitive find/replace instead of case-insensitive matching",
    )
    batch_update_parser.set_defaults(handler=_handle_note_batch_update_content)

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete multiple notes",
            description=(
                "Delete multiple notes in one command.\n\n"
                "This command mirrors `lifeos note delete`, but works across many note IDs."
            ),
            examples=(
                "lifeos note batch delete --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222",
                "lifeos note batch delete --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222 --hard",
            ),
            notes=(
                "Soft delete is the default. Use --hard to remove records permanently.",
                "Failed note IDs are printed to stderr while successful deletes stay on stdout.",
            ),
        ),
    )
    batch_delete_parser.add_argument(
        "--ids",
        dest="note_ids",
        metavar="note-id",
        nargs="+",
        required=True,
        type=UUID,
        help="One or more note identifiers to delete",
    )
    batch_delete_parser.add_argument(
        "--hard",
        action="store_true",
        help="Permanently delete each note instead of soft-deleting it",
    )
    batch_delete_parser.set_defaults(handler=_handle_note_batch_delete)

