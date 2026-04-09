"""Event resource parser construction."""

from __future__ import annotations

import argparse
from datetime import datetime
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.event.handlers import (
    handle_event_add,
    handle_event_batch_delete,
    handle_event_delete,
    handle_event_list,
    handle_event_show,
    handle_event_update,
)


def _datetime_value(value: str) -> datetime:
    """Parse an ISO-8601 datetime value."""
    return datetime.fromisoformat(value)


def build_event_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the event command tree."""
    event_parser = add_documented_parser(
        subparsers,
        "event",
        help_content=HelpContent(
            summary="Manage planned schedule events",
            description=(
                "Create and maintain planned schedule blocks.\n\n"
                "Events represent calendar intent and time allocation, not todo semantics."
            ),
            examples=(
                'lifeos event add "Doctor appointment" --start-time 2026-04-10T09:00:00-04:00',
                "lifeos event list --window-start 2026-04-10T00:00:00-04:00 "
                "--window-end 2026-04-10T23:59:59-04:00",
                "lifeos event batch delete --ids <event-id-1> <event-id-2>",
            ),
            notes=(
                "Use `list` as the primary query entrypoint for events.",
                "Events can optionally reference one area and one task.",
                "Delete operations in the public CLI always perform soft deletion.",
            ),
        ),
    )
    event_parser.set_defaults(handler=make_help_handler(event_parser))
    event_subparsers = event_parser.add_subparsers(
        dest="event_command", title="actions", metavar="action"
    )

    add_parser = add_documented_parser(
        event_subparsers,
        "add",
        help_content=HelpContent(
            summary="Create an event",
            description="Create a planned schedule event.",
            examples=(
                'lifeos event add "Doctor appointment" --start-time 2026-04-10T09:00:00-04:00 '
                "--end-time 2026-04-10T10:00:00-04:00",
                'lifeos event add "Deep work block" --start-time 2026-04-10T13:00:00-04:00 '
                "--task-id <task-id> --area-id <area-id>",
            ),
            notes=(
                "Use repeated `--tag-id` and `--person-id` flags to attach tags and people.",
                "If `--end-time` is omitted, the event is treated as open-ended.",
            ),
        ),
    )
    add_parser.add_argument("title", help="Event title")
    add_parser.add_argument("--description", help="Optional event description")
    add_parser.add_argument("--start-time", required=True, type=_datetime_value, help="Start time")
    add_parser.add_argument("--end-time", type=_datetime_value, help="Optional end time")
    add_parser.add_argument("--priority", type=int, default=0, help="Priority from 0 to 5")
    add_parser.add_argument("--status", default="planned", help="Event status")
    add_parser.add_argument(
        "--all-day",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Mark the event as all-day",
    )
    add_parser.add_argument("--area-id", type=UUID, help="Optional linked area identifier")
    add_parser.add_argument("--task-id", type=UUID, help="Optional linked task identifier")
    add_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to attach one or more event tags",
    )
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to attach one or more people",
    )
    add_parser.set_defaults(handler=handle_event_add)

    list_parser = add_documented_parser(
        event_subparsers,
        "list",
        help_content=HelpContent(
            summary="List events",
            description=(
                "List events with optional time-window and relation filters.\n\n"
                "Use this command as the main query entrypoint for scheduled events."
            ),
            examples=(
                "lifeos event list",
                "lifeos event list --status planned --window-start 2026-04-10T00:00:00-04:00 "
                "--window-end 2026-04-10T23:59:59-04:00",
                "lifeos event list --task-id <task-id> --person-id <person-id>",
            ),
            notes=(
                "When both window flags are given, overlapping events are returned.",
                "Use `--title-contains` for lightweight text filtering instead of a separate search command.",
            ),
        ),
    )
    list_parser.add_argument("--title-contains", help="Filter by title substring")
    list_parser.add_argument("--status", help="Filter by event status")
    list_parser.add_argument("--area-id", type=UUID, help="Filter by linked area")
    list_parser.add_argument("--task-id", type=UUID, help="Filter by linked task")
    list_parser.add_argument("--person-id", type=UUID, help="Filter by linked person")
    list_parser.add_argument("--tag-id", type=UUID, help="Filter by linked tag")
    list_parser.add_argument("--window-start", type=_datetime_value, help="Window start time")
    list_parser.add_argument("--window-end", type=_datetime_value, help="Window end time")
    add_include_deleted_argument(list_parser, noun="events")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=handle_event_list)

    show_parser = add_documented_parser(
        event_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show an event",
            description="Show one event with full metadata.",
            examples=(
                "lifeos event show 11111111-1111-1111-1111-111111111111",
                "lifeos event show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("event_id", type=UUID, help="Event identifier")
    add_include_deleted_argument(show_parser, noun="events", help_prefix="Allow")
    show_parser.set_defaults(handler=handle_event_show)

    update_parser = add_documented_parser(
        event_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update an event",
            description="Update mutable event fields.",
            examples=(
                "lifeos event update 11111111-1111-1111-1111-111111111111 --status completed",
                "lifeos event update 11111111-1111-1111-1111-111111111111 --clear-task --clear-area",
                "lifeos event update 11111111-1111-1111-1111-111111111111 --clear-people --clear-tags",
            ),
            notes=(
                "Use `--clear-*` flags to explicitly remove optional values.",
                "Do not mix a value flag with the matching clear flag in the same command.",
            ),
        ),
    )
    update_parser.add_argument("event_id", type=UUID, help="Event identifier")
    update_parser.add_argument("--title", help="Updated event title")
    update_parser.add_argument("--description", help="Updated description")
    update_parser.add_argument("--clear-description", action="store_true", help="Clear description")
    update_parser.add_argument("--start-time", type=_datetime_value, help="Updated start time")
    update_parser.add_argument("--end-time", type=_datetime_value, help="Updated end time")
    update_parser.add_argument("--clear-end-time", action="store_true", help="Clear end time")
    update_parser.add_argument("--priority", type=int, help="Updated priority from 0 to 5")
    update_parser.add_argument("--status", help="Updated event status")
    update_parser.add_argument(
        "--all-day",
        action=argparse.BooleanOptionalAction,
        default=None,
        help="Toggle all-day status",
    )
    update_parser.add_argument("--area-id", type=UUID, help="Updated linked area identifier")
    update_parser.add_argument("--clear-area", action="store_true", help="Clear linked area")
    update_parser.add_argument("--task-id", type=UUID, help="Updated linked task identifier")
    update_parser.add_argument("--clear-task", action="store_true", help="Clear linked task")
    update_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to replace tags with one or more identifiers",
    )
    update_parser.add_argument("--clear-tags", action="store_true", help="Remove all tags")
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to replace people with one or more identifiers",
    )
    update_parser.add_argument("--clear-people", action="store_true", help="Remove all people")
    update_parser.set_defaults(handler=handle_event_update)

    delete_parser = add_documented_parser(
        event_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete an event",
            description="Soft-delete one event.",
            examples=("lifeos event delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("event_id", type=UUID, help="Event identifier")
    delete_parser.set_defaults(handler=handle_event_delete)

    batch_parser = add_documented_parser(
        event_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch event operations",
            description="Grouped namespace for multi-record event writes.",
            examples=("lifeos event batch delete --ids <event-id-1> <event-id-2>",),
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="event_batch_command", title="batch actions", metavar="batch-action"
    )
    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete multiple events",
            description="Soft-delete multiple events by identifier.",
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="event_ids", noun="event")
    batch_delete_parser.set_defaults(handler=handle_event_batch_delete)
