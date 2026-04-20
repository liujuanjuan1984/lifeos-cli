"""Timelog resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
)
from lifeos_cli.cli_support.resources.timelog.parser_actions import (
    build_timelog_add_parser,
    build_timelog_delete_parser,
    build_timelog_list_parser,
    build_timelog_restore_parser,
    build_timelog_show_parser,
    build_timelog_update_parser,
)
from lifeos_cli.cli_support.resources.timelog.parser_batch import build_timelog_batch_parser
from lifeos_cli.cli_support.resources.timelog.parser_stats import build_timelog_stats_parser
from lifeos_cli.i18n import gettext_message as _


def build_timelog_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the timelog command tree."""
    timelog_parser = add_documented_help_parser(
        subparsers,
        "timelog",
        help_content=HelpContent(
            summary=_("Manage actual time records"),
            description=(
                _("Create and maintain actual time records.")
                + "\n\n"
                + _("Timelogs represent what really happened and how time was spent.")
            ),
            examples=(
                "lifeos timelog add --help",
                "lifeos timelog list --help",
                "lifeos timelog stats --help",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for timelogs."),
                _("Timelogs can optionally reference one area and one task."),
                _("Use `stats` for timelog stats grouped by area."),
                _(
                    "See `lifeos timelog batch --help` for bulk `update`, `restore`, and "
                    "`delete` workflows."
                ),
            ),
        ),
    )
    timelog_subparsers = timelog_parser.add_subparsers(
        dest="timelog_command", title=_("actions"), metavar=_("action")
    )

    build_timelog_add_parser(timelog_subparsers)
    build_timelog_list_parser(timelog_subparsers)
    build_timelog_show_parser(timelog_subparsers)
    build_timelog_update_parser(timelog_subparsers)
    build_timelog_delete_parser(timelog_subparsers)
    build_timelog_restore_parser(timelog_subparsers)
    build_timelog_batch_parser(timelog_subparsers)
    build_timelog_stats_parser(timelog_subparsers)
