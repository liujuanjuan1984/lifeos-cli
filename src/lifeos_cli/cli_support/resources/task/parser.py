"""Task resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
)
from lifeos_cli.cli_support.resources.task.parser_batch import build_task_batch_parser
from lifeos_cli.cli_support.resources.task.parser_read_models import (
    build_task_hierarchy_parser,
    build_task_list_parser,
    build_task_show_parser,
    build_task_stats_parser,
    build_task_with_subtasks_parser,
)
from lifeos_cli.cli_support.resources.task.parser_structure import (
    build_task_move_parser,
    build_task_reorder_parser,
)
from lifeos_cli.cli_support.resources.task.parser_write import (
    build_task_add_parser,
    build_task_delete_parser,
    build_task_update_parser,
)
from lifeos_cli.i18n import cli_message as _


def build_task_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the task command tree."""
    task_parser = add_documented_help_parser(
        subparsers,
        "task",
        help_content=HelpContent(
            summary=_("messages.manage_hierarchical_tasks_bd490711"),
            description=(
                _("messages.create_and_maintain_task_trees_that_belong_to_a_vision_4e8941ee")
                + "\n\n"
                + _("messages.tasks_are_the_main_execution_unit_in_lifeos_and_can_be_n_5050add9")
                + " "
                + _("messages.use_planning_cycle_fields_for_the_broader_timebox_use_ev_f40c735d")
            ),
            examples=(
                "lifeos task add --help",
                "lifeos task list --help",
                "lifeos task batch --help",
            ),
            notes=(
                _("messages.use_list_as_the_primary_query_entrypoint_for_this_resour_6b284135"),
                _("messages.tasks_can_form_trees_through_parent_task_id_9a18c68d"),
                _("messages.use_lifeos_event_add_task_id_task_id_when_the_task_also_7da1a2e8"),
                _("messages.see_lifeos_task_batch_help_for_bulk_delete_operations_c79691a4"),
            ),
        ),
    )
    task_subparsers = task_parser.add_subparsers(
        dest="task_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    build_task_add_parser(task_subparsers)
    build_task_list_parser(task_subparsers)
    build_task_show_parser(task_subparsers)
    build_task_with_subtasks_parser(task_subparsers)
    build_task_hierarchy_parser(task_subparsers)
    build_task_stats_parser(task_subparsers)
    build_task_move_parser(task_subparsers)
    build_task_reorder_parser(task_subparsers)
    build_task_update_parser(task_subparsers)
    build_task_delete_parser(task_subparsers)
    build_task_batch_parser(task_subparsers)
