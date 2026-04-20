"""Builder helpers for event write commands."""

from __future__ import annotations

import argparse
from datetime import datetime
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.resources.event.handlers import (
    handle_event_add_async,
    handle_event_delete_async,
    handle_event_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_event_add_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event add command."""
    add_parser = add_documented_parser(
        event_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create an event"),
            description=_("Create a planned schedule event."),
            examples=(
                'lifeos event add "Doctor appointment" --start-time 2026-04-10T09:00:00-04:00 '
                "--end-time 2026-04-10T10:00:00-04:00",
                'lifeos event add "Deep work block" --type timeblock '
                "--start-time 2026-04-10T13:00:00-04:00 "
                "--task-id <task-id> --area-id <area-id>",
                'lifeos event add "Shared planning session" '
                "--start-time 2026-04-10T15:00:00-04:00 "
                "--end-time 2026-04-10T16:00:00-04:00 "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
            ),
            notes=(
                _("`appointment` is the default type. Use `--type` for timeblocks and deadlines."),
                _(
                    "Repeat the same `--tag-id` or `--person-id` flag to attach multiple tags "
                    "or people in one command."
                ),
                _("If `--end-time` is omitted, the event is treated as open-ended."),
                _(
                    "Use recurrence flags to create a recurring series with shared cadence "
                    "primitives across daily, weekly, monthly, and yearly patterns."
                ),
                _(
                    "When an agent creates events for a human, use `--person-id` to distinguish "
                    "human-only plans from agent-only or shared schedule blocks."
                ),
            ),
        ),
    )
    add_parser.add_argument("title", help=_("Event title"))
    add_parser.add_argument("--description", help=_("Optional event description"))
    add_parser.add_argument(
        "--start-time", required=True, type=datetime.fromisoformat, help=_("Start time")
    )
    add_parser.add_argument("--end-time", type=datetime.fromisoformat, help=_("Optional end time"))
    add_parser.add_argument("--priority", type=int, default=0, help=_("Priority from 0 to 5"))
    add_parser.add_argument("--status", default="planned", help=_("Event status"))
    add_parser.add_argument(
        "--type",
        dest="event_type",
        default="appointment",
        help=_("Event type: appointment, timeblock, or deadline"),
    )
    add_parser.add_argument(
        "--all-day",
        action=argparse.BooleanOptionalAction,
        default=False,
        help=_("Mark the event as all-day"),
    )
    add_parser.add_argument("--area-id", type=UUID, help=_("Optional linked area identifier"))
    add_parser.add_argument("--task-id", type=UUID, help=_("Optional linked task identifier"))
    add_parser.add_argument(
        "--recurrence-frequency",
        help=_("Optional recurrence frequency: daily, weekly, monthly, or yearly"),
    )
    add_parser.add_argument(
        "--recurrence-interval",
        type=int,
        help=_("Optional recurrence interval, default 1"),
    )
    add_parser.add_argument(
        "--recurrence-count",
        type=int,
        help=_("Optional total occurrence count"),
    )
    add_parser.add_argument(
        "--recurrence-until",
        type=datetime.fromisoformat,
        help=_("Optional final allowed occurrence start time"),
    )
    add_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to attach one or more event tags"),
    )
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to attach one or more people"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_event_add_async))


def build_event_update_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event update command."""
    update_parser = add_documented_parser(
        event_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update an event"),
            description=_("Update mutable event fields."),
            examples=(
                "lifeos event update 11111111-1111-1111-1111-111111111111 --status completed",
                "lifeos event update 11111111-1111-1111-1111-111111111111 --type deadline",
                "lifeos event update 11111111-1111-1111-1111-111111111111 "
                "--scope single --instance-start 2026-04-10T09:00:00-04:00 "
                "--clear-end-time",
                "lifeos event update 11111111-1111-1111-1111-111111111111 "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
                "lifeos event update 11111111-1111-1111-1111-111111111111 "
                "--clear-task --clear-area",
                "lifeos event update 11111111-1111-1111-1111-111111111111 "
                "--clear-people --clear-tags",
            ),
            notes=(
                _("Use `--type` to retag an event as appointment, timeblock, or deadline."),
                _("Use `--clear-*` flags to explicitly remove optional values."),
                _("Do not mix a value flag with the matching clear flag in the same command."),
                _("Use `--scope single|all_future|all` for recurring series updates."),
                _("`--scope single` and `--scope all_future` require `--instance-start`."),
                _(
                    "Use repeated `--person-id` to keep human-only, agent-only, and shared "
                    "ownership explicit as plans change."
                ),
            ),
        ),
    )
    update_parser.add_argument("event_id", type=UUID, help=_("Event identifier"))
    update_parser.add_argument("--title", help=_("Updated event title"))
    update_parser.add_argument("--description", help=_("Updated description"))
    update_parser.add_argument(
        "--clear-description", action="store_true", help=_("Clear description")
    )
    update_parser.add_argument(
        "--start-time", type=datetime.fromisoformat, help=_("Updated start time")
    )
    update_parser.add_argument(
        "--end-time", type=datetime.fromisoformat, help=_("Updated end time")
    )
    update_parser.add_argument("--clear-end-time", action="store_true", help=_("Clear end time"))
    update_parser.add_argument("--priority", type=int, help=_("Updated priority from 0 to 5"))
    update_parser.add_argument("--status", help=_("Updated event status"))
    update_parser.add_argument(
        "--type",
        dest="event_type",
        help=_("Updated event type: appointment, timeblock, or deadline"),
    )
    update_parser.add_argument(
        "--all-day",
        action=argparse.BooleanOptionalAction,
        default=None,
        help=_("Toggle all-day status"),
    )
    update_parser.add_argument("--area-id", type=UUID, help=_("Updated linked area identifier"))
    update_parser.add_argument("--clear-area", action="store_true", help=_("Clear linked area"))
    update_parser.add_argument("--task-id", type=UUID, help=_("Updated linked task identifier"))
    update_parser.add_argument("--clear-task", action="store_true", help=_("Clear linked task"))
    update_parser.add_argument(
        "--recurrence-frequency",
        help=_("Updated recurrence frequency: daily, weekly, monthly, or yearly"),
    )
    update_parser.add_argument(
        "--recurrence-interval",
        type=int,
        help=_("Updated recurrence interval"),
    )
    update_parser.add_argument("--recurrence-count", type=int, help=_("Updated recurrence count"))
    update_parser.add_argument(
        "--recurrence-until",
        type=datetime.fromisoformat,
        help=_("Updated recurrence until datetime"),
    )
    update_parser.add_argument(
        "--clear-recurrence",
        action="store_true",
        help=_("Remove recurrence from the event"),
    )
    update_parser.add_argument(
        "--scope",
        default="all",
        help=_("Update scope for recurring events: single, all_future, or all"),
    )
    update_parser.add_argument(
        "--instance-start",
        type=datetime.fromisoformat,
        help=_("Instance start time for single or all_future recurring updates"),
    )
    update_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace tags with one or more identifiers"),
    )
    update_parser.add_argument("--clear-tags", action="store_true", help=_("Remove all tags"))
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace people with one or more identifiers"),
    )
    update_parser.add_argument("--clear-people", action="store_true", help=_("Remove all people"))
    update_parser.set_defaults(handler=make_sync_handler(handle_event_update_async))


def build_event_delete_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event delete command."""
    delete_parser = add_documented_parser(
        event_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete an event"),
            description=_("Soft-delete one event."),
            examples=(
                "lifeos event delete 11111111-1111-1111-1111-111111111111",
                "lifeos event delete 11111111-1111-1111-1111-111111111111 "
                "--scope single --instance-start 2026-04-10T09:00:00-04:00",
                "lifeos event delete 11111111-1111-1111-1111-111111111111 "
                "--scope all_future --instance-start 2026-04-10T09:00:00-04:00",
            ),
            notes=(
                _("Use `--scope single|all_future|all` for recurring series deletes."),
                _("`--scope single` and `--scope all_future` require `--instance-start`."),
            ),
        ),
    )
    delete_parser.add_argument("event_id", type=UUID, help=_("Event identifier"))
    delete_parser.add_argument(
        "--scope",
        default="all",
        help=_("Delete scope for recurring events: single, all_future, or all"),
    )
    delete_parser.add_argument(
        "--instance-start",
        type=datetime.fromisoformat,
        help=_("Instance start time for single or all_future recurring deletes"),
    )
    delete_parser.set_defaults(handler=make_sync_handler(handle_event_delete_async))
