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
    build_timelog_show_parser,
    build_timelog_update_parser,
)
from lifeos_cli.cli_support.resources.timelog.parser_batch import build_timelog_batch_parser
from lifeos_cli.cli_support.resources.timelog.parser_stats import build_timelog_stats_parser
from lifeos_cli.i18n import cli_message as _


def build_timelog_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the timelog command tree."""
    timelog_parser = add_documented_help_parser(
        subparsers,
        "timelog",
        help_content=HelpContent(
            summary=_("messages.manage_actual_time_records_bb78d507"),
            description=(
                _("messages.create_and_maintain_actual_time_records_151e12f4")
                + "\n\n"
                + _("messages.timelogs_represent_what_really_happened_and_how_time_was_bf2bdd62")
            ),
            examples=(
                "lifeos timelog add --help",
                "lifeos timelog list --help",
                "lifeos timelog stats --help",
            ),
            notes=(
                _("messages.use_list_as_the_primary_query_entrypoint_for_timelogs_95a80899"),
                _("messages.timelogs_can_optionally_reference_one_area_and_one_task_7787d8da"),
                _("messages.use_stats_for_timelog_stats_grouped_by_area_e3e85de1"),
                _("messages.see_lifeos_timelog_batch_help_for_bulk_update_and_delete_6cb9d62f"),
            ),
        ),
    )
    timelog_subparsers = timelog_parser.add_subparsers(
        dest="timelog_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    build_timelog_add_parser(timelog_subparsers)
    build_timelog_list_parser(timelog_subparsers)
    build_timelog_show_parser(timelog_subparsers)
    build_timelog_update_parser(timelog_subparsers)
    build_timelog_delete_parser(timelog_subparsers)
    build_timelog_batch_parser(timelog_subparsers)
    build_timelog_stats_parser(timelog_subparsers)
