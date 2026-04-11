"""Builder helpers for note subcommands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.parser_common import (
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.note.handlers import (
    handle_note_add,
    handle_note_batch_delete,
    handle_note_batch_update_content,
    handle_note_delete,
    handle_note_list,
    handle_note_search,
    handle_note_show,
    handle_note_update,
)


def build_note_add_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    add_parser = add_documented_parser(
        note_subparsers,
        "add",
        help_content=HelpContent(
            summary="Create a note",
            description=(
                "Create a new note from inline text, stdin, or a file.\n\n"
                "Use this action to capture short thoughts, prompts, or raw text before\n"
                "they are linked to other domains such as tasks, people, or timelogs."
            ),
            examples=(
                "lifeos init",
                'lifeos note add "Capture the sprint retrospective idea"',
                "printf 'line one\\nline two\\n' | lifeos note add --stdin",
                "lifeos note add --file ./note.md",
                'lifeos note add "Review the monthly budget assumptions" --task-id <task-id>',
            ),
            notes=(
                "Wrap inline content in quotes when it contains spaces.",
                "Use `--stdin` or `--file` for multi-line note content.",
                "Repeat `--person-id` and `--timelog-id` to link multiple records.",
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
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to associate one or more people",
    )
    add_parser.add_argument("--task-id", type=UUID, help="Associate one task")
    add_parser.add_argument(
        "--timelog-id",
        dest="timelog_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to associate one or more timelogs",
    )
    add_parser.set_defaults(handler=handle_note_add)


def build_note_list_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    list_parser = add_documented_parser(
        note_subparsers,
        "list",
        help_content=HelpContent(
            summary="List notes",
            description=(
                "List notes in reverse creation order.\n\n"
                "The output is tab-separated and currently includes: id, status,\n"
                "created_at, task_id, people_count, timelog_count, and a normalized "
                "content preview."
            ),
            examples=(
                "lifeos note list",
                "lifeos note list --person-id <person-id>",
                "lifeos note list --timelog-id <timelog-id>",
                "lifeos note list --limit 20 --offset 20",
                "lifeos note list --include-deleted",
            ),
            notes=(
                "Use --include-deleted when reviewing soft-deleted records.",
                "Use --limit and --offset together for pagination.",
            ),
        ),
    )
    list_parser.add_argument("--person-id", type=UUID, help="Filter by linked person")
    list_parser.add_argument("--task-id", type=UUID, help="Filter by linked task")
    list_parser.add_argument("--timelog-id", type=UUID, help="Filter by linked timelog")
    add_include_deleted_argument(list_parser, noun="notes")
    add_limit_offset_arguments(list_parser, row_noun="notes")
    list_parser.set_defaults(handler=handle_note_list)


def build_note_search_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
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
                'lifeos note search "review" --task-id <task-id>',
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
    search_parser.add_argument("--person-id", type=UUID, help="Filter by linked person")
    search_parser.add_argument("--task-id", type=UUID, help="Filter by linked task")
    search_parser.add_argument("--timelog-id", type=UUID, help="Filter by linked timelog")
    add_include_deleted_argument(search_parser, noun="notes in the search scope")
    add_limit_offset_arguments(search_parser, row_noun="matching notes")
    search_parser.set_defaults(handler=handle_note_search)


def build_note_show_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
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
    add_include_deleted_argument(show_parser, noun="notes", help_prefix="Allow loading")
    show_parser.set_defaults(handler=handle_note_show)


def build_note_update_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    update_parser = add_documented_parser(
        note_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update a note",
            description=(
                "Update note content and weak associations in place.\n\n"
                "Omitted fields remain unchanged. Use `--clear-*` flags to remove links."
            ),
            examples=(
                'lifeos note update 11111111-1111-1111-1111-111111111111 "Rewrite the note"',
                "lifeos note update 11111111-1111-1111-1111-111111111111 --task-id <task-id>",
                "lifeos note update 11111111-1111-1111-1111-111111111111 --clear-timelogs",
            ),
            notes=(
                "Repeat `--person-id` and `--timelog-id` to replace linked records.",
                "Use relation flags without `content` when only links need to change.",
            ),
        ),
    )
    update_parser.add_argument("note_id", type=UUID, help="Note identifier")
    update_parser.add_argument("content", nargs="?", help="Replacement note content")
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to replace people with one or more identifiers",
    )
    update_parser.add_argument("--clear-people", action="store_true", help="Remove all people")
    update_parser.add_argument("--task-id", type=UUID, help="Replace the linked task")
    update_parser.add_argument("--clear-task", action="store_true", help="Remove the linked task")
    update_parser.add_argument(
        "--timelog-id",
        dest="timelog_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to replace timelogs with one or more identifiers",
    )
    update_parser.add_argument(
        "--clear-timelogs",
        action="store_true",
        help="Remove all linked timelogs",
    )
    update_parser.set_defaults(handler=handle_note_update)


def build_note_delete_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    delete_parser = add_documented_parser(
        note_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete a note",
            description=(
                "Delete a note by identifier.\n\n"
                "By default the note is soft-deleted so it can remain visible in audit\n"
                "or recovery flows."
            ),
            examples=("lifeos note delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("note_id", type=UUID, help="Note identifier")
    delete_parser.set_defaults(handler=handle_note_delete)


def build_note_batch_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
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
        "--find-text", required=True, help="Text to find in each target note"
    )
    batch_update_parser.add_argument(
        "--replace-text", default="", help="Replacement text for matched content"
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
            ),
            notes=(
                "CLI batch delete performs soft deletion only.",
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
    batch_delete_parser.set_defaults(handler=handle_note_batch_delete)
