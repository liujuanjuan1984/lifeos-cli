"""Schedule resource parser construction."""

from __future__ import annotations

import argparse
from datetime import date

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import add_date_range_arguments
from lifeos_cli.cli_support.resources.schedule.handlers import (
    SCHEDULE_EVENT_COLUMNS,
    SCHEDULE_HABIT_ACTION_COLUMNS,
    SCHEDULE_TASK_COLUMNS,
    handle_schedule_list_async,
    handle_schedule_show_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def _build_schedule_section_header_notes() -> tuple[str, ...]:
    """Describe the section header schema used by aggregated schedule output."""
    return (
        _("Non-empty schedule sections print a tab-separated header row before their entries."),
        _("Task section columns: {columns}.").format(
            columns=format_summary_column_list(SCHEDULE_TASK_COLUMNS)
        ),
        _("Habit action section columns: {columns}.").format(
            columns=format_summary_column_list(SCHEDULE_HABIT_ACTION_COLUMNS)
        ),
        _("Event section columns: {columns}.").format(
            columns=format_summary_column_list(SCHEDULE_EVENT_COLUMNS)
        ),
    )


def _add_hide_overdue_unfinished_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--hide-overdue-unfinished",
        action="store_true",
        help=_("Hide overdue unfinished planning tasks and habit actions"),
    )


def build_schedule_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the schedule command tree."""
    schedule_parser = add_documented_help_parser(
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
                "lifeos schedule show --help",
                "lifeos schedule list --help",
            ),
            notes=(
                _("Use `show` for one exact local day."),
                _("Use `list` for inclusive multi-day ranges."),
                _("Dates use the configured timezone and `day_starts_at` preference."),
                _("Schedule reads from existing domains and does not create a new stored entity."),
            ),
        ),
    )
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
                    "Tasks appear when the local date falls inside their planning-cycle window. "
                    "Overdue unfinished tasks and habit actions also roll forward into "
                    "non-future schedule days. Events appear when their scheduled time overlaps "
                    "that day."
                )
            ),
            examples=("lifeos schedule show", "lifeos schedule show --date 2026-04-10"),
            notes=(
                _("The output groups tasks, habit actions, and event occurrences for the day."),
                _("Task rows come from planning-cycle overlap, not from event timeblocks."),
                _(
                    "Habit action rows use `action_date`; earlier unfinished rows remain visible "
                    "until hidden with `--hide-overdue-unfinished`."
                ),
                _("When `--date` is omitted, `show` uses the current configured local date."),
                _(
                    "Use `list` when you need the same schedule view across an inclusive "
                    "date range."
                ),
                _("Event rows stay under the event section and include their `event_type`."),
                _(
                    "Overdue unfinished planning tasks and habit actions are shown by default; "
                    "use `--hide-overdue-unfinished` to hide them."
                ),
                *_build_schedule_section_header_notes(),
            ),
        ),
    )
    show_parser.add_argument(
        "--date",
        dest="target_date",
        type=date.fromisoformat,
        help=_("Target local date in YYYY-MM-DD format; defaults to today when omitted"),
    )
    _add_hide_overdue_unfinished_argument(show_parser)
    show_parser.set_defaults(handler=make_sync_handler(handle_schedule_show_async))

    list_parser = add_documented_parser(
        schedule_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List a schedule range"),
            description=_("Show the aggregated schedule for one local date or an inclusive range."),
            examples=("lifeos schedule list --date 2026-04-10 --date 2026-04-16",),
            notes=(
                _(
                    "Repeat `--date` once for one local date or twice for one inclusive "
                    "local-date range."
                ),
                _("Use `show` when you want the single-day entrypoint with the same sections."),
                _("Recurring event occurrences are expanded inside the requested range."),
                _("Event rows stay under the event section and include their `event_type`."),
                _(
                    "Overdue unfinished planning tasks and habit actions are shown by default; "
                    "use `--hide-overdue-unfinished` to hide them."
                ),
                *_build_schedule_section_header_notes(),
            ),
        ),
    )
    add_date_range_arguments(
        list_parser,
        date_help=_(
            "Repeat once for one local date or twice for one inclusive local-date range "
            "in YYYY-MM-DD format"
        ),
    )
    _add_hide_overdue_unfinished_argument(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_schedule_list_async))
