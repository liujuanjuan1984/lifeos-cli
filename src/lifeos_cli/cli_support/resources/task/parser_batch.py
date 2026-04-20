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
from lifeos_cli.i18n import gettext_message as _


def build_task_batch_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task batch command tree."""
    batch_parser = add_documented_help_parser(
        task_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch task operations"),
            description=_("Soft-delete multiple tasks in one command."),
            examples=(
                "lifeos task batch delete --help",
                "lifeos task batch delete --ids <task-id-1> <task-id-2>",
            ),
            notes=(_("This namespace currently exposes only the `delete` workflow."),),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="task_batch_command",
        title=_("batch actions"),
        metavar=_("batch_action"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple tasks"),
            description=_("Soft-delete multiple tasks by identifier."),
            examples=("lifeos task batch delete --ids <task-id-1> <task-id-2>",),
            notes=(_("Batch delete never performs hard deletion from the public CLI."),),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="task_ids", noun="task")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_task_batch_delete_async))
