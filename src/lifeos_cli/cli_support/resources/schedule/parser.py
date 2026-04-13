"""Schedule resource parser construction."""

from __future__ import annotations

import argparse
from datetime import date

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.resources.schedule.handlers import (
    SCHEDULE_EVENT_COLUMNS,
    SCHEDULE_HABIT_ACTION_COLUMNS,
    SCHEDULE_TASK_COLUMNS,
    handle_schedule_list,
    handle_schedule_show,
)
from lifeos_cli.i18n import gettext_message as _


def build_schedule_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the schedule command tree."""
    schedule_parser = add_documented_parser(
        subparsers,
        "schedule",
        help_content=HelpContent(
            summary=_("Inspect aggregated schedule views"),
            description=(
                _("Show schedule views grouped by local date.")
                + "\n\n"
                + _(
                    "Schedule is a CLI read model built from tasks, habit actions, and events, "
                    "including expanded recurring event occurrences."
                )
            ),
            examples=(
                "lifeos schedule show --date 2026-04-10",
                "lifeos schedule list --start-date 2026-04-10 --end-date 2026-04-16",
            ),
            notes=(
                _("Use `show` for one exact local day."),
                _("Use `list` for multi-day ranges."),
                _("Dates use the configured timezone and `day_starts_at` preference."),
                _("Event output is segmented into appointment, timeblock, and deadline sections."),
                _("Schedule reads from existing domains and does not create a new stored entity."),
            ),
        ),
    )
    schedule_parser.set_defaults(handler=make_help_handler(schedule_parser))
    schedule_subparsers = schedule_parser.add_subparsers(
        dest="schedule_command", title=_("actions"), metavar=_("action")
    )

    show_parser = add_documented_parser(
        schedule_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show one schedule day"),
            description=(
                _("Show the aggregated schedule for one local day.")
                + "\n\n"
                + _(
                    "Tasks appear when the requested local date falls inside their planning-cycle "
                    "window, while events appear when their scheduled time overlaps that day."
                )
            ),
            examples=("lifeos schedule show --date 2026-04-10",),
            notes=(
                _("The output groups tasks, habit actions, and event occurrences for the day."),
                _("Task rows come from planning-cycle overlap, not from event timeblocks."),
                _(
                    "Event occurrences are split into appointment, timeblock, and deadline "
                    "sections."
                ),
                _(
                    "Non-empty schedule sections print a tab-separated header row before their "
                    "entries."
                ),
                _("Task section columns: {columns}.").format(
                    columns=format_summary_column_list(SCHEDULE_TASK_COLUMNS)
                ),
                _("Habit action section columns: {columns}.").format(
                    columns=format_summary_column_list(SCHEDULE_HABIT_ACTION_COLUMNS)
                ),
                _(
                    "Event section columns for appointments, timeblocks, and deadlines: {columns}."
                ).format(columns=format_summary_column_list(SCHEDULE_EVENT_COLUMNS)),
            ),
        ),
    )
    show_parser.add_argument(
        "--date",
        dest="target_date",
        required=True,
        type=date.fromisoformat,
        help=_("Target local date in YYYY-MM-DD format"),
    )
    show_parser.set_defaults(handler=handle_schedule_show)

    list_parser = add_documented_parser(
        schedule_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List a schedule range"),
            description=_("Show the aggregated schedule for a local-date range."),
            examples=("lifeos schedule list --start-date 2026-04-10 --end-date 2026-04-16",),
            notes=(
                _("The range is inclusive on both start and end dates."),
                _("Recurring event occurrences are expanded inside the requested range."),
                _("Event occurrences remain segmented by type inside each day block."),
                _(
                    "Non-empty schedule sections print a tab-separated header row before their "
                    "entries."
                ),
                _("Task section columns: {columns}.").format(
                    columns=format_summary_column_list(SCHEDULE_TASK_COLUMNS)
                ),
                _("Habit action section columns: {columns}.").format(
                    columns=format_summary_column_list(SCHEDULE_HABIT_ACTION_COLUMNS)
                ),
                _(
                    "Event section columns for appointments, timeblocks, and deadlines: {columns}."
                ).format(columns=format_summary_column_list(SCHEDULE_EVENT_COLUMNS)),
            ),
        ),
    )
    list_parser.add_argument(
        "--start-date",
        required=True,
        type=date.fromisoformat,
        help=_("Range start date in YYYY-MM-DD format"),
    )
    list_parser.add_argument(
        "--end-date",
        required=True,
        type=date.fromisoformat,
        help=_("Range end date in YYYY-MM-DD format"),
    )
    list_parser.set_defaults(handler=handle_schedule_list)
