"""Note resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.note_handlers import (
    handle_note_add,
    handle_note_batch_delete,
    handle_note_batch_update_content,
    handle_note_delete,
    handle_note_list,
    handle_note_search,
    handle_note_show,
    handle_note_update,
)
from lifeos_cli.cli_support.shared import HelpContent, add_documented_parser, make_help_handler


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
    note_subparsers = note_parser.add_subparsers(
        dest="note_command",
        title="actions",
        metavar="action",
    )

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
    add_parser.add_argument(
        "--stdin",
        action="store_true",
        help="Read note content from standard input",
    )
    add_parser.add_argument("--file", help="Read note content from a UTF-8 text file")
    add_parser.set_defaults(handler=handle_note_add)

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
    list_parser.set_defaults(handler=handle_note_list)

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
    search_parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Maximum number of matching notes to return",
    )
    search_parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Number of matching notes to skip before printing results",
    )
    search_parser.set_defaults(handler=handle_note_search)

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
    show_parser.add_argument(
        "--include-deleted",
        action="store_true",
        help="Allow loading a soft-deleted note",
    )
    show_parser.set_defaults(handler=handle_note_show)

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
    update_parser.set_defaults(handler=handle_note_update)

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
    delete_parser.set_defaults(handler=handle_note_delete)

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
    batch_update_parser.add_argument(
        "--find-text",
        required=True,
        help="Text to find in each target note",
    )
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
    batch_update_parser.set_defaults(handler=handle_note_batch_update_content)

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
    batch_delete_parser.set_defaults(handler=handle_note_batch_delete)

