"""Note resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
)
from lifeos_cli.cli_support.resources.note.parser_actions import (
    build_note_add_parser,
    build_note_batch_parser,
    build_note_delete_parser,
    build_note_list_parser,
    build_note_search_parser,
    build_note_show_parser,
    build_note_update_parser,
)
from lifeos_cli.i18n import cli_message as _


def build_note_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the note command tree."""
    note_parser = add_documented_help_parser(
        subparsers,
        "note",
        help_content=HelpContent(
            summary=_("messages.capture_and_manage_notes_7b3a7de7"),
            description=_("messages.create_inspect_update_and_delete_note_records_5f963c7e"),
            examples=(
                "lifeos note add --help",
                "lifeos note list --help",
                "lifeos note batch --help",
            ),
            notes=(
                _("messages.run_lifeos_init_before_using_note_commands_for_the_first_0e0d5f7f"),
                _("messages.see_lifeos_note_batch_help_for_bulk_update_content_and_d_242ad360"),
            ),
        ),
    )
    note_subparsers = note_parser.add_subparsers(
        dest="note_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )
    build_note_add_parser(note_subparsers)
    build_note_list_parser(note_subparsers)
    build_note_search_parser(note_subparsers)
    build_note_show_parser(note_subparsers)
    build_note_update_parser(note_subparsers)
    build_note_delete_parser(note_subparsers)
    build_note_batch_parser(note_subparsers)
