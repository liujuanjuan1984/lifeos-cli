"""Habit resource parser construction."""

from __future__ import annotations

import argparse
import re
from datetime import date
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.habit.handlers import (
    HABIT_SUMMARY_COLUMNS,
    HABIT_SUMMARY_WITH_STATS_COLUMNS,
    HABIT_TASK_ASSOCIATION_COLUMNS,
    handle_habit_add_async,
    handle_habit_batch_delete_async,
    handle_habit_delete_async,
    handle_habit_list_async,
    handle_habit_show_async,
    handle_habit_stats_async,
    handle_habit_task_associations_async,
    handle_habit_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _

_WEEKDAY_SPLIT_PATTERN = re.compile(r"[\s,]+")


def _parse_habit_weekdays(value: str) -> list[str]:
    """Parse one CLI weekday list into canonical tokens."""
    weekdays = [part for part in _WEEKDAY_SPLIT_PATTERN.split(value.strip()) if part]
    if not weekdays:
        raise argparse.ArgumentTypeError(
            "Expected at least one weekday, for example `monday,wednesday,friday`."
        )
    return weekdays


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
                    "A habit acts as a recurring definition. Query windows materialize "
                    "habit-action occurrences on demand, while cadence controls how progress "
                    "is evaluated across daily, weekly, monthly, or yearly cycles."
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

    add_parser = add_documented_parser(
        habit_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create a habit"),
            description=_("Create a recurring habit with cadence-aligned on-demand occurrences."),
            examples=(
                'lifeos habit add "Daily Exercise" --start-date 2026-04-09 --duration-days 21',
                'lifeos habit add "Morning Review" --start-date 2026-04-09 --duration-days 100 '
                "--task-id 11111111-1111-1111-1111-111111111111",
                'lifeos habit add "Gym" --start-date 2026-04-09 --duration-days 100 '
                "--cadence-frequency weekly --weekdays monday,wednesday,friday "
                "--target-per-week 3",
                'lifeos habit add "Read annual plan" --start-date 2026-01-01 --duration-days 365 '
                "--cadence-frequency yearly --target-per-cycle 6",
            ),
            notes=(
                _("Duration must be one of the supported program lengths."),
                _(
                    "Use `--cadence-frequency` to choose daily, weekly, monthly, or yearly "
                    "evaluation cycles."
                ),
                _(
                    "`--weekdays` restricts on-demand habit-action occurrences "
                    "to selected weekdays."
                ),
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
    add_parser.add_argument(
        "--cadence-frequency",
        default="daily",
        help=_("Habit cadence frequency: daily, weekly, monthly, or yearly"),
    )
    add_parser.add_argument(
        "--weekdays",
        type=_parse_habit_weekdays,
        help=_("Allowed weekdays, for example monday,wednesday,friday"),
    )
    add_parser.add_argument(
        "--weekends-only",
        action="store_true",
        help=_("Shortcut for `--weekdays saturday,sunday`"),
    )
    add_parser.add_argument(
        "--target-per-cycle",
        dest="target_per_cycle",
        type=int,
        help=_("Cadence target count for one cycle. Daily habits must keep 1."),
    )
    add_parser.add_argument(
        "--target-per-week",
        dest="target_per_cycle",
        type=int,
        help=_("Weekly alias for `--target-per-cycle`"),
    )
    add_parser.add_argument("--task-id", type=UUID, help=_("Optional linked task identifier"))
    add_parser.set_defaults(handler=make_sync_handler(handle_habit_add_async))

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
                _(
                    "Use `--with-stats` when the summary should include cycle progress "
                    "and streak fields."
                ),
                _("Use `--active-window-only` to show habits whose duration still covers today."),
                _(
                    "Default list output prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(HABIT_SUMMARY_COLUMNS)),
                _("With `--with-stats`, the header changes to: {columns}.").format(
                    columns=format_summary_column_list(HABIT_SUMMARY_WITH_STATS_COLUMNS)
                ),
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
    list_parser.set_defaults(handler=make_sync_handler(handle_habit_list_async))

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
    show_parser.set_defaults(handler=make_sync_handler(handle_habit_show_async))

    update_parser = add_documented_parser(
        habit_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update a habit"),
            description=(
                _("Update mutable habit fields.")
                + "\n\n"
                + _(
                    "Cadence and timing changes reconcile materialized habit-action records "
                    "without regenerating full histories."
                )
            ),
            examples=(
                "lifeos habit update 11111111-1111-1111-1111-111111111111 --status paused",
                "lifeos habit update 11111111-1111-1111-1111-111111111111 "
                "--duration-days 100 --start-date 2026-04-10",
                "lifeos habit update 11111111-1111-1111-1111-111111111111 "
                "--cadence-frequency weekly --weekends-only --target-per-week 1",
                "lifeos habit update 11111111-1111-1111-1111-111111111111 "
                "--cadence-frequency monthly --target-per-cycle 2",
                "lifeos habit update 11111111-1111-1111-1111-111111111111 --clear-weekdays",
                "lifeos habit update 11111111-1111-1111-1111-111111111111 --clear-task",
            ),
            notes=(
                _("Use `--clear-description` or `--clear-task` to remove optional values."),
                _(
                    "Use `--clear-weekdays` to remove weekday restrictions without "
                    "resetting cadence."
                ),
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
    update_parser.add_argument(
        "--cadence-frequency",
        help=_("Updated cadence frequency: daily, weekly, monthly, or yearly"),
    )
    update_parser.add_argument(
        "--weekdays",
        type=_parse_habit_weekdays,
        help=_("Updated allowed weekdays, for example monday,wednesday,friday"),
    )
    update_parser.add_argument(
        "--weekends-only",
        action="store_true",
        help=_("Shortcut for `--weekdays saturday,sunday`"),
    )
    update_parser.add_argument(
        "--clear-weekdays",
        action="store_true",
        help=_("Remove weekday restrictions from the habit cadence"),
    )
    update_parser.add_argument(
        "--target-per-cycle",
        dest="target_per_cycle",
        type=int,
        help=_("Updated cadence target count for one cycle"),
    )
    update_parser.add_argument(
        "--target-per-week",
        dest="target_per_cycle",
        type=int,
        help=_("Weekly alias for `--target-per-cycle`"),
    )
    update_parser.add_argument("--status", help=_("Updated habit status"))
    update_parser.add_argument("--task-id", type=UUID, help=_("Updated linked task identifier"))
    update_parser.add_argument(
        "--clear-task",
        action="store_true",
        help=_("Remove the linked task reference"),
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_habit_update_async))

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
    delete_parser.set_defaults(handler=make_sync_handler(handle_habit_delete_async))

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

    batch_parser = add_documented_help_parser(
        habit_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run bulk habit operations"),
            description=_("Soft-delete multiple habits in one command."),
            examples=(
                "lifeos habit batch delete --help",
                "lifeos habit batch delete --ids <habit-id-1> <habit-id-2>",
            ),
            notes=(_("This namespace currently exposes only the `delete` workflow."),),
        ),
    )
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
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_habit_batch_delete_async))
