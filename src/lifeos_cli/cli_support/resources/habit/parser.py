"""Habit resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
)
from lifeos_cli.cli_support.resources.habit.parser_actions import (
    build_habit_add_parser,
    build_habit_batch_parser,
    build_habit_delete_parser,
    build_habit_list_parser,
    build_habit_show_parser,
    build_habit_stats_parser,
    build_habit_task_associations_parser,
    build_habit_update_parser,
)
from lifeos_cli.i18n import gettext_message as _


def build_habit_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the habit command tree."""
    habit_parser = add_documented_help_parser(
        subparsers,
        "habit",
        help_content=HelpContent(
            summary=_("Manage recurring habits"),
            description=(
                _("Create and maintain recurring habits with explicit cadence rules.")
                + "\n\n"
                + _(
                    "Habits define recurring work. Query windows materialize habit-action "
                    "occurrences on demand, and cadence decides how progress is measured."
                )
            ),
            examples=(
                "lifeos habit add --help",
                "lifeos habit list --help",
                "lifeos habit batch --help",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for habits."),
                _(
                    "Habit creation and timing updates no longer pre-generate full "
                    "habit-action histories."
                ),
                _(
                    "Cadence cycles can be daily, weekly, monthly, or yearly, while "
                    "habit-action occurrences remain date-based."
                ),
                _("See `lifeos habit batch --help` for bulk delete operations."),
            ),
        ),
    )
    habit_subparsers = habit_parser.add_subparsers(
        dest="habit_command",
        title=_("actions"),
        metavar=_("action"),
    )

    build_habit_add_parser(habit_subparsers)
    build_habit_list_parser(habit_subparsers)
    build_habit_show_parser(habit_subparsers)
    build_habit_update_parser(habit_subparsers)
    build_habit_delete_parser(habit_subparsers)
    build_habit_stats_parser(habit_subparsers)
    build_habit_task_associations_parser(habit_subparsers)
    build_habit_batch_parser(habit_subparsers)
