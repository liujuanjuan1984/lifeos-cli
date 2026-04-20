"""Builder helpers for habit batch commands."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.parser_common import add_identifier_list_argument
from lifeos_cli.cli_support.resources.habit.handlers import handle_habit_batch_delete_async
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_habit_batch_parser(
    habit_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit batch command tree."""
    batch_parser = add_documented_help_parser(
        habit_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run bulk habit operations"),
            description=_("Soft-delete multiple habits in one command."),
            examples=(
                "lifeos habit batch delete --help",
                "lifeos habit batch delete --ids <habit-id-1> <habit-id-2>",
            ),
            notes=(_("This namespace currently exposes only the `delete` workflow."),),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="habit_batch_command",
        title=_("batch actions"),
        metavar=_("batch-action"),
    )
    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Soft-delete multiple habits"),
            description=_("Soft-delete multiple habits in one command."),
            examples=("lifeos habit batch delete --ids <habit-id-1> <habit-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="habit_ids", noun="habit")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_habit_batch_delete_async))
