"""Builder helpers for core habit commands."""

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
from lifeos_cli.i18n import cli_message as _

_WEEKDAY_SPLIT_PATTERN = re.compile(r"[\s,]+")


def _parse_habit_weekdays(value: str) -> list[str]:
    """Parse one CLI weekday list into canonical tokens."""
    weekdays = [part for part in _WEEKDAY_SPLIT_PATTERN.split(value.strip()) if part]
    if not weekdays:
        raise argparse.ArgumentTypeError(
            "Expected at least one weekday, for example `monday,wednesday,friday`."
        )
    return weekdays


def build_habit_add_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit add command."""
    add_parser = add_documented_parser(
        habit_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("messages.create_a_habit_cb8fcf74"),
            description=_(
                "messages.create_a_recurring_habit_with_cadence_aligned_on_demand_98ecd5be"
            ),
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
                _("messages.duration_must_be_one_of_the_supported_program_lengths_9205f44d"),
                _("messages.use_cadence_frequency_to_choose_daily_weekly_monthly_or_ddf6a78b"),
                _("messages.weekdays_restricts_on_demand_habit_action_occurrences_to_ea85ef52"),
                _("messages.if_task_id_is_provided_the_task_must_already_exist_d53cbc34"),
            ),
        ),
    )
    add_parser.add_argument("title", help=_("messages.habit_title_f9978d48"))
    add_parser.add_argument("--description", help=_("messages.optional_habit_description_f84cfedd"))
    add_parser.add_argument(
        "--start-date",
        required=True,
        type=date.fromisoformat,
        help=_("messages.habit_start_date_in_yyyy_mm_dd_format_7e91d5d4"),
    )
    add_parser.add_argument(
        "--duration-days",
        required=True,
        type=int,
        help=_("messages.habit_duration_in_days_4f87bd2b"),
    )
    add_parser.add_argument(
        "--cadence-frequency",
        default="daily",
        help=_("messages.habit_cadence_frequency_daily_weekly_monthly_or_yearly_bb11048a"),
    )
    add_parser.add_argument(
        "--weekdays",
        type=_parse_habit_weekdays,
        help=_("messages.allowed_weekdays_for_example_monday_wednesday_friday_716c8ff7"),
    )
    add_parser.add_argument(
        "--weekends-only",
        action="store_true",
        help=_("messages.shortcut_for_weekdays_saturday_sunday_8cce4458"),
    )
    add_parser.add_argument(
        "--target-per-cycle",
        dest="target_per_cycle",
        type=int,
        help=_("messages.cadence_target_count_for_one_cycle_daily_habits_must_kee_1f90f1af"),
    )
    add_parser.add_argument(
        "--target-per-week",
        dest="target_per_cycle",
        type=int,
        help=_("messages.weekly_alias_for_target_per_cycle_2adeaeb9"),
    )
    add_parser.add_argument(
        "--task-id", type=UUID, help=_("messages.optional_linked_task_identifier_ee0966fa")
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_habit_add_async))


def build_habit_list_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit list command."""
    list_parser = add_documented_parser(
        habit_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("messages.list_habits_e59ebbc9"),
            description=(
                _("messages.list_habits_with_optional_status_title_and_activity_wind_d4e358a6")
                + "\n\n"
                + _("messages.use_this_command_as_the_primary_query_entrypoint_for_hab_8697b6e4")
            ),
            examples=(
                "lifeos habit list",
                "lifeos habit list --status active --with-stats",
                'lifeos habit list --title "Daily Exercise" --active-window-only',
                "lifeos habit list --status active --count",
            ),
            notes=(
                _("messages.use_with_stats_when_the_summary_should_include_cycle_pro_20e931b4"),
                _("messages.use_active_window_only_to_show_habits_whose_duration_sti_c1783dfe"),
                _(
                    "messages.default_list_output_prints_a_header_row_followed_by_tab_c00fead9"
                ).format(columns=format_summary_column_list(HABIT_SUMMARY_COLUMNS)),
                _("messages.with_with_stats_the_header_changes_to_columns_4640ebee").format(
                    columns=format_summary_column_list(HABIT_SUMMARY_WITH_STATS_COLUMNS)
                ),
            ),
        ),
    )
    list_parser.add_argument("--status", help=_("messages.filter_by_habit_status_100f19e0"))
    list_parser.add_argument("--title", help=_("messages.filter_by_exact_habit_title_cd89d9b3"))
    list_parser.add_argument(
        "--active-window-only",
        action="store_true",
        help=_("messages.restrict_results_to_habits_whose_duration_still_covers_t_f2a0bc12"),
    )
    list_parser.add_argument(
        "--with-stats",
        action="store_true",
        help=_("messages.include_progress_and_streak_information_in_each_summary_07568227"),
    )
    list_parser.add_argument(
        "--count", action="store_true", help=_("messages.print_total_matched_count_b60ad049")
    )
    add_include_deleted_argument(list_parser, noun="habits")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_habit_list_async))


def build_habit_show_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit show command."""
    show_parser = add_documented_parser(
        habit_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_a_habit_70abfd28"),
            description=_(
                "messages.show_one_habit_with_full_metadata_and_derived_statistics_d35d94a2"
            ),
            examples=(
                "lifeos habit show 11111111-1111-1111-1111-111111111111",
                "lifeos habit show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("habit_id", type=UUID, help=_("messages.habit_identifier_e1aa7a05"))
    add_include_deleted_argument(show_parser, noun="habits", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_habit_show_async))


def build_habit_update_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit update command."""
    update_parser = add_documented_parser(
        habit_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("messages.update_a_habit_91b3b7e0"),
            description=(
                _("messages.update_mutable_habit_fields_364be941")
                + "\n\n"
                + _("messages.cadence_and_timing_changes_reconcile_materialized_habit_42a06227")
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
                _("messages.use_clear_description_or_clear_task_to_remove_optional_v_fd2fb2a5"),
                _("messages.use_clear_weekdays_to_remove_weekday_restrictions_withou_f667d530"),
                _("messages.reactivating_a_habit_still_respects_the_active_habit_lim_5ce2e6f7"),
            ),
        ),
    )
    update_parser.add_argument("habit_id", type=UUID, help=_("messages.habit_identifier_e1aa7a05"))
    update_parser.add_argument("--title", help=_("messages.updated_habit_title_8c537cc0"))
    update_parser.add_argument(
        "--description", help=_("messages.updated_habit_description_9a105b5a")
    )
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("messages.clear_the_optional_habit_description_bac8e06e"),
    )
    update_parser.add_argument(
        "--start-date",
        type=date.fromisoformat,
        help=_("messages.updated_habit_start_date_in_yyyy_mm_dd_format_ce18f425"),
    )
    update_parser.add_argument(
        "--duration-days", type=int, help=_("messages.updated_duration_in_days_3fa305f7")
    )
    update_parser.add_argument(
        "--cadence-frequency",
        help=_("messages.updated_cadence_frequency_daily_weekly_monthly_or_yearly_e2dbfba2"),
    )
    update_parser.add_argument(
        "--weekdays",
        type=_parse_habit_weekdays,
        help=_("messages.updated_allowed_weekdays_for_example_monday_wednesday_fr_c7f11e93"),
    )
    update_parser.add_argument(
        "--weekends-only",
        action="store_true",
        help=_("messages.shortcut_for_weekdays_saturday_sunday_8cce4458"),
    )
    update_parser.add_argument(
        "--clear-weekdays",
        action="store_true",
        help=_("messages.remove_weekday_restrictions_from_the_habit_cadence_8d138d31"),
    )
    update_parser.add_argument(
        "--target-per-cycle",
        dest="target_per_cycle",
        type=int,
        help=_("messages.updated_cadence_target_count_for_one_cycle_00ff62bb"),
    )
    update_parser.add_argument(
        "--target-per-week",
        dest="target_per_cycle",
        type=int,
        help=_("messages.weekly_alias_for_target_per_cycle_2adeaeb9"),
    )
    update_parser.add_argument("--status", help=_("messages.updated_habit_status_cc4995bd"))
    update_parser.add_argument(
        "--task-id", type=UUID, help=_("messages.updated_linked_task_identifier_50e34b5a")
    )
    update_parser.add_argument(
        "--clear-task",
        action="store_true",
        help=_("messages.remove_the_linked_task_reference_90a3c063"),
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_habit_update_async))


def build_habit_delete_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit delete command."""
    delete_parser = add_documented_parser(
        habit_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_a_habit_2c94871e"),
            description=_("messages.delete_one_habit_0db2235c"),
            examples=("lifeos habit delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("habit_id", type=UUID, help=_("messages.habit_identifier_e1aa7a05"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_habit_delete_async))


def build_habit_stats_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit stats command."""
    stats_parser = add_documented_parser(
        habit_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("messages.show_habit_statistics_3e37e627"),
            description=_(
                "messages.show_derived_completion_and_streak_statistics_for_one_ha_da8729f3"
            ),
            examples=("lifeos habit stats 11111111-1111-1111-1111-111111111111",),
            notes=(
                _("messages.these_metrics_are_derived_from_cadence_settings_together_73ca6bab"),
                _("messages.use_show_when_you_also_need_the_underlying_habit_fields_bce03af3"),
            ),
        ),
    )
    stats_parser.add_argument("habit_id", type=UUID, help=_("messages.habit_identifier_e1aa7a05"))
    stats_parser.set_defaults(handler=make_sync_handler(handle_habit_stats_async))


def build_habit_task_associations_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit task-associations command."""
    associations_parser = add_documented_parser(
        habit_subparsers,
        "task-associations",
        help_content=HelpContent(
            summary=_("messages.list_task_to_habit_associations_1ac86c9a"),
            description=_("messages.show_active_habits_currently_linked_to_tasks_bc6d28c5"),
            examples=("lifeos habit task-associations",),
            notes=(
                _("messages.use_this_command_to_audit_which_active_habits_are_still_91299ff5"),
                _(
                    "messages.when_results_exist_the_command_prints_a_header_row_follo_52827ea6"
                ).format(columns=format_summary_column_list(HABIT_TASK_ASSOCIATION_COLUMNS)),
            ),
        ),
    )
    associations_parser.set_defaults(
        handler=make_sync_handler(handle_habit_task_associations_async)
    )


def build_habit_batch_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit batch command tree."""
    batch_parser = add_documented_help_parser(
        habit_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("messages.run_bulk_habit_operations_a8cad038"),
            description=_("messages.delete_multiple_habits_in_one_command_cfba9dc0"),
            examples=(
                "lifeos habit batch delete --help",
                "lifeos habit batch delete --ids <habit-id-1> <habit-id-2>",
            ),
            notes=(
                _("messages.this_namespace_currently_exposes_only_the_delete_workflo_8e17bac4"),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="habit_batch_command",
        title=_("messages.batch_actions_fb880b71"),
        metavar=_("messages.batch_action_a7c086fa"),
    )
    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_multiple_habits_3ae01222"),
            description=_("messages.delete_multiple_habits_in_one_command_cfba9dc0"),
            examples=("lifeos habit batch delete --ids <habit-id-1> <habit-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="habit_ids", noun="habit")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_habit_batch_delete_async))
