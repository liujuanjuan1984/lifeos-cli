"""Builder helpers for task structure commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.resources.task.handlers import (
    handle_task_move_async,
    handle_task_reorder_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import cli_message as _


def build_task_move_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task move command."""
    move_parser = add_documented_parser(
        task_subparsers,
        "move",
        help_content=HelpContent(
            summary=_("messages.move_a_task_95f7e77f"),
            description=_(
                "messages.move_a_task_to_a_new_parent_and_optionally_a_new_vision_cefc864d"
            ),
            examples=(
                "lifeos task move 11111111-1111-1111-1111-111111111111 "
                "--new-parent-task-id 22222222-2222-2222-2222-222222222222",
                "lifeos task move 11111111-1111-1111-1111-111111111111 "
                "--old-parent-task-id 00000000-0000-0000-0000-000000000000 "
                "--new-parent-task-id 22222222-2222-2222-2222-222222222222 "
                "--new-display-order 10",
                "lifeos task move 11111111-1111-1111-1111-111111111111 "
                "--new-vision-id 33333333-3333-3333-3333-333333333333 --clear-parent",
            ),
            notes=(
                _("messages.use_reorder_when_only_sibling_display_order_changes_and_6ebef6cd"),
                _("messages.use_old_parent_task_id_as_an_optimistic_guard_when_anoth_c3e82a0f"),
            ),
        ),
    )
    move_parser.add_argument("task_id", type=UUID, help=_("messages.task_identifier_b5d5c4ca"))
    move_parser.add_argument(
        "--old-parent-task-id",
        type=UUID,
        help=_("messages.expected_current_parent_task_identifier_42b0e8ff"),
    )
    move_parser.add_argument(
        "--new-parent-task-id",
        type=UUID,
        help=_("messages.target_parent_task_identifier_402ac7d3"),
    )
    move_parser.add_argument(
        "--clear-parent",
        action="store_true",
        help=_("messages.move_the_task_to_the_root_level_a356578e"),
    )
    move_parser.add_argument(
        "--new-vision-id", type=UUID, help=_("messages.target_vision_identifier_ca47f7ee")
    )
    move_parser.add_argument(
        "--new-display-order",
        type=int,
        help=_("messages.target_display_order_a7668e1d"),
    )
    move_parser.set_defaults(handler=make_sync_handler(handle_task_move_async))


def build_task_reorder_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task reorder command."""
    reorder_parser = add_documented_parser(
        task_subparsers,
        "reorder",
        help_content=HelpContent(
            summary=_("messages.reorder_tasks_cea281fe"),
            description=_("messages.update_display_order_values_for_one_or_more_tasks_bd04d3bd"),
            examples=(
                "lifeos task reorder --order 11111111-1111-1111-1111-111111111111:0 "
                "--order 22222222-2222-2222-2222-222222222222:1",
            ),
            notes=(
                _("messages.this_command_changes_only_display_order_it_does_not_move_fa9f3996"),
                _("messages.use_move_when_parentage_or_vision_membership_also_needs_66429e3a"),
            ),
        ),
    )
    reorder_parser.add_argument(
        "--order",
        action="append",
        required=True,
        help=_("messages.task_order_in_task_id_display_order_format_repeat_for_mu_1e78ff4f"),
    )
    reorder_parser.set_defaults(handler=make_sync_handler(handle_task_reorder_async))
