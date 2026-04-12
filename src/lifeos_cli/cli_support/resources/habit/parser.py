"""Habit resource parser construction."""

from __future__ import annotations

import argparse
from datetime import date
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.habit.handlers import (
    handle_habit_add,
    handle_habit_batch_delete,
    handle_habit_delete,
    handle_habit_list,
    handle_habit_show,
    handle_habit_stats,
    handle_habit_task_associations,
    handle_habit_update,
)
from lifeos_cli.i18n import gettext_message as _


def build_habit_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the habit command tree."""
    habit_parser = add_documented_parser(
        subparsers,
        "habit",
        help_content=HelpContent(
            summary=_("Manage recurring habits"),
            description=(
                _("Create and maintain recurring habits that generate dated habit-action rows.")
                + "\n\n"
                + _(
                    "A habit acts as a template. Each day in its duration produces one "
                    "habit-action record."
                )
            ),
            examples=(
                'lifeos habit add "Daily Exercise" --start-date 2026-04-09 --duration-days 21',
                "lifeos habit list --with-stats",
                "lifeos habit task-associations",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for habits."),
                _(
                    "Habit creation and timing updates automatically generate or adjust "
                    "habit-action rows."
                ),
                _("Delete operations in the public CLI always perform soft deletion."),
            ),
        ),
    )
    habit_parser.set_defaults(handler=make_help_handler(habit_parser))
    habit_subparsers = habit_parser.add_subparsers(
        dest="habit_command",
        title=_("actions"),
        metavar=_("action"),
    )

    add_parser = add_documented_parser(
        habit_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create a habit"),
            description=_("Create a recurring habit and generate its dated habit-action rows."),
            examples=(
                'lifeos habit add "Daily Exercise" --start-date 2026-04-09 --duration-days 21',
                'lifeos habit add "Morning Review" --start-date 2026-04-09 --duration-days 100 '
                "--task-id 11111111-1111-1111-1111-111111111111",
            ),
            notes=(
                _("Duration must be one of the supported program lengths."),
                _("If `--task-id` is provided, the task must already exist."),
            ),
        ),
    )
    add_parser.add_argument("title", help=_("Habit title"))
    add_parser.add_argument("--description", help=_("Optional habit description"))
    add_parser.add_argument(
        "--start-date",
        required=True,
        type=date.fromisoformat,
        help=_("Habit start date in YYYY-MM-DD format"),
    )
    add_parser.add_argument(
        "--duration-days",
        required=True,
        type=int,
        help=_("Habit duration in days"),
    )
    add_parser.add_argument("--task-id", type=UUID, help=_("Optional linked task identifier"))
    add_parser.set_defaults(handler=handle_habit_add)

    list_parser = add_documented_parser(
        habit_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List habits"),
            description=(
                _("List habits with optional status, title, and activity-window filters.")
                + "\n\n"
                + _("Use this command as the main habit query entrypoint.")
            ),
            examples=(
                "lifeos habit list",
                "lifeos habit list --status active --with-stats",
                'lifeos habit list --title "Daily Exercise" --active-window-only',
                "lifeos habit list --status active --count",
            ),
            notes=(
                _("Use `--with-stats` when the summary should include progress and streak fields."),
                _("Use `--active-window-only` to show habits whose duration still covers today."),
            ),
        ),
    )
    list_parser.add_argument("--status", help=_("Filter by habit status"))
    list_parser.add_argument("--title", help=_("Filter by exact habit title"))
    list_parser.add_argument(
        "--active-window-only",
        action="store_true",
        help=_("Restrict results to habits whose duration still covers today"),
    )
    list_parser.add_argument(
        "--with-stats",
        action="store_true",
        help=_("Include progress and streak information in each summary row"),
    )
    list_parser.add_argument("--count", action="store_true", help=_("Print total matched count"))
    add_include_deleted_argument(list_parser, noun="habits")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=handle_habit_list)

    show_parser = add_documented_parser(
        habit_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show a habit"),
            description=_("Show one habit with full metadata and derived statistics."),
            examples=(
                "lifeos habit show 11111111-1111-1111-1111-111111111111",
                "lifeos habit show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("habit_id", type=UUID, help=_("Habit identifier"))
    add_include_deleted_argument(show_parser, noun="habits", help_prefix="Allow")
    show_parser.set_defaults(handler=handle_habit_show)

    update_parser = add_documented_parser(
        habit_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update a habit"),
            description=(
                _("Update mutable habit fields.")
                + "\n\n"
                + _("Timing changes automatically reconcile generated habit-action rows.")
            ),
            examples=(
                "lifeos habit update 11111111-1111-1111-1111-111111111111 --status paused",
                "lifeos habit update 11111111-1111-1111-1111-111111111111 "
                "--duration-days 100 --start-date 2026-04-10",
                "lifeos habit update 11111111-1111-1111-1111-111111111111 --clear-task",
            ),
            notes=(
                _("Use `--clear-description` or `--clear-task` to remove optional values."),
                _("Reactivating a habit still respects the active habit limit."),
            ),
        ),
    )
    update_parser.add_argument("habit_id", type=UUID, help=_("Habit identifier"))
    update_parser.add_argument("--title", help=_("Updated habit title"))
    update_parser.add_argument("--description", help=_("Updated habit description"))
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("Clear the optional habit description"),
    )
    update_parser.add_argument(
        "--start-date",
        type=date.fromisoformat,
        help=_("Updated habit start date in YYYY-MM-DD format"),
    )
    update_parser.add_argument("--duration-days", type=int, help=_("Updated duration in days"))
    update_parser.add_argument("--status", help=_("Updated habit status"))
    update_parser.add_argument("--task-id", type=UUID, help=_("Updated linked task identifier"))
    update_parser.add_argument(
        "--clear-task",
        action="store_true",
        help=_("Remove the linked task reference"),
    )
    update_parser.set_defaults(handler=handle_habit_update)

    delete_parser = add_documented_parser(
        habit_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Soft-delete a habit"),
            description=_("Soft-delete one habit. Public CLI deletion is never permanent."),
            examples=("lifeos habit delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("habit_id", type=UUID, help=_("Habit identifier"))
    delete_parser.set_defaults(handler=handle_habit_delete)

    stats_parser = add_documented_parser(
        habit_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("Show habit statistics"),
            description=_("Show derived completion and streak statistics for one habit."),
            examples=("lifeos habit stats 11111111-1111-1111-1111-111111111111",),
        ),
    )
    stats_parser.add_argument("habit_id", type=UUID, help=_("Habit identifier"))
    stats_parser.set_defaults(handler=handle_habit_stats)

    associations_parser = add_documented_parser(
        habit_subparsers,
        "task-associations",
        help_content=HelpContent(
            summary=_("List task-to-habit associations"),
            description=_("Show active habits currently linked to tasks."),
            examples=("lifeos habit task-associations",),
        ),
    )
    associations_parser.set_defaults(handler=handle_habit_task_associations)

    batch_parser = add_documented_parser(
        habit_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run bulk habit operations"),
            description=_("Grouped namespace for multi-record habit writes."),
            examples=("lifeos habit batch delete --ids <habit-id-1> <habit-id-2>",),
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="habit_batch_command",
        title=_("batch actions"),
        metavar=_("batch-action"),
    )
    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Soft-delete multiple habits"),
            description=_("Soft-delete multiple habits in one command."),
            examples=("lifeos habit batch delete --ids <habit-id-1> <habit-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="habit_ids", noun="habit")
    batch_delete_parser.set_defaults(handler=handle_habit_batch_delete)
