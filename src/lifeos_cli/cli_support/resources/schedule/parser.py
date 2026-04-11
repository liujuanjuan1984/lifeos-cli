"""Schedule resource parser construction."""

from __future__ import annotations

import argparse
from datetime import date

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.resources.schedule.handlers import (
    handle_schedule_list,
    handle_schedule_show,
)


def build_schedule_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the schedule command tree."""
    schedule_parser = add_documented_parser(
        subparsers,
        "schedule",
        help_content=HelpContent(
            summary="Inspect aggregated schedule views",
            description=(
                "Show schedule views grouped by local date.\n\n"
                "Schedule is a CLI read model built from tasks, habit actions, and events, "
                "including expanded recurring event occurrences."
            ),
            examples=(
                "lifeos schedule show --date 2026-04-10",
                "lifeos schedule list --start-date 2026-04-10 --end-date 2026-04-16",
            ),
            notes=(
                "Use `show` for one exact local day.",
                "Use `list` for multi-day ranges.",
                "Dates use the configured timezone and `day_starts_at` preference.",
                "Event output is segmented into appointment, timeblock, and deadline sections.",
                "Schedule reads from existing domains and does not create a new stored entity.",
            ),
        ),
    )
    schedule_parser.set_defaults(handler=make_help_handler(schedule_parser))
    schedule_subparsers = schedule_parser.add_subparsers(
        dest="schedule_command", title="actions", metavar="action"
    )

    show_parser = add_documented_parser(
        schedule_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show one schedule day",
            description="Show the aggregated schedule for one local day.",
            examples=("lifeos schedule show --date 2026-04-10",),
            notes=(
                "The output groups tasks, habit actions, and event occurrences for the day.",
                "Event occurrences are split into appointment, timeblock, and deadline sections.",
            ),
        ),
    )
    show_parser.add_argument(
        "--date",
        dest="target_date",
        required=True,
        type=date.fromisoformat,
        help="Target local date in YYYY-MM-DD format",
    )
    show_parser.set_defaults(handler=handle_schedule_show)

    list_parser = add_documented_parser(
        schedule_subparsers,
        "list",
        help_content=HelpContent(
            summary="List a schedule range",
            description="Show the aggregated schedule for a local-date range.",
            examples=("lifeos schedule list --start-date 2026-04-10 --end-date 2026-04-16",),
            notes=(
                "The range is inclusive on both start and end dates.",
                "Recurring event occurrences are expanded inside the requested range.",
                "Event occurrences remain segmented by type inside each day block.",
            ),
        ),
    )
    list_parser.add_argument(
        "--start-date",
        required=True,
        type=date.fromisoformat,
        help="Range start date in YYYY-MM-DD format",
    )
    list_parser.add_argument(
        "--end-date",
        required=True,
        type=date.fromisoformat,
        help="Range end date in YYYY-MM-DD format",
    )
    list_parser.set_defaults(handler=handle_schedule_list)
