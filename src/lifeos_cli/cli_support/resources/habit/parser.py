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
from lifeos_cli.i18n import cli_message as _


def build_habit_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the habit command tree."""
    habit_parser = add_documented_help_parser(
        subparsers,
        "habit",
        help_content=HelpContent(
            summary=_("messages.manage_recurring_habits_a85e7fe2"),
            description=(
                _("messages.create_and_maintain_recurring_habits_with_explicit_caden_afa95d72")
                + "\n\n"
                + _("messages.habits_define_recurring_work_query_windows_materialize_h_cd82f257")
            ),
            examples=(
                "lifeos habit add --help",
                "lifeos habit list --help",
                "lifeos habit batch --help",
            ),
            notes=(
                _("messages.use_list_as_the_primary_query_entrypoint_for_habits_e26a6666"),
                _("messages.habit_creation_and_timing_updates_no_longer_pre_generate_57865747"),
                _("messages.cadence_cycles_can_be_daily_weekly_monthly_or_yearly_whi_2dae95cd"),
                _("messages.see_lifeos_habit_batch_help_for_bulk_delete_operations_a1c4f033"),
            ),
        ),
    )
    habit_subparsers = habit_parser.add_subparsers(
        dest="habit_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    build_habit_add_parser(habit_subparsers)
    build_habit_list_parser(habit_subparsers)
    build_habit_show_parser(habit_subparsers)
    build_habit_update_parser(habit_subparsers)
    build_habit_delete_parser(habit_subparsers)
    build_habit_stats_parser(habit_subparsers)
    build_habit_task_associations_parser(habit_subparsers)
    build_habit_batch_parser(habit_subparsers)
