"""Builder helpers for vision batch commands."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.parser_common import add_identifier_list_argument
from lifeos_cli.cli_support.resources.vision.handlers import handle_vision_batch_delete_async
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_vision_batch_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision batch command tree."""
    batch_parser = add_documented_help_parser(
        vision_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch vision operations"),
            description=_("Soft-delete multiple visions in one command."),
            examples=(
                "lifeos vision batch delete --help",
                "lifeos vision batch delete --ids <vision-id-1> <vision-id-2>",
            ),
            notes=(_("This namespace currently exposes only the `delete` workflow."),),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="vision_batch_command",
        title=_("batch actions"),
        metavar=_("batch_action"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple visions"),
            description=_("Soft-delete multiple visions by identifier."),
            examples=("lifeos vision batch delete --ids <vision-id-1> <vision-id-2>",),
            notes=(_("Batch delete never performs hard deletion from the public CLI."),),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="vision_ids", noun="vision")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_vision_batch_delete_async))
