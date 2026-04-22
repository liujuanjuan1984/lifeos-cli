"""Event resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
)
from lifeos_cli.cli_support.resources.event.parser_actions import (
    build_event_add_parser,
    build_event_batch_parser,
    build_event_delete_parser,
    build_event_list_parser,
    build_event_show_parser,
    build_event_update_parser,
)
from lifeos_cli.i18n import cli_message as _


def build_event_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the event command tree."""
    event_parser = add_documented_help_parser(
        subparsers,
        "event",
        help_content=HelpContent(
            summary=_("messages.manage_planned_schedule_events_714cf569"),
            description=(
                _("messages.create_and_maintain_planned_schedule_blocks_aab2919b")
                + "\n\n"
                + _("messages.events_represent_calendar_intent_and_time_allocation_not_f399eb99")
            ),
            examples=(
                "lifeos event add --help",
                "lifeos event list --help",
                "lifeos event batch --help",
            ),
            notes=(
                _("messages.use_list_as_the_primary_query_entrypoint_for_events_5c6e9ceb"),
                _("messages.events_can_optionally_reference_one_area_and_one_task_10f8c28a"),
                _("messages.event_types_distinguish_hard_appointments_flexible_timeb_3ab32dbc"),
                _("messages.see_lifeos_event_batch_help_for_bulk_delete_operations_c4213924"),
            ),
        ),
    )
    event_subparsers = event_parser.add_subparsers(
        dest="event_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    build_event_add_parser(event_subparsers)
    build_event_list_parser(event_subparsers)
    build_event_show_parser(event_subparsers)
    build_event_update_parser(event_subparsers)
    build_event_delete_parser(event_subparsers)
    build_event_batch_parser(event_subparsers)
