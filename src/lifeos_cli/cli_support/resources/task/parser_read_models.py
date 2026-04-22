"""Builder helpers for task read-model commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.task.handlers import (
    TASK_SUMMARY_COLUMNS,
    handle_task_hierarchy_async,
    handle_task_list_async,
    handle_task_show_async,
    handle_task_stats_async,
    handle_task_with_subtasks_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import cli_message as _


def build_task_list_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task list command."""
    list_parser = add_documented_parser(
        task_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("messages.list_tasks_6cc25380"),
            description=(
                _("messages.list_tasks_with_optional_vision_parent_or_status_filters_6824904d")
                + "\n\n"
                + _("messages.use_this_command_as_the_primary_query_entrypoint_for_str_1c7fd863")
            ),
            examples=(
                "lifeos task list",
                "lifeos task list --vision-id 11111111-1111-1111-1111-111111111111",
                "lifeos task list --person-id 11111111-1111-1111-1111-111111111111",
                "lifeos task list --parent-task-id "
                "22222222-2222-2222-2222-222222222222 --status todo",
            ),
            notes=(
                _("messages.when_vision_id_is_provided_without_parent_task_id_only_r_834489a5"),
                _(
                    "messages.when_results_exist_the_list_command_prints_a_header_row_e9bd5ee0"
                ).format(columns=format_summary_column_list(TASK_SUMMARY_COLUMNS)),
                _("messages.use_limit_and_offset_for_pagination_a7d441ec"),
            ),
        ),
    )
    list_parser.add_argument(
        "--vision-id",
        type=UUID,
        help=_("messages.filter_by_vision_identifier_4c86ada0"),
    )
    list_parser.add_argument(
        "--vision-in", help=_("messages.comma_separated_vision_identifiers_41a45df5")
    )
    list_parser.add_argument(
        "--parent-task-id", type=UUID, help=_("messages.filter_by_parent_task_identifier_f310a976")
    )
    list_parser.add_argument(
        "--person-id", type=UUID, help=_("messages.filter_by_linked_person_identifier_8e385113")
    )
    list_parser.add_argument("--status", help=_("messages.filter_by_task_status_c236270f"))
    list_parser.add_argument(
        "--status-in", help=_("messages.comma_separated_statuses_to_include_0348a032")
    )
    list_parser.add_argument(
        "--exclude-status", help=_("messages.comma_separated_statuses_to_exclude_accddc9f")
    )
    list_parser.add_argument(
        "--planning-cycle-type", help=_("messages.filter_by_planning_cycle_type_5cb5755f")
    )
    list_parser.add_argument(
        "--planning-cycle-start-date",
        help=_("messages.filter_by_planning_cycle_start_date_yyyy_mm_dd_84f77c5c"),
    )
    list_parser.add_argument("--content", help=_("messages.filter_by_exact_task_content_d755e764"))
    add_include_deleted_argument(list_parser, noun="tasks")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_task_list_async))


def build_task_show_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task show command."""
    show_parser = add_documented_parser(
        task_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_a_task_dd835a3b"),
            description=_("messages.show_one_task_with_full_metadata_49936d8e"),
            examples=(
                "lifeos task show 11111111-1111-1111-1111-111111111111",
                "lifeos task show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("task_id", type=UUID, help=_("messages.task_identifier_b5d5c4ca"))
    add_include_deleted_argument(show_parser, noun="tasks", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_task_show_async))


def build_task_with_subtasks_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task with-subtasks command."""
    with_subtasks_parser = add_documented_parser(
        task_subparsers,
        "with-subtasks",
        help_content=HelpContent(
            summary=_("messages.show_a_task_subtree_fd1e6cdf"),
            description=_("messages.show_one_task_with_its_active_nested_subtasks_6e4e2688"),
            examples=("lifeos task with-subtasks 11111111-1111-1111-1111-111111111111",),
            notes=(
                _("messages.the_root_task_prints_first_followed_by_active_descendant_68821b41"),
                _("messages.use_hierarchy_when_you_need_the_full_active_tree_for_an_f1f6e6c3"),
            ),
        ),
    )
    with_subtasks_parser.add_argument(
        "task_id", type=UUID, help=_("messages.task_identifier_b5d5c4ca")
    )
    with_subtasks_parser.set_defaults(handler=make_sync_handler(handle_task_with_subtasks_async))


def build_task_hierarchy_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task hierarchy command."""
    hierarchy_parser = add_documented_parser(
        task_subparsers,
        "hierarchy",
        help_content=HelpContent(
            summary=_("messages.show_a_vision_task_hierarchy_2c044737"),
            description=_("messages.show_all_active_tasks_for_a_vision_as_a_hierarchy_a52eb8f8"),
            examples=("lifeos task hierarchy 11111111-1111-1111-1111-111111111111",),
            notes=(
                _("messages.the_output_starts_with_the_vision_identifier_then_prints_a2bb33f3"),
                _("messages.use_with_subtasks_when_you_want_to_inspect_only_one_bran_b716f2e6"),
            ),
        ),
    )
    hierarchy_parser.add_argument(
        "vision_id", type=UUID, help=_("messages.vision_identifier_6ecf0a78")
    )
    hierarchy_parser.set_defaults(handler=make_sync_handler(handle_task_hierarchy_async))


def build_task_stats_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task stats command."""
    stats_parser = add_documented_parser(
        task_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("messages.show_task_statistics_7df71e21"),
            description=_(
                "messages.show_subtree_completion_and_effort_statistics_for_one_ta_4c5c63d7"
            ),
            examples=("lifeos task stats 11111111-1111-1111-1111-111111111111",),
            notes=(
                _("messages.totals_aggregate_the_selected_task_together_with_all_act_3045cee2"),
                _("messages.when_the_task_has_direct_children_completion_percentage_a1b1ac95"),
            ),
        ),
    )
    stats_parser.add_argument("task_id", type=UUID, help=_("messages.task_identifier_b5d5c4ca"))
    stats_parser.set_defaults(handler=make_sync_handler(handle_task_stats_async))
