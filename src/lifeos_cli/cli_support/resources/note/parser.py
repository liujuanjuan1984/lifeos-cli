"""Note resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.resources.note.parser_actions import (
    build_note_add_parser,
    build_note_batch_parser,
    build_note_delete_parser,
    build_note_list_parser,
    build_note_search_parser,
    build_note_show_parser,
    build_note_update_parser,
)
from lifeos_cli.i18n import gettext_message as _


def build_note_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the note command tree."""
    note_parser = add_documented_parser(
        subparsers,
        "note",
        help_content=HelpContent(
            summary=_("Capture and manage notes"),
            description=_("Create, inspect, update, and delete note records."),
            examples=(
                "lifeos note add --help",
                "lifeos note list --help",
                "lifeos note batch --help",
            ),
            notes=(
                _("Run `lifeos init` before using note commands for the first time."),
                _("Use the `batch` namespace when one command operates on multiple note records."),
                _("Delete operations in the CLI always perform soft deletion."),
            ),
        ),
    )
    note_parser.set_defaults(handler=make_help_handler(note_parser))
    note_subparsers = note_parser.add_subparsers(
        dest="note_command",
        title=_("actions"),
        metavar=_("action"),
    )
    build_note_add_parser(note_subparsers)
    build_note_list_parser(note_subparsers)
    build_note_search_parser(note_subparsers)
    build_note_show_parser(note_subparsers)
    build_note_update_parser(note_subparsers)
    build_note_delete_parser(note_subparsers)
    build_note_batch_parser(note_subparsers)
