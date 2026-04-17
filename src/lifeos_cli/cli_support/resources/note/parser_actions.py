"""Builder helpers for note subcommands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.output_utils import NOTE_SUMMARY_COLUMNS, format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.note.handlers import (
    handle_note_add_async,
    handle_note_batch_delete_async,
    handle_note_batch_update_content_async,
    handle_note_delete_async,
    handle_note_list_async,
    handle_note_search_async,
    handle_note_show_async,
    handle_note_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_note_add_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    add_parser = add_documented_parser(
        note_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create a note"),
            description=(
                _("Create a new note from inline text, stdin, or a file.")
                + "\n\n"
                + _(
                    "Use this action to capture short thoughts, prompts, or raw text before "
                    "they are linked to other domains such as tasks, people, or timelogs."
                )
            ),
            examples=(
                'lifeos note add "Capture the sprint retrospective idea"',
                "printf 'line one\\nline two\\n' | lifeos note add --stdin",
                "lifeos note add --file ./note.md",
                'lifeos note add "Review shared feedback" --tag-id <tag-id-1> --tag-id <tag-id-2>',
                'lifeos note add "Review the monthly budget assumptions" --task-id <task-id>',
                'lifeos note add "Prepare the partner sync agenda" --event-id <event-id>',
            ),
            notes=(
                _("Wrap inline content in quotes when it contains spaces."),
                _("Use `--stdin` or `--file` for multi-line note content."),
                _(
                    "Repeat the same relation flag to link multiple records of that type in one "
                    "command."
                ),
            ),
        ),
    )
    add_parser.add_argument("content", nargs="?", help=_("Inline note content"))
    add_parser.add_argument(
        "--stdin",
        action="store_true",
        help=_("Read note content from standard input"),
    )
    add_parser.add_argument("--file", help=_("Read note content from a UTF-8 text file"))
    add_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to associate one or more tags"),
    )
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to associate one or more people"),
    )
    add_parser.add_argument(
        "--task-id",
        dest="task_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to associate one or more tasks"),
    )
    add_parser.add_argument(
        "--vision-id",
        dest="vision_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to associate one or more visions"),
    )
    add_parser.add_argument(
        "--event-id",
        dest="event_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to associate one or more events"),
    )
    add_parser.add_argument(
        "--timelog-id",
        dest="timelog_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to associate one or more timelogs"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_note_add_async))


def build_note_list_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    list_parser = add_documented_parser(
        note_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List notes"),
            description=(
                _("List notes in reverse creation order.")
                + "\n\n"
                + _(
                    "When results exist, the list command prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(NOTE_SUMMARY_COLUMNS))
            ),
            examples=(
                "lifeos note list",
                "lifeos note list --tag-id <tag-id>",
                "lifeos note list --person-id <person-id>",
                "lifeos note list --event-id <event-id>",
                "lifeos note list --timelog-id <timelog-id>",
                "lifeos note list --limit 20 --offset 20",
                "lifeos note list --include-deleted",
            ),
            notes=(
                _("Use --include-deleted when reviewing soft-deleted records."),
                _("Use --limit and --offset together for pagination."),
            ),
        ),
    )
    list_parser.add_argument("--tag-id", type=UUID, help=_("Filter by linked tag"))
    list_parser.add_argument("--event-id", type=UUID, help=_("Filter by linked event"))
    list_parser.add_argument("--person-id", type=UUID, help=_("Filter by linked person"))
    list_parser.add_argument("--task-id", type=UUID, help=_("Filter by linked task"))
    list_parser.add_argument("--timelog-id", type=UUID, help=_("Filter by linked timelog"))
    list_parser.add_argument("--vision-id", type=UUID, help=_("Filter by linked vision"))
    add_include_deleted_argument(list_parser, noun="notes")
    add_limit_offset_arguments(list_parser, row_noun="notes")
    list_parser.set_defaults(handler=make_sync_handler(handle_note_list_async))


def build_note_search_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    search_parser = add_documented_parser(
        note_subparsers,
        "search",
        help_content=HelpContent(
            summary=_("Search notes"),
            description=(
                _("Search notes by keyword tokens.")
                + "\n\n"
                + _(
                    "The current implementation uses a PostgreSQL-backed ILIKE token search. "
                    "Each token is matched against note content, and any matching token keeps "
                    "the note in the result set."
                )
            ),
            examples=(
                'lifeos note search "meeting notes"',
                'lifeos note search "review" --task-id <task-id>',
                'lifeos note search "partner sync" --event-id <event-id>',
                'lifeos note search "budget q2" --limit 20',
                'lifeos note search "archived idea" --include-deleted',
            ),
            notes=(
                _("Results use the same summary format as `lifeos note list`."),
                _("Multi-word queries are split into tokens and matched with OR semantics."),
            ),
        ),
    )
    search_parser.add_argument("query", help=_("Search query string"))
    search_parser.add_argument("--tag-id", type=UUID, help=_("Filter by linked tag"))
    search_parser.add_argument("--event-id", type=UUID, help=_("Filter by linked event"))
    search_parser.add_argument("--person-id", type=UUID, help=_("Filter by linked person"))
    search_parser.add_argument("--task-id", type=UUID, help=_("Filter by linked task"))
    search_parser.add_argument("--timelog-id", type=UUID, help=_("Filter by linked timelog"))
    search_parser.add_argument("--vision-id", type=UUID, help=_("Filter by linked vision"))
    add_include_deleted_argument(search_parser, noun="notes in the search scope")
    add_limit_offset_arguments(search_parser, row_noun="matching notes")
    search_parser.set_defaults(handler=make_sync_handler(handle_note_search_async))


def build_note_show_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    show_parser = add_documented_parser(
        note_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show full note content"),
            description=(
                _("Show a single note with full metadata and the original content body.")
                + "\n\n"
                + _(
                    "Use this action when you need to inspect preserved line breaks instead of the "
                    "single-line summary from `note list`."
                )
            ),
            examples=(
                "lifeos note show 11111111-1111-1111-1111-111111111111",
                "lifeos note show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
            notes=(_("Use `--include-deleted` to inspect a soft-deleted note."),),
        ),
    )
    show_parser.add_argument("note_id", type=UUID, help=_("Note identifier"))
    add_include_deleted_argument(show_parser, noun="notes", help_prefix="Allow loading")
    show_parser.set_defaults(handler=make_sync_handler(handle_note_show_async))


def build_note_update_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    update_parser = add_documented_parser(
        note_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update a note"),
            description=(
                _("Update note content and weak associations in place.")
                + "\n\n"
                + _("Omitted fields remain unchanged. Use `--clear-*` flags to remove links.")
            ),
            examples=(
                'lifeos note update 11111111-1111-1111-1111-111111111111 "Rewrite the note"',
                "lifeos note update 11111111-1111-1111-1111-111111111111 --task-id <task-id>",
                "lifeos note update 11111111-1111-1111-1111-111111111111 --tag-id <tag-id>",
                "lifeos note update 11111111-1111-1111-1111-111111111111 --clear-timelogs",
            ),
            notes=(
                _(
                    "Repeat relation flags to replace the linked tags, people, tasks, visions, "
                    "events, or timelogs."
                ),
                _("Use relation flags without `content` when only links need to change."),
            ),
        ),
    )
    update_parser.add_argument("note_id", type=UUID, help=_("Note identifier"))
    update_parser.add_argument("content", nargs="?", help=_("Replacement note content"))
    update_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace tags with one or more identifiers"),
    )
    update_parser.add_argument("--clear-tags", action="store_true", help=_("Remove all tags"))
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace people with one or more identifiers"),
    )
    update_parser.add_argument("--clear-people", action="store_true", help=_("Remove all people"))
    update_parser.add_argument(
        "--task-id",
        dest="task_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace tasks with one or more identifiers"),
    )
    update_parser.add_argument(
        "--clear-tasks",
        dest="clear_tasks",
        action="store_true",
        help=_("Remove all linked tasks"),
    )
    update_parser.add_argument(
        "--vision-id",
        dest="vision_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace visions with one or more identifiers"),
    )
    update_parser.add_argument(
        "--clear-visions",
        action="store_true",
        help=_("Remove all linked visions"),
    )
    update_parser.add_argument(
        "--event-id",
        dest="event_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace events with one or more identifiers"),
    )
    update_parser.add_argument(
        "--clear-events",
        action="store_true",
        help=_("Remove all linked events"),
    )
    update_parser.add_argument(
        "--timelog-id",
        dest="timelog_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace timelogs with one or more identifiers"),
    )
    update_parser.add_argument(
        "--clear-timelogs",
        action="store_true",
        help=_("Remove all linked timelogs"),
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_note_update_async))


def build_note_delete_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    delete_parser = add_documented_parser(
        note_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete a note"),
            description=(
                _("Delete a note by identifier.")
                + "\n\n"
                + _(
                    "By default the note is soft-deleted so it can remain visible in audit "
                    "or recovery flows."
                )
            ),
            examples=("lifeos note delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("note_id", type=UUID, help=_("Note identifier"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_note_delete_async))


def build_note_batch_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    batch_parser = add_documented_parser(
        note_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch note operations"),
            description=_("Run note operations that target multiple records in one command."),
            examples=(
                "lifeos note batch update-content --help",
                "lifeos note batch delete --help",
            ),
            notes=(
                _("Use `update-content` for bulk find/replace across active note content."),
                _("Use `delete` to soft-delete multiple notes by identifier."),
                _("Batch commands currently accept note IDs directly."),
            ),
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="note_batch_command",
        title=_("operations"),
        metavar=_("operation"),
    )

    batch_update_parser = add_documented_parser(
        batch_subparsers,
        "update-content",
        help_content=HelpContent(
            summary=_("Find and replace note content in bulk"),
            description=(
                _("Apply a find/replace operation across multiple active notes.")
                + "\n\n"
                + _(
                    "This is the first batch-editing primitive for notes and provides a base "
                    "shape for future bulk operations."
                )
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
                _("Only active notes are updated by this command."),
                _("Failed note IDs are printed to stderr while successful updates stay on stdout."),
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
        help=_("One or more note identifiers to update"),
    )
    batch_update_parser.add_argument(
        "--find-text", required=True, help=_("Text to find in each target note")
    )
    batch_update_parser.add_argument(
        "--replace-text", default="", help=_("Replacement text for matched content")
    )
    batch_update_parser.add_argument(
        "--case-sensitive",
        action="store_true",
        help=_("Use a case-sensitive find/replace instead of case-insensitive matching"),
    )
    batch_update_parser.set_defaults(
        handler=make_sync_handler(handle_note_batch_update_content_async)
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple notes"),
            description=(
                _("Delete multiple notes in one command.")
                + "\n\n"
                + _("This command mirrors `lifeos note delete`, but works across many note IDs.")
            ),
            examples=(
                "lifeos note batch delete --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222",
            ),
            notes=(
                _("CLI batch delete performs soft deletion only."),
                _("Failed note IDs are printed to stderr while successful deletes stay on stdout."),
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
        help=_("One or more note identifiers to delete"),
    )
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_note_batch_delete_async))
