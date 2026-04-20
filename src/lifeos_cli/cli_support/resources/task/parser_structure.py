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
from lifeos_cli.i18n import gettext_message as _


def build_task_move_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task move command."""
    move_parser = add_documented_parser(
        task_subparsers,
        "move",
        help_content=HelpContent(
            summary=_("Move a task"),
            description=_("Move a task to a new parent and optionally a new vision."),
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
                _(
                    "Use `reorder` when only sibling display order changes and parentage stays "
                    "the same."
                ),
                _(
                    "Use `--old-parent-task-id` as an optimistic guard when another writer may "
                    "have already moved the task."
                ),
            ),
        ),
    )
    move_parser.add_argument("task_id", type=UUID, help=_("Task identifier"))
    move_parser.add_argument(
        "--old-parent-task-id",
        type=UUID,
        help=_("Expected current parent task identifier"),
    )
    move_parser.add_argument(
        "--new-parent-task-id",
        type=UUID,
        help=_("Target parent task identifier"),
    )
    move_parser.add_argument(
        "--clear-parent",
        action="store_true",
        help=_("Move the task to the root level"),
    )
    move_parser.add_argument("--new-vision-id", type=UUID, help=_("Target vision identifier"))
    move_parser.add_argument(
        "--new-display-order",
        type=int,
        help=_("Target display order"),
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
            summary=_("Reorder tasks"),
            description=_("Update display order values for one or more tasks."),
            examples=(
                "lifeos task reorder --order 11111111-1111-1111-1111-111111111111:0 "
                "--order 22222222-2222-2222-2222-222222222222:1",
            ),
            notes=(
                _(
                    "This command changes only `display_order`; it does not move tasks between "
                    "parents."
                ),
                _("Use `move` when parentage or vision membership also needs to change."),
            ),
        ),
    )
    reorder_parser.add_argument(
        "--order",
        action="append",
        required=True,
        help=_("Task order in <task-id>:<display-order> format; repeat for multiple tasks"),
    )
    reorder_parser.set_defaults(handler=make_sync_handler(handle_task_reorder_async))
