"""Builder helpers for task batch commands."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.parser_common import add_identifier_list_argument
from lifeos_cli.cli_support.resources.task.handlers import handle_task_batch_delete_async
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import cli_message as _


def build_task_batch_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task batch command tree."""
    batch_parser = add_documented_help_parser(
        task_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("messages.run_batch_task_operations_bdd94255"),
            description=_("messages.delete_multiple_tasks_in_one_command_b12e6660"),
            examples=(
                "lifeos task batch delete --help",
                "lifeos task batch delete --ids <task-id-1> <task-id-2>",
            ),
            notes=(
                _("messages.this_namespace_currently_exposes_only_the_delete_workflo_8e17bac4"),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="task_batch_command",
        title=_("messages.batch_actions_fb880b71"),
        metavar=_("messages.batch_action_3c29d393"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_multiple_tasks_ab195ead"),
            description=_("messages.delete_multiple_tasks_by_identifier_bc8f3fa2"),
            examples=("lifeos task batch delete --ids <task-id-1> <task-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="task_ids", noun="task")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_task_batch_delete_async))
