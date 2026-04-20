"""Builder helpers for event read commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_date_range_arguments,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.event.handlers import (
    EVENT_SUMMARY_COLUMNS,
    handle_event_list_async,
    handle_event_show_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.cli_support.time_args import parse_datetime_or_date_value
from lifeos_cli.i18n import gettext_message as _


def build_event_list_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event list command."""
    list_parser = add_documented_parser(
        event_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List events"),
            description=(
                _("List events with optional time-window and relation filters.")
                + "\n\n"
                + _("Use this command as the main query entrypoint for scheduled events.")
            ),
            examples=(
                "lifeos event list",
                "lifeos event list --date 2026-04-10",
                "lifeos event list --date 2026-04-10 --date 2026-04-16",
                "lifeos event list --status planned --start-time 2026-04-10T00:00:00-04:00 "
                "--end-time 2026-04-10T23:59:59-04:00",
                "lifeos event list --type deadline --date 2026-04-10",
                "lifeos event list --task-id <task-id> --person-id <person-id>",
            ),
            notes=(
                _(
                    "Repeat `--date` once for one configured local day or twice for one "
                    "inclusive local-date range."
                ),
                _(
                    "When both `--start-time` and `--end-time` are given, overlapping "
                    "events are returned."
                ),
                _("Recurring series are expanded for bounded window queries and schedule views."),
                _("Use `--type` to narrow results to one event topology."),
                _(
                    "Use `--title-contains` for lightweight text filtering instead of a "
                    "separate search command."
                ),
                _(
                    "When results exist, the list command prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(EVENT_SUMMARY_COLUMNS)),
            ),
        ),
    )
    list_parser.add_argument("--title-contains", help=_("Filter by title substring"))
    list_parser.add_argument("--status", help=_("Filter by event status"))
    list_parser.add_argument(
        "--type",
        dest="event_type",
        help=_("Filter by event type: appointment, timeblock, or deadline"),
    )
    list_parser.add_argument("--area-id", type=UUID, help=_("Filter by linked area"))
    list_parser.add_argument("--task-id", type=UUID, help=_("Filter by linked task"))
    list_parser.add_argument("--person-id", type=UUID, help=_("Filter by linked person"))
    list_parser.add_argument("--tag-id", type=UUID, help=_("Filter by linked tag"))
    add_date_range_arguments(
        list_parser,
        date_help=_(
            "Repeat once for one configured local day or twice for one inclusive "
            "local-date range in YYYY-MM-DD format"
        ),
    )
    list_parser.add_argument(
        "--start-time",
        dest="window_start",
        type=parse_datetime_or_date_value,
        help=_("Inclusive time filter start; date-only values use the configured timezone"),
    )
    list_parser.add_argument(
        "--end-time",
        dest="window_end",
        type=parse_datetime_or_date_value,
        help=_("Inclusive time filter end; date-only values use the configured timezone"),
    )
    add_include_deleted_argument(list_parser, noun="events")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_event_list_async))


def build_event_show_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event show command."""
    show_parser = add_documented_parser(
        event_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show an event"),
            description=_("Show one event with full metadata."),
            examples=(
                "lifeos event show 11111111-1111-1111-1111-111111111111",
                "lifeos event show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("event_id", type=UUID, help=_("Event identifier"))
    add_include_deleted_argument(show_parser, noun="events", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_event_show_async))
