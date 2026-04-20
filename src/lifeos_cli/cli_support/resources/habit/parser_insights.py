"""Builder helpers for habit insight commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.resources.habit.handlers import (
    HABIT_TASK_ASSOCIATION_COLUMNS,
    handle_habit_stats_async,
    handle_habit_task_associations_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_habit_stats_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit stats command."""
    stats_parser = add_documented_parser(
        habit_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("Show habit statistics"),
            description=_("Show derived completion and streak statistics for one habit."),
            examples=("lifeos habit stats 11111111-1111-1111-1111-111111111111",),
            notes=(
                _(
                    "These metrics are derived from cadence settings together with materialized "
                    "`habit-action` records."
                ),
                _("Use `show` when you also need the underlying habit fields in the same output."),
            ),
        ),
    )
    stats_parser.add_argument("habit_id", type=UUID, help=_("Habit identifier"))
    stats_parser.set_defaults(handler=make_sync_handler(handle_habit_stats_async))


def build_habit_task_associations_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit task-associations command."""
    associations_parser = add_documented_parser(
        habit_subparsers,
        "task-associations",
        help_content=HelpContent(
            summary=_("List task-to-habit associations"),
            description=_("Show active habits currently linked to tasks."),
            examples=("lifeos habit task-associations",),
            notes=(
                _("Use this command to audit which active habits are still attached to tasks."),
                _(
                    "When results exist, the command prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(HABIT_TASK_ASSOCIATION_COLUMNS)),
            ),
        ),
    )
    associations_parser.set_defaults(
        handler=make_sync_handler(handle_habit_task_associations_async)
    )
