"""Builder helpers for core timelog actions."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_parser,
    clear_flags_note,
    configured_timezone_datetime_note,
    local_date_range_argument_help,
    local_date_range_note,
    repeated_tag_or_person_attach_note,
    value_clear_conflict_note,
)
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_date_range_arguments,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.timelog.handlers import (
    TIMELOG_SUMMARY_COLUMNS,
    TIMELOG_SUMMARY_COLUMNS_WITH_COUNTS,
    handle_timelog_add_async,
    handle_timelog_delete_async,
    handle_timelog_list_async,
    handle_timelog_show_async,
    handle_timelog_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.cli_support.time_args import parse_datetime_or_date_value, parse_user_datetime_value
from lifeos_cli.i18n import gettext_message as _


def build_timelog_add_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog add command."""
    add_parser = add_documented_parser(
        timelog_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create a timelog"),
            description=_("Create one actual time record or preview a quick batch add."),
            examples=(
                'lifeos timelog add "Deep work" --start-time 2026-04-10T13:00:00 '
                "--end-time 2026-04-10T14:30:00",
                'lifeos timelog add "Run" --start-time 2026-04-10T07:00:00 '
                "--end-time 2026-04-10T07:30:00 --area-id <area-id> --energy-level 4",
                'lifeos timelog add "Shared pairing" --start-time 2026-04-10T15:00:00 '
                "--end-time 2026-04-10T16:30:00 "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
                'lifeos timelog add --entry "0700 Breakfast" --entry "0830 Deep work" '
                "--first-start-time 2026-04-10T06:30:00",
                "printf '0700 Breakfast\\n0830 Deep work\\n' | lifeos timelog add --stdin "
                "--first-start-time 2026-04-10T06:30:00",
                "lifeos timelog add --file quick-timelog.txt",
            ),
            notes=(
                repeated_tag_or_person_attach_note(),
                _(
                    "Single-record mode requires both `--start-time` and `--end-time` because "
                    "the record models completed time spent."
                ),
                _(
                    "Quick batch mode accepts `HHMM Title` and `HH:MM-HH:MM Title` lines, "
                    "always previews the parsed rows, asks for confirmation before writing by "
                    "default, and skips the prompt when input comes from `--stdin` or `--yes` "
                    "is provided."
                ),
                configured_timezone_datetime_note(),
                _(
                    "When quick batch mode omits `--first-start-time`, the first row inherits "
                    "the latest active timelog end time."
                ),
                _(
                    "When an agent records actual work, use `--person-id` to state whether the "
                    "effort belongs to the human, the agent, or both."
                ),
            ),
        ),
    )
    add_parser.add_argument("title", nargs="?", help=_("Timelog title"))
    add_parser.add_argument("--start-time", type=parse_user_datetime_value, help=_("Start time"))
    add_parser.add_argument("--end-time", type=parse_user_datetime_value, help=_("End time"))
    add_parser.add_argument(
        "--entry",
        dest="entry_lines",
        action="append",
        default=None,
        help=_("Repeat to add one quick batch-entry line"),
    )
    add_parser.add_argument(
        "--stdin",
        action="store_true",
        help=_("Read quick batch entries from standard input"),
    )
    add_parser.add_argument("--file", help=_("Read quick batch entries from a UTF-8 text file"))
    add_parser.add_argument(
        "--first-start-time",
        type=parse_user_datetime_value,
        help=_("First quick batch start time; defaults to the latest active timelog end time"),
    )
    add_parser.add_argument(
        "--yes",
        action="store_true",
        help=_("Write quick batch timelogs without interactive confirmation after preview"),
    )
    add_parser.add_argument("--tracking-method", default="manual", help=_("Tracking method"))
    add_parser.add_argument("--location", help=_("Optional location"))
    add_parser.add_argument("--energy-level", type=int, help=_("Optional energy level from 1 to 5"))
    add_parser.add_argument("--notes", help=_("Optional notes"))
    add_parser.add_argument("--area-id", type=UUID, help=_("Optional linked area identifier"))
    add_parser.add_argument("--task-id", type=UUID, help=_("Optional linked task identifier"))
    add_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to attach one or more timelog tags"),
    )
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to attach one or more people"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_timelog_add_async))


def build_timelog_list_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog list command."""
    list_parser = add_documented_parser(
        timelog_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List timelogs"),
            description=(
                _("List timelogs with optional time-window, relation, and method filters.")
                + "\n\n"
                + _("Use this command as the primary query entrypoint for timelogs.")
            ),
            examples=(
                "lifeos timelog list",
                "lifeos timelog list --date 2026-04-10",
                "lifeos timelog list --date 2026-04-10 --date 2026-04-16",
                "lifeos timelog list --tracking-method manual "
                "--start-time 2026-04-10T00:00:00 "
                "--end-time 2026-04-10T23:59:59",
                "lifeos timelog list --task-id <task-id> --person-id <person-id>",
                'lifeos timelog list --query "deep work" --count',
            ),
            notes=(
                local_date_range_note(),
                _("Use `--query` for lightweight text filtering across titles and notes."),
                _(
                    "When results exist, the list command prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(TIMELOG_SUMMARY_COLUMNS)),
                _("Use `--with-counts` to add relationship count columns: {columns}.").format(
                    columns=format_summary_column_list(TIMELOG_SUMMARY_COLUMNS_WITH_COUNTS)
                ),
            ),
        ),
    )
    list_parser.add_argument("--title-contains", help=_("Filter by title substring"))
    list_parser.add_argument("--notes-contains", help=_("Filter by notes substring"))
    list_parser.add_argument("--query", help=_("Search title and notes by keyword"))
    list_parser.add_argument("--tracking-method", help=_("Filter by tracking method"))
    list_parser.add_argument("--area-id", type=UUID, help=_("Filter by linked area"))
    list_parser.add_argument("--area-name", help=_("Filter by exact linked area name"))
    list_parser.add_argument(
        "--without-area",
        action="store_true",
        help=_("Filter timelogs without a linked area"),
    )
    list_parser.add_argument("--task-id", type=UUID, help=_("Filter by linked task"))
    list_parser.add_argument(
        "--without-task",
        action="store_true",
        help=_("Filter timelogs without a linked task"),
    )
    list_parser.add_argument("--person-id", type=UUID, help=_("Filter by linked person"))
    list_parser.add_argument("--tag-id", type=UUID, help=_("Filter by linked tag"))
    list_parser.add_argument(
        "--with-counts",
        action="store_true",
        help=_("Include relationship count columns in summary output"),
    )
    add_date_range_arguments(
        list_parser,
        date_help=local_date_range_argument_help(),
    )
    list_parser.add_argument(
        "--start-time",
        dest="window_start",
        type=parse_datetime_or_date_value,
        help=_("Inclusive time filter start; date-only values use the configured timezone"),
    )
    list_parser.add_argument(
        "--end-time",
        dest="window_end",
        type=parse_datetime_or_date_value,
        help=_("Inclusive time filter end; date-only values use the configured timezone"),
    )
    list_parser.add_argument("--count", action="store_true", help=_("Print total matched count"))
    add_include_deleted_argument(list_parser, noun="timelogs")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_timelog_list_async))


def build_timelog_show_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog show command."""
    show_parser = add_documented_parser(
        timelog_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show a timelog"),
            description=_("Show one timelog with full metadata and derived note link counts."),
            examples=(
                "lifeos timelog show 11111111-1111-1111-1111-111111111111",
                "lifeos timelog show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("timelog_id", type=UUID, help=_("Timelog identifier"))
    add_include_deleted_argument(show_parser, noun="timelogs", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_timelog_show_async))


def build_timelog_update_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog update command."""
    update_parser = add_documented_parser(
        timelog_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update a timelog"),
            description=_("Update mutable timelog fields."),
            examples=(
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 --energy-level 5",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--start-time 2026-04-10T13:00:00 --end-time 2026-04-10T14:00:00",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--clear-task --clear-area",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--clear-people --clear-tags",
            ),
            notes=(
                clear_flags_note(),
                value_clear_conflict_note(),
                configured_timezone_datetime_note(),
                _(
                    "Use repeated `--person-id` to keep actual human effort, agent effort, "
                    "and shared effort distinct."
                ),
            ),
        ),
    )
    update_parser.add_argument("timelog_id", type=UUID, help=_("Timelog identifier"))
    update_parser.add_argument("--title", help=_("Updated timelog title"))
    update_parser.add_argument(
        "--start-time", type=parse_user_datetime_value, help=_("Updated start time")
    )
    update_parser.add_argument(
        "--end-time", type=parse_user_datetime_value, help=_("Updated end time")
    )
    update_parser.add_argument("--tracking-method", help=_("Updated tracking method"))
    update_parser.add_argument("--location", help=_("Updated location"))
    update_parser.add_argument("--clear-location", action="store_true", help=_("Clear location"))
    update_parser.add_argument(
        "--energy-level", type=int, help=_("Updated energy level from 1 to 5")
    )
    update_parser.add_argument(
        "--clear-energy-level",
        action="store_true",
        help=_("Clear energy level"),
    )
    update_parser.add_argument("--notes", help=_("Updated notes"))
    update_parser.add_argument("--clear-notes", action="store_true", help=_("Clear notes"))
    update_parser.add_argument("--area-id", type=UUID, help=_("Updated linked area identifier"))
    update_parser.add_argument("--clear-area", action="store_true", help=_("Clear linked area"))
    update_parser.add_argument("--task-id", type=UUID, help=_("Updated linked task identifier"))
    update_parser.add_argument("--clear-task", action="store_true", help=_("Clear linked task"))
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
    update_parser.set_defaults(handler=make_sync_handler(handle_timelog_update_async))


def build_timelog_delete_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog delete command."""
    delete_parser = add_documented_parser(
        timelog_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete a timelog"),
            description=_("Delete one timelog."),
            examples=("lifeos timelog delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("timelog_id", type=UUID, help=_("Timelog identifier"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_timelog_delete_async))
