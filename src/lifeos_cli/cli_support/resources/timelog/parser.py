"""Timelog resource parser construction."""

from __future__ import annotations

import argparse
from datetime import date, datetime
from functools import partial
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_date_range_arguments,
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.timelog.handlers import (
    TIMELOG_SUMMARY_COLUMNS,
    handle_timelog_add_async,
    handle_timelog_batch_delete_async,
    handle_timelog_batch_restore_async,
    handle_timelog_batch_update_async,
    handle_timelog_delete_async,
    handle_timelog_list_async,
    handle_timelog_restore_async,
    handle_timelog_show_async,
    handle_timelog_stats_day_async,
    handle_timelog_stats_period_async,
    handle_timelog_stats_range_async,
    handle_timelog_stats_rebuild_async,
    handle_timelog_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.cli_support.time_args import parse_datetime_or_date_value
from lifeos_cli.i18n import gettext_message as _


def _month_value(value: str) -> date:
    """Parse a YYYY-MM month value."""
    return date.fromisoformat(f"{value}-01")


def build_timelog_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the timelog command tree."""
    timelog_parser = add_documented_help_parser(
        subparsers,
        "timelog",
        help_content=HelpContent(
            summary=_("Manage actual time records"),
            description=(
                _("Create and maintain actual time records.")
                + "\n\n"
                + _("Timelogs represent what really happened and how time was spent.")
            ),
            examples=(
                "lifeos timelog add --help",
                "lifeos timelog list --help",
                "lifeos timelog stats --help",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for timelogs."),
                _("Timelogs can optionally reference one area and one task."),
                _("Use `stats` for timelog stats grouped by area."),
                _(
                    "See `lifeos timelog batch --help` for bulk `update`, `restore`, and "
                    "`delete` workflows."
                ),
            ),
        ),
    )
    timelog_subparsers = timelog_parser.add_subparsers(
        dest="timelog_command", title=_("actions"), metavar=_("action")
    )

    add_parser = add_documented_parser(
        timelog_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create a timelog"),
            description=_("Create one actual time record."),
            examples=(
                'lifeos timelog add "Deep work" --start-time 2026-04-10T13:00:00-04:00 '
                "--end-time 2026-04-10T14:30:00-04:00",
                'lifeos timelog add "Run" --start-time 2026-04-10T07:00:00-04:00 '
                "--end-time 2026-04-10T07:30:00-04:00 --area-id <area-id> --energy-level 4",
                'lifeos timelog add "Shared pairing" --start-time 2026-04-10T15:00:00-04:00 '
                "--end-time 2026-04-10T16:30:00-04:00 "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
            ),
            notes=(
                _(
                    "Repeat the same `--tag-id` or `--person-id` flag to attach multiple tags "
                    "or people in one command."
                ),
                _("Timelog end time is required because the record models completed time spent."),
                _(
                    "When an agent records actual work, use `--person-id` to state whether the "
                    "effort belongs to the human, the agent, or both."
                ),
            ),
        ),
    )
    add_parser.add_argument("title", help=_("Timelog title"))
    add_parser.add_argument(
        "--start-time", required=True, type=datetime.fromisoformat, help=_("Start time")
    )
    add_parser.add_argument(
        "--end-time", required=True, type=datetime.fromisoformat, help=_("End time")
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

    list_parser = add_documented_parser(
        timelog_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List timelogs"),
            description=(
                _("List timelogs with optional time-window, relation, and method filters.")
                + "\n\n"
                + _("Use this command as the main query entrypoint for actual time data.")
            ),
            examples=(
                "lifeos timelog list",
                "lifeos timelog list --date 2026-04-10",
                "lifeos timelog list --date 2026-04-10 --date 2026-04-16",
                "lifeos timelog list --tracking-method manual "
                "--start-time 2026-04-10T00:00:00-04:00 "
                "--end-time 2026-04-10T23:59:59-04:00",
                "lifeos timelog list --task-id <task-id> --person-id <person-id>",
                'lifeos timelog list --query "deep work" --count',
            ),
            notes=(
                _(
                    "Repeat `--date` once for one configured local day or twice for one "
                    "inclusive local-date range."
                ),
                _("Use `--query` for lightweight text filtering across titles and notes."),
                _(
                    "When results exist, the list command prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(TIMELOG_SUMMARY_COLUMNS)),
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
    add_date_range_arguments(
        list_parser,
        date_help=_(
            "Repeat once for one configured local day or twice for one inclusive "
            "local-date range in YYYY-MM-DD format"
        ),
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

    update_parser = add_documented_parser(
        timelog_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update a timelog"),
            description=_("Update mutable timelog fields."),
            examples=(
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 --energy-level 5",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--clear-task --clear-area",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--clear-people --clear-tags",
            ),
            notes=(
                _("Use `--clear-*` flags to explicitly remove optional values."),
                _("Do not mix a value flag with the matching clear flag in the same command."),
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
        "--start-time", type=datetime.fromisoformat, help=_("Updated start time")
    )
    update_parser.add_argument(
        "--end-time", type=datetime.fromisoformat, help=_("Updated end time")
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

    delete_parser = add_documented_parser(
        timelog_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete a timelog"),
            description=_("Soft-delete one timelog."),
            examples=("lifeos timelog delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("timelog_id", type=UUID, help=_("Timelog identifier"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_timelog_delete_async))

    restore_parser = add_documented_parser(
        timelog_subparsers,
        "restore",
        help_content=HelpContent(
            summary=_("Restore a timelog"),
            description=_("Restore one soft-deleted timelog."),
            examples=("lifeos timelog restore 11111111-1111-1111-1111-111111111111",),
            notes=(_("The referenced area and task must still be active if they are linked."),),
        ),
    )
    restore_parser.add_argument("timelog_id", type=UUID, help=_("Timelog identifier"))
    restore_parser.set_defaults(handler=make_sync_handler(handle_timelog_restore_async))

    batch_parser = add_documented_help_parser(
        timelog_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch timelog operations"),
            description=_("Run bulk update, restore, and delete operations for timelogs."),
            examples=(
                "lifeos timelog batch update --help",
                "lifeos timelog batch restore --help",
                "lifeos timelog batch delete --help",
            ),
            notes=(
                _("Use `update` to edit mutable fields across active timelogs."),
                _("Use `restore` and `delete` to manage soft-deleted timelog state in bulk."),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="timelog_batch_command", title=_("batch actions"), metavar=_("batch-action")
    )
    batch_update_parser = add_documented_parser(
        batch_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update multiple timelogs"),
            description=_("Update mutable fields across multiple active timelogs."),
            examples=(
                "lifeos timelog batch update --ids <timelog-id-1> <timelog-id-2> --clear-task",
                "lifeos timelog batch update --ids <timelog-id-1> <timelog-id-2> "
                '--find-title-text "deep" --replace-title-text "focused"',
                "lifeos timelog batch update --ids <timelog-id-1> "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
            ),
            notes=(
                _(
                    "Repeat the same `--tag-id` or `--person-id` flag to replace multiple "
                    "linked tags or people."
                ),
                _("Use `--clear-*` flags to remove optional links."),
            ),
        ),
    )
    add_identifier_list_argument(
        batch_update_parser,
        dest="timelog_ids",
        noun="timelog",
        action_verb="update",
    )
    batch_update_parser.add_argument("--title", help=_("Replace the full title"))
    batch_update_parser.add_argument("--find-title-text", help=_("Title text to find"))
    batch_update_parser.add_argument(
        "--replace-title-text",
        help=_("Replacement text for title matches"),
    )
    batch_update_parser.add_argument("--area-id", type=UUID, help=_("Replace linked area"))
    batch_update_parser.add_argument(
        "--clear-area", action="store_true", help=_("Clear linked area")
    )
    batch_update_parser.add_argument("--task-id", type=UUID, help=_("Replace linked task"))
    batch_update_parser.add_argument(
        "--clear-task", action="store_true", help=_("Clear linked task")
    )
    batch_update_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace tags with one or more identifiers"),
    )
    batch_update_parser.add_argument("--clear-tags", action="store_true", help=_("Remove all tags"))
    batch_update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace people with one or more identifiers"),
    )
    batch_update_parser.add_argument(
        "--clear-people",
        action="store_true",
        help=_("Remove all people"),
    )
    batch_update_parser.set_defaults(handler=make_sync_handler(handle_timelog_batch_update_async))

    batch_restore_parser = add_documented_parser(
        batch_subparsers,
        "restore",
        help_content=HelpContent(
            summary=_("Restore multiple timelogs"),
            description=_("Restore multiple soft-deleted timelogs by identifier."),
            examples=("lifeos timelog batch restore --ids <timelog-id-1> <timelog-id-2>",),
        ),
    )
    add_identifier_list_argument(
        batch_restore_parser,
        dest="timelog_ids",
        noun="timelog",
        action_verb="restore",
    )
    batch_restore_parser.set_defaults(handler=make_sync_handler(handle_timelog_batch_restore_async))

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple timelogs"),
            description=_("Soft-delete multiple timelogs by identifier."),
            examples=("lifeos timelog batch delete --ids <timelog-id-1> <timelog-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="timelog_ids", noun="timelog")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_timelog_batch_delete_async))

    stats_parser = add_documented_help_parser(
        timelog_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("Query timelog stats grouped by area"),
            description=_("Query timelog stats grouped by area."),
            examples=(
                "lifeos timelog stats day --help",
                "lifeos timelog stats range --help",
                "lifeos timelog stats rebuild --help",
            ),
            notes=(
                _("Use `day`, `week`, `month`, and `year` for calendar-based views."),
                _("Use `range` for arbitrary windows and `rebuild` to refresh persisted stats."),
                _("Stats are grouped only by area; task effort remains a separate task feature."),
                _(
                    "Run `timelog stats rebuild` after upgrading older datasets or importing "
                    "historical timelogs so persisted stats match historical records."
                ),
            ),
        ),
    )
    stats_subparsers = stats_parser.add_subparsers(
        dest="timelog_stats_command", title=_("stats actions"), metavar=_("stats-action")
    )

    stats_day_parser = add_documented_parser(
        stats_subparsers,
        "day",
        help_content=HelpContent(
            summary=_("Show one day of timelog stats grouped by area"),
            description=_("Show one local operational day of timelog stats grouped by area."),
            examples=("lifeos timelog stats day --date 2026-04-10",),
        ),
    )
    stats_day_parser.add_argument(
        "--date",
        dest="target_date",
        required=True,
        type=date.fromisoformat,
        help=_("Local operational date in YYYY-MM-DD format"),
    )
    stats_day_parser.set_defaults(handler=make_sync_handler(handle_timelog_stats_day_async))

    stats_range_parser = add_documented_parser(
        stats_subparsers,
        "range",
        help_content=HelpContent(
            summary=_("Show a date range of timelog stats grouped by area"),
            description=_("Show one local date range of timelog stats grouped by area."),
            examples=("lifeos timelog stats range --date 2026-04-01 --date 2026-04-30",),
            notes=(
                _(
                    "Repeat `--date` once for one local date or twice for one inclusive "
                    "local-date range."
                ),
            ),
        ),
    )
    add_date_range_arguments(
        stats_range_parser,
        date_help=_(
            "Repeat once for one local date or twice for one inclusive local-date range "
            "in YYYY-MM-DD format"
        ),
    )
    stats_range_parser.set_defaults(handler=make_sync_handler(handle_timelog_stats_range_async))

    stats_week_parser = add_documented_parser(
        stats_subparsers,
        "week",
        help_content=HelpContent(
            summary=_("Show one week of timelog stats grouped by area"),
            description=_("Show one configured local week of timelog stats grouped by area."),
            examples=("lifeos timelog stats week --date 2026-04-10",),
            notes=(_("The week boundary follows the configured `week_starts_on` preference."),),
        ),
    )
    stats_week_parser.add_argument(
        "--date",
        dest="target_date",
        required=True,
        type=date.fromisoformat,
        help=_("Reference local date in YYYY-MM-DD format"),
    )
    stats_week_parser.set_defaults(
        handler=make_sync_handler(partial(handle_timelog_stats_period_async, granularity="week"))
    )

    stats_month_parser = add_documented_parser(
        stats_subparsers,
        "month",
        help_content=HelpContent(
            summary=_("Show one month of timelog stats grouped by area"),
            description=_("Show one calendar month of timelog stats grouped by area."),
            examples=("lifeos timelog stats month --month 2026-04",),
        ),
    )
    stats_month_parser.add_argument(
        "--month",
        required=True,
        type=_month_value,
        help=_("Calendar month in YYYY-MM format"),
    )
    stats_month_parser.set_defaults(
        handler=make_sync_handler(partial(handle_timelog_stats_period_async, granularity="month"))
    )

    stats_year_parser = add_documented_parser(
        stats_subparsers,
        "year",
        help_content=HelpContent(
            summary=_("Show one year of timelog stats grouped by area"),
            description=_("Show one calendar year of timelog stats grouped by area."),
            examples=("lifeos timelog stats year --year 2026",),
        ),
    )
    stats_year_parser.add_argument(
        "--year",
        required=True,
        type=int,
        help=_("Calendar year, for example 2026"),
    )
    stats_year_parser.set_defaults(
        handler=make_sync_handler(partial(handle_timelog_stats_period_async, granularity="year"))
    )

    stats_rebuild_parser = add_documented_parser(
        stats_subparsers,
        "rebuild",
        help_content=HelpContent(
            summary=_("Rebuild persisted timelog stats grouped by area"),
            description=(
                _(
                    "Rebuild persisted day, week, month, and year timelog stats grouped by "
                    "area for one selected local scope."
                )
            ),
            examples=(
                "lifeos timelog stats rebuild --date 2026-04-10",
                "lifeos timelog stats rebuild --date 2026-01-01 --date 2026-03-31",
                "lifeos timelog stats rebuild --all",
            ),
            notes=(
                _("Use rebuild after upgrading older datasets or importing historical timelogs."),
                _("Rebuild uses the configured timezone and `day_starts_at` preference."),
                _("Repeat `--date` twice for one inclusive local-date rebuild range."),
            ),
        ),
    )
    add_date_range_arguments(
        stats_rebuild_parser,
        date_help=_(
            "Repeat once for one local operational date or twice for one inclusive "
            "local-date rebuild range in YYYY-MM-DD format"
        ),
    )
    stats_rebuild_parser.add_argument(
        "--all",
        dest="rebuild_all",
        action="store_true",
        help=_("Rebuild every local date touched by active timelogs with linked areas"),
    )
    stats_rebuild_parser.set_defaults(handler=make_sync_handler(handle_timelog_stats_rebuild_async))
