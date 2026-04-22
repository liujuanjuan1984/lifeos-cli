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
        _(
            "resources.schedule.parser.non_empty_schedule_sections_print_tab_separated_header_row_before_their_entries"
        ),
        _("resources.schedule.parser.task_section_columns_columns").format(
            columns=format_summary_column_list(SCHEDULE_TASK_COLUMNS)
        ),
        _("resources.schedule.parser.habit_action_section_columns_columns").format(
            columns=format_summary_column_list(SCHEDULE_HABIT_ACTION_COLUMNS)
        ),
        _("resources.schedule.parser.event_section_columns_columns").format(
            columns=format_summary_column_list(SCHEDULE_EVENT_COLUMNS)
        ),
    )


def _add_hide_overdue_unfinished_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--hide-overdue-unfinished",
        action="store_true",
        help=_(
            "resources.schedule.parser.hide_overdue_unfinished_planning_tasks_and_habit_actions"
        ),
    )


def build_schedule_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the schedule command tree."""
    schedule_parser = add_documented_help_parser(
        subparsers,
        "schedule",
        help_content=HelpContent(
            summary=_("resources.schedule.parser.inspect_aggregated_schedule_views"),
            description=(
                _("resources.schedule.parser.show_schedule_views_grouped_by_local_date")
                + "\n\n"
                + _(
                    "resources.schedule.parser.schedule_is_cli_read_model_built_from_tasks_habit_actions_and_events"
                )
            ),
            examples=(
                "lifeos schedule show --help",
                "lifeos schedule list --help",
            ),
            notes=(
                _("resources.schedule.parser.use_show_for_one_exact_local_day"),
                _("resources.schedule.parser.use_list_for_inclusive_multi_day_ranges"),
                _(
                    "resources.schedule.parser.dates_use_configured_timezone_and_day_starts_at_preference"
                ),
                _(
                    "resources.schedule.parser.schedule_reads_from_existing_domains_and_does_not_create_new_stored_entity"
                ),
            ),
        ),
    )
    schedule_subparsers = schedule_parser.add_subparsers(
        dest="schedule_command",
        title=_("common.messages.actions"),
        metavar=_("common.messages.action"),
    )

    show_parser = add_documented_parser(
        schedule_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("resources.schedule.parser.show_one_schedule_day"),
            description=(
                _("resources.schedule.parser.show_aggregated_schedule_for_one_local_day")
                + "\n\n"
                + _(
                    "resources.schedule.parser.tasks_appear_when_local_date_falls_inside_their_planning_cycle_window_overdue"
                )
            ),
            examples=("lifeos schedule show", "lifeos schedule show --date 2026-04-10"),
            notes=(
                _(
                    "resources.schedule.parser.the_output_groups_tasks_habit_actions_and_event_occurrences_for_day"
                ),
                _(
                    "resources.schedule.parser.task_rows_come_from_planning_cycle_overlap_not_from_event_timeblocks"
                ),
                _(
                    "resources.schedule.parser.habit_action_rows_use_action_date_earlier_pending_rows_remain_visible_until"
                ),
                _(
                    "resources.schedule.parser.when_date_is_omitted_show_uses_current_configured_local_date"
                ),
                _(
                    "resources.schedule.parser.use_list_when_you_need_same_schedule_view_across_inclusive_date_range"
                ),
                _(
                    "resources.schedule.parser.event_rows_stay_under_event_section_and_include_their_event_type"
                ),
                _(
                    "resources.schedule.parser.overdue_unfinished_planning_tasks_and_habit_actions_are_shown_by_default_use"
                ),
                *_build_schedule_section_header_notes(),
            ),
        ),
    )
    show_parser.add_argument(
        "--date",
        dest="target_date",
        type=date.fromisoformat,
        help=_(
            "resources.schedule.parser.target_local_date_in_yyyy_mm_dd_format_defaults_to_today_when"
        ),
    )
    _add_hide_overdue_unfinished_argument(show_parser)
    show_parser.set_defaults(handler=make_sync_handler(handle_schedule_show_async))

    list_parser = add_documented_parser(
        schedule_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("resources.schedule.parser.list_schedule_range"),
            description=_(
                "resources.schedule.parser.show_aggregated_schedule_for_one_local_date_or_inclusive_range"
            ),
            examples=("lifeos schedule list --date 2026-04-10 --date 2026-04-16",),
            notes=(
                _("common.messages.repeat_date_once_for_one_local_date_or_twice_for_one_inclusive"),
                _(
                    "resources.schedule.parser.use_show_when_you_want_single_day_entrypoint_with_same_sections"
                ),
                _(
                    "resources.schedule.parser.recurring_event_occurrences_are_expanded_inside_requested_range"
                ),
                _(
                    "resources.schedule.parser.event_rows_stay_under_event_section_and_include_their_event_type"
                ),
                _(
                    "resources.schedule.parser.overdue_unfinished_planning_tasks_and_habit_actions_are_shown_by_default_use"
                ),
                *_build_schedule_section_header_notes(),
            ),
        ),
    )
    add_date_range_arguments(
        list_parser,
        date_help=_(
            "common.messages.repeat_once_for_one_local_date_or_twice_for_one_inclusive_local"
        ),
    )
    _add_hide_overdue_unfinished_argument(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_schedule_list_async))
