"""Event resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
)
from lifeos_cli.cli_support.resources.event.parser_batch import build_event_batch_parser
from lifeos_cli.cli_support.resources.event.parser_read import (
    build_event_list_parser,
    build_event_show_parser,
)
from lifeos_cli.cli_support.resources.event.parser_write import (
    build_event_add_parser,
    build_event_delete_parser,
    build_event_update_parser,
)
from lifeos_cli.i18n import gettext_message as _


def build_event_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the event command tree."""
    event_parser = add_documented_help_parser(
        subparsers,
        "event",
        help_content=HelpContent(
            summary=_("Manage planned schedule events"),
            description=(
                _("Create and maintain planned schedule blocks.")
                + "\n\n"
                + _("Events represent calendar intent and time allocation, not todo semantics.")
            ),
            examples=(
                "lifeos event add --help",
                "lifeos event list --help",
                "lifeos event batch --help",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for events."),
                _("Events can optionally reference one area and one task."),
                _("Event types distinguish hard appointments, flexible timeblocks, and deadlines."),
                _("See `lifeos event batch --help` for bulk delete operations."),
            ),
        ),
    )
    event_subparsers = event_parser.add_subparsers(
        dest="event_command", title=_("actions"), metavar=_("action")
    )

    build_event_add_parser(event_subparsers)
    build_event_list_parser(event_subparsers)
    build_event_show_parser(event_subparsers)
    build_event_update_parser(event_subparsers)
    build_event_delete_parser(event_subparsers)
    build_event_batch_parser(event_subparsers)
