"""Builder helpers for batch timelog actions."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.parser_common import add_identifier_list_argument
from lifeos_cli.cli_support.resources.timelog.handlers import (
    handle_timelog_batch_delete_async,
    handle_timelog_batch_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_timelog_batch_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog batch command tree."""
    batch_parser = add_documented_help_parser(
        timelog_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch timelog operations"),
            description=_("Run bulk update and delete operations for timelogs."),
            examples=(
                "lifeos timelog batch update --help",
                "lifeos timelog batch delete --help",
            ),
            notes=(
                _("Use `update` to edit mutable fields across active timelogs."),
                _("Use `delete` to remove multiple timelogs in one command."),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="timelog_batch_command", title=_("batch actions"), metavar=_("batch-action")
    )

    batch_update_parser = add_documented_parser(
        batch_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update multiple timelogs"),
            description=_("Update mutable fields across multiple active timelogs."),
            examples=(
                "lifeos timelog batch update --ids <timelog-id-1> <timelog-id-2> --clear-task",
                "lifeos timelog batch update --ids <timelog-id-1> <timelog-id-2> "
                '--find-title-text "deep" --replace-title-text "focused"',
                "lifeos timelog batch update --ids <timelog-id-1> "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
            ),
            notes=(
                _(
                    "Repeat the same `--tag-id` or `--person-id` flag to replace multiple "
                    "linked tags or people."
                ),
                _("Use `--clear-*` flags to remove optional links."),
            ),
        ),
    )
    add_identifier_list_argument(
        batch_update_parser,
        dest="timelog_ids",
        noun="timelog",
        action_verb="update",
    )
    batch_update_parser.add_argument("--title", help=_("Replace the full title"))
    batch_update_parser.add_argument("--find-title-text", help=_("Title text to find"))
    batch_update_parser.add_argument(
        "--replace-title-text",
        help=_("Replacement text for title matches"),
    )
    batch_update_parser.add_argument("--area-id", type=UUID, help=_("Replace linked area"))
    batch_update_parser.add_argument(
        "--clear-area", action="store_true", help=_("Clear linked area")
    )
    batch_update_parser.add_argument("--task-id", type=UUID, help=_("Replace linked task"))
    batch_update_parser.add_argument(
        "--clear-task", action="store_true", help=_("Clear linked task")
    )
    batch_update_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace tags with one or more identifiers"),
    )
    batch_update_parser.add_argument("--clear-tags", action="store_true", help=_("Remove all tags"))
    batch_update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace people with one or more identifiers"),
    )
    batch_update_parser.add_argument(
        "--clear-people",
        action="store_true",
        help=_("Remove all people"),
    )
    batch_update_parser.set_defaults(handler=make_sync_handler(handle_timelog_batch_update_async))

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple timelogs"),
            description=_("Delete multiple timelogs by identifier."),
            examples=("lifeos timelog batch delete --ids <timelog-id-1> <timelog-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="timelog_ids", noun="timelog")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_timelog_batch_delete_async))
