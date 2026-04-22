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
from lifeos_cli.i18n import cli_message as _


def _build_schedule_section_header_notes() -> tuple[str, ...]:
    """Describe the section header schema used by aggregated schedule output."""
    return (
        _("messages.non_empty_schedule_sections_print_a_tab_separated_header_930d64f0"),
        _("messages.task_section_columns_columns_c13e4218").format(
            columns=format_summary_column_list(SCHEDULE_TASK_COLUMNS)
        ),
        _("messages.habit_action_section_columns_columns_d3a0f385").format(
            columns=format_summary_column_list(SCHEDULE_HABIT_ACTION_COLUMNS)
        ),
        _("messages.event_section_columns_columns_d47a79e1").format(
            columns=format_summary_column_list(SCHEDULE_EVENT_COLUMNS)
        ),
    )


def _add_hide_overdue_unfinished_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--hide-overdue-unfinished",
        action="store_true",
        help=_("messages.hide_overdue_unfinished_planning_tasks_and_habit_actions_0ba4db2c"),
    )


def build_schedule_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the schedule command tree."""
    schedule_parser = add_documented_help_parser(
        subparsers,
        "schedule",
        help_content=HelpContent(
            summary=_("messages.inspect_aggregated_schedule_views_02980e60"),
            description=(
                _("messages.show_schedule_views_grouped_by_local_date_c46106c9")
                + "\n\n"
                + _("messages.schedule_is_a_cli_read_model_built_from_tasks_habit_acti_e65a5fb4")
            ),
            examples=(
                "lifeos schedule show --help",
                "lifeos schedule list --help",
            ),
            notes=(
                _("messages.use_show_for_one_exact_local_day_067d48f7"),
                _("messages.use_list_for_inclusive_multi_day_ranges_f2820178"),
                _("messages.dates_use_the_configured_timezone_and_day_starts_at_pref_28eaf2d4"),
                _("messages.schedule_reads_from_existing_domains_and_does_not_create_e72139bf"),
            ),
        ),
    )
    schedule_subparsers = schedule_parser.add_subparsers(
        dest="schedule_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    show_parser = add_documented_parser(
        schedule_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_one_schedule_day_0bff0895"),
            description=(
                _("messages.show_the_aggregated_schedule_for_one_local_day_b0b6ce8f")
                + "\n\n"
                + _("messages.tasks_appear_when_the_local_date_falls_inside_their_plan_0a58dda7")
            ),
            examples=("lifeos schedule show", "lifeos schedule show --date 2026-04-10"),
            notes=(
                _("messages.the_output_groups_tasks_habit_actions_and_event_occurren_6201cf0e"),
                _("messages.task_rows_come_from_planning_cycle_overlap_not_from_even_90d14ccf"),
                _("messages.habit_action_rows_use_action_date_earlier_pending_rows_r_3bb08a35"),
                _("messages.when_date_is_omitted_show_uses_the_current_configured_lo_63d84a52"),
                _("messages.use_list_when_you_need_the_same_schedule_view_across_an_f605c81a"),
                _("messages.event_rows_stay_under_the_event_section_and_include_thei_65206f2f"),
                _("messages.overdue_unfinished_planning_tasks_and_habit_actions_are_eb42f95b"),
                *_build_schedule_section_header_notes(),
            ),
        ),
    )
    show_parser.add_argument(
        "--date",
        dest="target_date",
        type=date.fromisoformat,
        help=_("messages.target_local_date_in_yyyy_mm_dd_format_defaults_to_today_5ea5a4cf"),
    )
    _add_hide_overdue_unfinished_argument(show_parser)
    show_parser.set_defaults(handler=make_sync_handler(handle_schedule_show_async))

    list_parser = add_documented_parser(
        schedule_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("messages.list_a_schedule_range_e149fa14"),
            description=_(
                "messages.show_the_aggregated_schedule_for_one_local_date_or_an_in_8cd15729"
            ),
            examples=("lifeos schedule list --date 2026-04-10 --date 2026-04-16",),
            notes=(
                _("messages.repeat_date_once_for_one_local_date_or_twice_for_one_inc_0574ebc4"),
                _("messages.use_show_when_you_want_the_single_day_entrypoint_with_th_78b62121"),
                _("messages.recurring_event_occurrences_are_expanded_inside_the_requ_d33f14b1"),
                _("messages.event_rows_stay_under_the_event_section_and_include_thei_65206f2f"),
                _("messages.overdue_unfinished_planning_tasks_and_habit_actions_are_eb42f95b"),
                *_build_schedule_section_header_notes(),
            ),
        ),
    )
    add_date_range_arguments(
        list_parser,
        date_help=_("messages.repeat_once_for_one_local_date_or_twice_for_one_inclusiv_b2bcbda1"),
    )
    _add_hide_overdue_unfinished_argument(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_schedule_list_async))
