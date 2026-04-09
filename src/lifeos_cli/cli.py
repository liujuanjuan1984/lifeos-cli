"""CLI entrypoint for the lifeos_cli package."""

from __future__ import annotations

import argparse
import asyncio
import sys
from collections.abc import Callable, Coroutine, Sequence
from dataclasses import dataclass
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


@dataclass(frozen=True)
class HelpContent:
    """Structured help content for CLI parsers."""

    summary: str
    description: str
    examples: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()


def _build_epilog(*, examples: tuple[str, ...] = (), notes: tuple[str, ...] = ()) -> str | None:
    """Build an argparse epilog from structured examples and notes."""
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


def _make_help_handler(parser: argparse.ArgumentParser) -> Callable[[argparse.Namespace], int]:
    """Return a handler that prints parser help for resource-level commands."""

    def _handler(_: argparse.Namespace) -> int:
        parser.print_help()
        return 0

    return _handler


def _add_documented_parser(
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
        epilog=_build_epilog(examples=help_content.examples, notes=help_content.notes),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )


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
    note_parser = _add_documented_parser(
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
                'lifeos note add "Capture an idea"',
                "lifeos note list --limit 20",
                'lifeos note update 11111111-1111-1111-1111-111111111111 "Rewrite the note"',
                "lifeos note delete 11111111-1111-1111-1111-111111111111",
            ),
            notes=(
                "Resource names stay singular, such as note or timelog.",
                "Action names stay short verbs, such as add, list, update, and delete.",
                "The list command prints tab-separated columns: id, status, created_at, content.",
                "Delete performs a soft delete by default. Use --hard for permanent removal.",
            ),
        ),
    )
    note_parser.set_defaults(handler=_make_help_handler(note_parser))
    note_subparsers = note_parser.add_subparsers(
        dest="note_command",
        title="actions",
        metavar="action",
    )

    add_parser = _add_documented_parser(
        note_subparsers,
        "add",
        help_content=HelpContent(
            summary="Create a note",
            description=(
                "Create a new note from the provided content.\n\n"
                "Use this action to capture short thoughts, prompts, or raw text before\n"
                "they are linked to other domains such as tasks or people."
            ),
            examples=(
                'lifeos note add "Capture the sprint retrospective idea"',
                'lifeos note add "Review the monthly budget assumptions"',
            ),
            notes=("Wrap content in quotes when it contains spaces.",),
        ),
    )
    add_parser.add_argument("content", help="Note content")
    add_parser.set_defaults(handler=_handle_note_add)

    list_parser = _add_documented_parser(
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

    update_parser = _add_documented_parser(
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

    delete_parser = _add_documented_parser(
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


def build_parser() -> argparse.ArgumentParser:
    """Build the top-level CLI parser."""
    parser = argparse.ArgumentParser(
        prog="lifeos",
        description=(
            "Run LifeOS resource commands from the terminal.\n\n"
            "Command grammar:\n"
            "  lifeos <resource> <action> [arguments] [options]\n\n"
            "Resources model domains such as notes or future timelog workflows.\n"
            "Actions are short verbs that operate on records within a resource."
        ),
        epilog=_build_epilog(
            examples=(
                "lifeos note --help",
                'lifeos note add "Capture an idea"',
                "lifeos note list --limit 20",
            ),
            notes=(
                "Keep resource names singular so new command families stay consistent.",
                "Prefer short action verbs such as add, list, update, and delete.",
                "Each resource help page should explain scope, actions, and examples.",
            ),
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {get_version()}",
    )
    subparsers = parser.add_subparsers(dest="resource", title="resources", metavar="resource")
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
