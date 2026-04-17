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
                'lifeos note add "Capture an idea"',
                "lifeos note list --limit 20",
                'lifeos note search "sprint retrospective"',
                "lifeos note show 11111111-1111-1111-1111-111111111111",
                "lifeos note batch update-content --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222 "
                '--find-text "draft" --replace-text "final"',
                'lifeos note update 11111111-1111-1111-1111-111111111111 "Rewrite the note"',
                "lifeos note delete 11111111-1111-1111-1111-111111111111",
            ),
            notes=(
                _("Run `lifeos init` before using note commands for the first time."),
                _("Use the `batch` namespace when one command operates on multiple note records."),
                _(
                    "The list command prints tab-separated columns: id, status, created_at, "
                    "task_count, vision_count, event_count, people_count, timelog_count, "
                    "tag_count, content."
                ),
                _(
                    "Use `show` to inspect the full note body together with linked tags, tasks, "
                    "visions, events, people, and timelogs."
                ),
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
