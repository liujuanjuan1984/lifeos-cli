"""Builder helpers for event batch commands."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.parser_common import add_identifier_list_argument
from lifeos_cli.cli_support.resources.event.handlers import handle_event_batch_delete_async
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_event_batch_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event batch command tree."""
    batch_parser = add_documented_help_parser(
        event_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch event operations"),
            description=_("Soft-delete multiple events in one command."),
            examples=(
                "lifeos event batch delete --help",
                "lifeos event batch delete --ids <event-id-1> <event-id-2>",
            ),
            notes=(_("This namespace currently exposes only the `delete` workflow."),),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="event_batch_command", title=_("batch actions"), metavar=_("batch-action")
    )
    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple events"),
            description=_("Soft-delete multiple events by identifier."),
            examples=("lifeos event batch delete --ids <event-id-1> <event-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="event_ids", noun="event")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_event_batch_delete_async))
