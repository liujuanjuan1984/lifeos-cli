"""Habit-action resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_date_range_arguments,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.habit_action.handlers import (
    HABIT_ACTION_SUMMARY_COLUMNS,
    handle_habit_action_list_async,
    handle_habit_action_log_async,
    handle_habit_action_show_async,
    handle_habit_action_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.cli_support.time_args import parse_date_value
from lifeos_cli.i18n import cli_message as _


def build_habit_action_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit-action command tree."""
    action_parser = add_documented_help_parser(
        subparsers,
        "habit-action",
        help_content=HelpContent(
            summary=_("messages.manage_dated_habit_actions_63327a0f"),
            description=(
                _("messages.inspect_and_update_dated_habit_action_occurrences_materi_d09df8b6")
                + "\n\n"
                + _("messages.habit_actions_are_materialized_on_demand_when_queried_or_73f2411c")
                + "\n\n"
                + _("messages.cadence_based_habits_still_log_dated_rows_but_progress_a_ee576cf3")
            ),
            examples=(
                "lifeos habit-action list --help",
                "lifeos habit-action show --help",
                "lifeos habit-action log --help",
            ),
            notes=(
                _("messages.use_list_for_both_per_habit_and_by_date_views_5f6adf71"),
                _("messages.habit_cadence_decides_how_rows_are_grouped_into_completi_2134dec5"),
                _("messages.use_log_to_materialize_and_update_an_occurrence_by_habit_4c3e9945"),
            ),
        ),
    )
    action_subparsers = action_parser.add_subparsers(
        dest="habit_action_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    list_parser = add_documented_parser(
        action_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("messages.list_habit_actions_eccc00a5"),
            description=(
                _("messages.list_habit_actions_for_one_habit_or_by_date_filters_b0c0a4f2")
                + "\n\n"
                + _("messages.use_this_command_to_inspect_daily_occurrence_views_and_m_cd66a3cc")
            ),
            examples=(
                "lifeos habit-action list --habit-id 11111111-1111-1111-1111-111111111111",
                "lifeos habit-action list --date 2026-04-09",
                "lifeos habit-action list --date 2026-04-09 --date 2026-04-15",
                "lifeos habit-action list --date 2026-04-09 --count",
            ),
            notes=(
                _("messages.repeat_date_once_for_one_action_date_or_twice_for_one_in_d68e5e90"),
                _(
                    "messages.when_results_exist_the_list_command_prints_a_header_row_e9bd5ee0"
                ).format(columns=format_summary_column_list(HABIT_ACTION_SUMMARY_COLUMNS)),
            ),
        ),
    )
    list_parser.add_argument(
        "--habit-id", type=UUID, help=_("messages.filter_by_habit_identifier_defbda37")
    )
    list_parser.add_argument("--status", help=_("messages.filter_by_habit_action_status_f2f559e4"))
    add_date_range_arguments(
        list_parser,
        date_help=_("messages.repeat_once_for_one_action_date_or_twice_for_one_inclusi_23beefec"),
    )
    list_parser.add_argument(
        "--count", action="store_true", help=_("messages.print_total_matched_count_b60ad049")
    )
    add_include_deleted_argument(list_parser, noun="habit actions")
    add_limit_offset_arguments(list_parser, row_noun="habit actions")
    list_parser.set_defaults(handler=make_sync_handler(handle_habit_action_list_async))

    show_parser = add_documented_parser(
        action_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_a_habit_action_11614784"),
            description=_("messages.show_one_habit_action_with_its_linked_habit_metadata_2213b145"),
            examples=(
                "lifeos habit-action show 11111111-1111-1111-1111-111111111111",
                "lifeos habit-action show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument(
        "action_id", type=UUID, help=_("messages.habit_action_identifier_190ca8b4")
    )
    add_include_deleted_argument(show_parser, noun="habit actions", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_habit_action_show_async))

    update_parser = add_documented_parser(
        action_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("messages.update_a_habit_action_659f3778"),
            description=(
                _("messages.update_one_materialized_habit_action_26bd8ded")
                + "\n\n"
                + _("messages.this_command_only_allows_status_and_notes_changes_within_409275a4")
            ),
            examples=(
                "lifeos habit-action update 11111111-1111-1111-1111-111111111111 --status done",
                "lifeos habit-action update 11111111-1111-1111-1111-111111111111 "
                '--notes "Completed after lunch"',
                "lifeos habit-action update 11111111-1111-1111-1111-111111111111 --clear-notes",
            ),
            notes=(
                _("messages.use_log_when_you_know_the_habit_and_date_but_have_not_lo_ff822f6b"),
                _("messages.use_clear_notes_to_remove_optional_notes_2cb096df"),
            ),
        ),
    )
    update_parser.add_argument(
        "action_id", type=UUID, help=_("messages.habit_action_identifier_190ca8b4")
    )
    update_parser.add_argument("--status", help=_("messages.updated_habit_action_status_0ad85bcf"))
    update_parser.add_argument("--notes", help=_("messages.updated_notes_5143e05e"))
    update_parser.add_argument(
        "--clear-notes",
        action="store_true",
        help=_("messages.clear_the_optional_notes_field_f5beea04"),
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_habit_action_update_async))

    log_parser = add_documented_parser(
        action_subparsers,
        "log",
        help_content=HelpContent(
            summary=_("messages.update_a_habit_action_by_date_7f64e2ac"),
            description=(
                _("messages.materialize_or_update_a_habit_action_by_habit_identifier_21639e25")
                + "\n\n"
                + _("messages.use_this_command_when_checking_in_without_first_looking_101c522e")
            ),
            examples=(
                "lifeos habit-action log --habit-id 11111111-1111-1111-1111-111111111111 "
                "--date 2026-04-09 --status done",
                "lifeos habit-action log --habit-id 11111111-1111-1111-1111-111111111111 "
                '--date 2026-04-09 --status skip --notes "Travel day"',
            ),
            notes=(
                _("messages.use_update_when_you_already_have_the_materialized_action_183c30c4"),
                _("messages.this_command_follows_the_same_editable_window_rules_as_u_13c7ce34"),
            ),
        ),
    )
    log_parser.add_argument(
        "--habit-id", required=True, type=UUID, help=_("messages.habit_identifier_e1aa7a05")
    )
    log_parser.add_argument(
        "--date",
        dest="action_date",
        required=True,
        type=parse_date_value,
        help=_("messages.action_date_in_yyyy_mm_dd_format_d01687b4"),
    )
    log_parser.add_argument("--status", help=_("messages.updated_habit_action_status_0ad85bcf"))
    log_parser.add_argument("--notes", help=_("messages.updated_notes_5143e05e"))
    log_parser.add_argument(
        "--clear-notes",
        action="store_true",
        help=_("messages.clear_the_optional_notes_field_f5beea04"),
    )
    log_parser.set_defaults(handler=make_sync_handler(handle_habit_action_log_async))
