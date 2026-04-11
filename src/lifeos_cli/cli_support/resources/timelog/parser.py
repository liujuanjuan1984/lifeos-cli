"""Timelog resource parser construction."""

from __future__ import annotations

import argparse
from datetime import date, datetime
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.timelog.handlers import (
    handle_timelog_add,
    handle_timelog_batch_delete,
    handle_timelog_batch_restore,
    handle_timelog_batch_update,
    handle_timelog_delete,
    handle_timelog_list,
    handle_timelog_restore,
    handle_timelog_show,
    handle_timelog_stats_day,
    handle_timelog_stats_month,
    handle_timelog_stats_range,
    handle_timelog_stats_rebuild,
    handle_timelog_stats_week,
    handle_timelog_stats_year,
    handle_timelog_update,
)


def _datetime_value(value: str) -> datetime:
    """Parse an ISO-8601 datetime value."""
    return datetime.fromisoformat(value)


def _month_value(value: str) -> date:
    """Parse a YYYY-MM month value."""
    return date.fromisoformat(f"{value}-01")


def build_timelog_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the timelog command tree."""
    timelog_parser = add_documented_parser(
        subparsers,
        "timelog",
        help_content=HelpContent(
            summary="Manage actual time records",
            description=(
                "Create and maintain actual time records.\n\n"
                "Timelogs represent what really happened and how time was spent."
            ),
            examples=(
                'lifeos timelog add "Deep work" --start-time 2026-04-10T13:00:00-04:00 '
                "--end-time 2026-04-10T14:30:00-04:00",
                "lifeos timelog stats day --date 2026-04-10",
                "lifeos timelog list --window-start 2026-04-10T00:00:00-04:00 "
                "--window-end 2026-04-10T23:59:59-04:00",
                "lifeos timelog batch delete --ids <timelog-id-1> <timelog-id-2>",
                'lifeos timelog batch update --ids <timelog-id-1> --find-title-text "old" '
                '--replace-title-text "new"',
                "lifeos timelog restore <timelog-id>",
            ),
            notes=(
                "Use `list` as the primary query entrypoint for timelogs.",
                "Timelogs can optionally reference one area and one task.",
                "Timelog list and show include `linked_notes_count` derived from "
                "note associations.",
                "Use `stats` for timelog stats grouped by area.",
                "Delete operations in the public CLI always perform soft deletion.",
                "Use `restore` to recover a soft-deleted timelog.",
            ),
        ),
    )
    timelog_parser.set_defaults(handler=make_help_handler(timelog_parser))
    timelog_subparsers = timelog_parser.add_subparsers(
        dest="timelog_command", title="actions", metavar="action"
    )

    add_parser = add_documented_parser(
        timelog_subparsers,
        "add",
        help_content=HelpContent(
            summary="Create a timelog",
            description="Create one actual time record.",
            examples=(
                'lifeos timelog add "Deep work" --start-time 2026-04-10T13:00:00-04:00 '
                "--end-time 2026-04-10T14:30:00-04:00",
                'lifeos timelog add "Run" --start-time 2026-04-10T07:00:00-04:00 '
                "--end-time 2026-04-10T07:30:00-04:00 --area-id <area-id> --energy-level 4",
            ),
            notes=(
                "Use repeated `--tag-id` and `--person-id` flags to attach tags and people.",
                "Timelog end time is required because the record models completed time spent.",
                "When an agent records actual work, use `--person-id` to state whether the "
                "effort belongs to the human, the agent, or both.",
            ),
        ),
    )
    add_parser.add_argument("title", help="Timelog title")
    add_parser.add_argument("--start-time", required=True, type=_datetime_value, help="Start time")
    add_parser.add_argument("--end-time", required=True, type=_datetime_value, help="End time")
    add_parser.add_argument("--tracking-method", default="manual", help="Tracking method")
    add_parser.add_argument("--location", help="Optional location")
    add_parser.add_argument("--energy-level", type=int, help="Optional energy level from 1 to 5")
    add_parser.add_argument("--notes", help="Optional notes")
    add_parser.add_argument("--area-id", type=UUID, help="Optional linked area identifier")
    add_parser.add_argument("--task-id", type=UUID, help="Optional linked task identifier")
    add_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to attach one or more timelog tags",
    )
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to attach one or more people",
    )
    add_parser.set_defaults(handler=handle_timelog_add)

    list_parser = add_documented_parser(
        timelog_subparsers,
        "list",
        help_content=HelpContent(
            summary="List timelogs",
            description=(
                "List timelogs with optional time-window, relation, and method filters.\n\n"
                "Use this command as the main query entrypoint for actual time data."
            ),
            examples=(
                "lifeos timelog list",
                "lifeos timelog list --tracking-method manual "
                "--window-start 2026-04-10T00:00:00-04:00 "
                "--window-end 2026-04-10T23:59:59-04:00",
                "lifeos timelog list --date 2026-04-10",
                "lifeos timelog list --task-id <task-id> --person-id <person-id>",
                'lifeos timelog list --query "deep work" --count',
            ),
            notes=(
                "Use `--date` to query one configured local day using your timezone and "
                "`day_starts_at` preference.",
                "Use `--query` for lightweight text filtering across titles and notes.",
                "List output includes one `linked_notes_count` column after `task_id`.",
            ),
        ),
    )
    list_parser.add_argument("--title-contains", help="Filter by title substring")
    list_parser.add_argument("--notes-contains", help="Filter by notes substring")
    list_parser.add_argument("--query", help="Search title and notes by keyword")
    list_parser.add_argument("--tracking-method", help="Filter by tracking method")
    list_parser.add_argument("--area-id", type=UUID, help="Filter by linked area")
    list_parser.add_argument("--area-name", help="Filter by exact linked area name")
    list_parser.add_argument(
        "--without-area",
        action="store_true",
        help="Filter timelogs without a linked area",
    )
    list_parser.add_argument("--task-id", type=UUID, help="Filter by linked task")
    list_parser.add_argument(
        "--without-task",
        action="store_true",
        help="Filter timelogs without a linked task",
    )
    list_parser.add_argument("--person-id", type=UUID, help="Filter by linked person")
    list_parser.add_argument("--tag-id", type=UUID, help="Filter by linked tag")
    list_parser.add_argument(
        "--date",
        dest="local_date",
        type=date.fromisoformat,
        help="Filter one configured local day in YYYY-MM-DD format",
    )
    list_parser.add_argument("--window-start", type=_datetime_value, help="Window start time")
    list_parser.add_argument("--window-end", type=_datetime_value, help="Window end time")
    list_parser.add_argument("--count", action="store_true", help="Print total matched count")
    add_include_deleted_argument(list_parser, noun="timelogs")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=handle_timelog_list)

    show_parser = add_documented_parser(
        timelog_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show a timelog",
            description="Show one timelog with full metadata and derived note link counts.",
            examples=(
                "lifeos timelog show 11111111-1111-1111-1111-111111111111",
                "lifeos timelog show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("timelog_id", type=UUID, help="Timelog identifier")
    add_include_deleted_argument(show_parser, noun="timelogs", help_prefix="Allow")
    show_parser.set_defaults(handler=handle_timelog_show)

    update_parser = add_documented_parser(
        timelog_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update a timelog",
            description="Update mutable timelog fields.",
            examples=(
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 --energy-level 5",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--clear-task --clear-area",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--clear-people --clear-tags",
            ),
            notes=(
                "Use `--clear-*` flags to explicitly remove optional values.",
                "Do not mix a value flag with the matching clear flag in the same command.",
                "Use repeated `--person-id` to keep actual human effort, agent effort, "
                "and shared effort distinct.",
            ),
        ),
    )
    update_parser.add_argument("timelog_id", type=UUID, help="Timelog identifier")
    update_parser.add_argument("--title", help="Updated timelog title")
    update_parser.add_argument("--start-time", type=_datetime_value, help="Updated start time")
    update_parser.add_argument("--end-time", type=_datetime_value, help="Updated end time")
    update_parser.add_argument("--tracking-method", help="Updated tracking method")
    update_parser.add_argument("--location", help="Updated location")
    update_parser.add_argument("--clear-location", action="store_true", help="Clear location")
    update_parser.add_argument("--energy-level", type=int, help="Updated energy level from 1 to 5")
    update_parser.add_argument(
        "--clear-energy-level",
        action="store_true",
        help="Clear energy level",
    )
    update_parser.add_argument("--notes", help="Updated notes")
    update_parser.add_argument("--clear-notes", action="store_true", help="Clear notes")
    update_parser.add_argument("--area-id", type=UUID, help="Updated linked area identifier")
    update_parser.add_argument("--clear-area", action="store_true", help="Clear linked area")
    update_parser.add_argument("--task-id", type=UUID, help="Updated linked task identifier")
    update_parser.add_argument("--clear-task", action="store_true", help="Clear linked task")
    update_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to replace tags with one or more identifiers",
    )
    update_parser.add_argument("--clear-tags", action="store_true", help="Remove all tags")
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to replace people with one or more identifiers",
    )
    update_parser.add_argument("--clear-people", action="store_true", help="Remove all people")
    update_parser.set_defaults(handler=handle_timelog_update)

    delete_parser = add_documented_parser(
        timelog_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete a timelog",
            description="Soft-delete one timelog.",
            examples=("lifeos timelog delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("timelog_id", type=UUID, help="Timelog identifier")
    delete_parser.set_defaults(handler=handle_timelog_delete)

    restore_parser = add_documented_parser(
        timelog_subparsers,
        "restore",
        help_content=HelpContent(
            summary="Restore a timelog",
            description="Restore one soft-deleted timelog.",
            examples=("lifeos timelog restore 11111111-1111-1111-1111-111111111111",),
            notes=("The referenced area and task must still be active if they are linked.",),
        ),
    )
    restore_parser.add_argument("timelog_id", type=UUID, help="Timelog identifier")
    restore_parser.set_defaults(handler=handle_timelog_restore)

    batch_parser = add_documented_parser(
        timelog_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch timelog operations",
            description="Grouped namespace for multi-record timelog writes.",
            examples=(
                "lifeos timelog batch delete --ids <timelog-id-1> <timelog-id-2>",
                "lifeos timelog batch restore --ids <timelog-id-1> <timelog-id-2>",
                "lifeos timelog batch update --ids <timelog-id-1> <timelog-id-2> --clear-task",
            ),
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="timelog_batch_command", title="batch actions", metavar="batch-action"
    )
    batch_update_parser = add_documented_parser(
        batch_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update multiple timelogs",
            description="Update mutable fields across multiple active timelogs.",
            examples=(
                "lifeos timelog batch update --ids <timelog-id-1> <timelog-id-2> --clear-task",
                "lifeos timelog batch update --ids <timelog-id-1> <timelog-id-2> "
                '--find-title-text "deep" --replace-title-text "focused"',
                "lifeos timelog batch update --ids <timelog-id-1> --clear-tags "
                "--person-id <person-id>",
            ),
            notes=(
                "Use repeated `--tag-id` and `--person-id` flags to replace associations.",
                "Use `--clear-*` flags to remove optional links.",
            ),
        ),
    )
    add_identifier_list_argument(batch_update_parser, dest="timelog_ids", noun="timelog")
    batch_update_parser.add_argument("--title", help="Replace the full title")
    batch_update_parser.add_argument("--find-title-text", help="Title text to find")
    batch_update_parser.add_argument(
        "--replace-title-text",
        help="Replacement text for title matches",
    )
    batch_update_parser.add_argument("--area-id", type=UUID, help="Replace linked area")
    batch_update_parser.add_argument("--clear-area", action="store_true", help="Clear linked area")
    batch_update_parser.add_argument("--task-id", type=UUID, help="Replace linked task")
    batch_update_parser.add_argument("--clear-task", action="store_true", help="Clear linked task")
    batch_update_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to replace tags with one or more identifiers",
    )
    batch_update_parser.add_argument("--clear-tags", action="store_true", help="Remove all tags")
    batch_update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to replace people with one or more identifiers",
    )
    batch_update_parser.add_argument(
        "--clear-people",
        action="store_true",
        help="Remove all people",
    )
    batch_update_parser.set_defaults(handler=handle_timelog_batch_update)

    batch_restore_parser = add_documented_parser(
        batch_subparsers,
        "restore",
        help_content=HelpContent(
            summary="Restore multiple timelogs",
            description="Restore multiple soft-deleted timelogs by identifier.",
        ),
    )
    add_identifier_list_argument(batch_restore_parser, dest="timelog_ids", noun="timelog")
    batch_restore_parser.set_defaults(handler=handle_timelog_batch_restore)

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete multiple timelogs",
            description="Soft-delete multiple timelogs by identifier.",
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="timelog_ids", noun="timelog")
    batch_delete_parser.set_defaults(handler=handle_timelog_batch_delete)

    stats_parser = add_documented_parser(
        timelog_subparsers,
        "stats",
        help_content=HelpContent(
            summary="Query timelog stats grouped by area",
            description=(
                "Query timelog stats grouped by area.\n\n"
                "Day, week, month, and year views use persisted stats when available and "
                "fall back to direct aggregation when the cache has not been rebuilt yet."
            ),
            examples=(
                "lifeos timelog stats day --date 2026-04-10",
                "lifeos timelog stats range --start-date 2026-04-01 --end-date 2026-04-30",
                "lifeos timelog stats week --date 2026-04-10",
                "lifeos timelog stats month --month 2026-04",
                "lifeos timelog stats rebuild --all",
            ),
            notes=(
                "Stats are grouped only by area; task effort remains a separate task feature.",
                "Run `timelog stats rebuild` after upgrading older datasets or importing "
                "historical timelogs so persisted stats match historical records.",
                "Range stats aggregate directly from source timelogs for the requested window.",
            ),
        ),
    )
    stats_parser.set_defaults(handler=make_help_handler(stats_parser))
    stats_subparsers = stats_parser.add_subparsers(
        dest="timelog_stats_command", title="stats actions", metavar="stats-action"
    )

    stats_day_parser = add_documented_parser(
        stats_subparsers,
        "day",
        help_content=HelpContent(
            summary="Show one day of timelog stats grouped by area",
            description="Show one local operational day of timelog stats grouped by area.",
            examples=("lifeos timelog stats day --date 2026-04-10",),
        ),
    )
    stats_day_parser.add_argument(
        "--date",
        dest="target_date",
        required=True,
        type=date.fromisoformat,
        help="Local operational date in YYYY-MM-DD format",
    )
    stats_day_parser.set_defaults(handler=handle_timelog_stats_day)

    stats_range_parser = add_documented_parser(
        stats_subparsers,
        "range",
        help_content=HelpContent(
            summary="Show a date range of timelog stats grouped by area",
            description="Show one local date range of timelog stats grouped by area.",
            examples=("lifeos timelog stats range --start-date 2026-04-01 --end-date 2026-04-30",),
        ),
    )
    stats_range_parser.add_argument(
        "--start-date",
        required=True,
        type=date.fromisoformat,
        help="Local range start date in YYYY-MM-DD format",
    )
    stats_range_parser.add_argument(
        "--end-date",
        required=True,
        type=date.fromisoformat,
        help="Local range end date in YYYY-MM-DD format",
    )
    stats_range_parser.set_defaults(handler=handle_timelog_stats_range)

    stats_week_parser = add_documented_parser(
        stats_subparsers,
        "week",
        help_content=HelpContent(
            summary="Show one week of timelog stats grouped by area",
            description="Show one configured local week of timelog stats grouped by area.",
            examples=("lifeos timelog stats week --date 2026-04-10",),
            notes=("The week boundary follows the configured `week_starts_on` preference.",),
        ),
    )
    stats_week_parser.add_argument(
        "--date",
        dest="target_date",
        required=True,
        type=date.fromisoformat,
        help="Reference local date in YYYY-MM-DD format",
    )
    stats_week_parser.set_defaults(handler=handle_timelog_stats_week)

    stats_month_parser = add_documented_parser(
        stats_subparsers,
        "month",
        help_content=HelpContent(
            summary="Show one month of timelog stats grouped by area",
            description="Show one calendar month of timelog stats grouped by area.",
            examples=("lifeos timelog stats month --month 2026-04",),
        ),
    )
    stats_month_parser.add_argument(
        "--month",
        required=True,
        type=_month_value,
        help="Calendar month in YYYY-MM format",
    )
    stats_month_parser.set_defaults(handler=handle_timelog_stats_month)

    stats_year_parser = add_documented_parser(
        stats_subparsers,
        "year",
        help_content=HelpContent(
            summary="Show one year of timelog stats grouped by area",
            description="Show one calendar year of timelog stats grouped by area.",
            examples=("lifeos timelog stats year --year 2026",),
        ),
    )
    stats_year_parser.add_argument(
        "--year",
        required=True,
        type=int,
        help="Calendar year, for example 2026",
    )
    stats_year_parser.set_defaults(handler=handle_timelog_stats_year)

    stats_rebuild_parser = add_documented_parser(
        stats_subparsers,
        "rebuild",
        help_content=HelpContent(
            summary="Rebuild persisted timelog stats grouped by area",
            description=(
                "Rebuild persisted day, week, month, and year timelog stats grouped by area "
                "for one selected local scope."
            ),
            examples=(
                "lifeos timelog stats rebuild --date 2026-04-10",
                "lifeos timelog stats rebuild --start-date 2026-01-01 --end-date 2026-03-31",
                "lifeos timelog stats rebuild --all",
            ),
            notes=(
                "Use rebuild after upgrading older datasets or importing historical timelogs.",
                "Rebuild uses the configured timezone and `day_starts_at` preference.",
            ),
        ),
    )
    stats_rebuild_parser.add_argument(
        "--date",
        dest="target_date",
        type=date.fromisoformat,
        help="Rebuild one local operational date in YYYY-MM-DD format",
    )
    stats_rebuild_parser.add_argument(
        "--start-date",
        type=date.fromisoformat,
        help="Rebuild range start date in YYYY-MM-DD format",
    )
    stats_rebuild_parser.add_argument(
        "--end-date",
        type=date.fromisoformat,
        help="Rebuild range end date in YYYY-MM-DD format",
    )
    stats_rebuild_parser.add_argument(
        "--all",
        dest="rebuild_all",
        action="store_true",
        help="Rebuild every local date touched by active timelogs with linked areas",
    )
    stats_rebuild_parser.set_defaults(handler=handle_timelog_stats_rebuild)
