"""CLI handlers for the event resource."""

from __future__ import annotations

import argparse
import sys
from typing import Any

from lifeos_cli.cli_support.output_utils import format_timestamp, print_batch_result
from lifeos_cli.cli_support.runtime_utils import run_async
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import events as event_services


def _format_event_summary(event: Any) -> str:
    status = "deleted" if getattr(event, "deleted_at", None) is not None else event.status
    return (
        f"{event.id}\t{status}\t{format_timestamp(event.start_time)}\t"
        f"{format_timestamp(event.end_time)}\t{event.task_id or '-'}\t{event.title}"
    )


def _format_event_detail(event: Any) -> str:
    tag_names = ", ".join(tag.name for tag in event.tags) if getattr(event, "tags", None) else "-"
    people_names = (
        ", ".join(person.name for person in event.people) if getattr(event, "people", None) else "-"
    )
    return "\n".join(
        (
            f"id: {event.id}",
            f"title: {event.title}",
            f"description: {event.description or '-'}",
            f"status: {event.status}",
            f"priority: {event.priority}",
            f"is_all_day: {event.is_all_day}",
            f"start_time: {format_timestamp(event.start_time)}",
            f"end_time: {format_timestamp(event.end_time)}",
            f"recurrence_frequency: {getattr(event, 'recurrence_frequency', None) or '-'}",
            f"recurrence_interval: {getattr(event, 'recurrence_interval', None) or '-'}",
            f"recurrence_count: {getattr(event, 'recurrence_count', None) or '-'}",
            f"recurrence_until: {format_timestamp(getattr(event, 'recurrence_until', None))}",
            "recurrence_parent_event_id: "
            f"{getattr(event, 'recurrence_parent_event_id', None) or '-'}",
            "recurrence_instance_start: "
            f"{format_timestamp(getattr(event, 'recurrence_instance_start', None))}",
            f"area_id: {event.area_id or '-'}",
            f"task_id: {event.task_id or '-'}",
            f"tags: {tag_names}",
            f"people: {people_names}",
            f"created_at: {format_timestamp(event.created_at)}",
            f"updated_at: {format_timestamp(event.updated_at)}",
            f"deleted_at: {format_timestamp(event.deleted_at)}",
        )
    )


def _print_event_error(exc: Exception) -> int:
    print(str(exc), file=sys.stderr)
    return 1


async def handle_event_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            event = await event_services.create_event(
                session,
                title=args.title,
                description=args.description,
                start_time=args.start_time,
                end_time=args.end_time,
                priority=args.priority,
                status=args.status,
                is_all_day=args.all_day,
                area_id=args.area_id,
                task_id=args.task_id,
                tag_ids=args.tag_ids,
                person_ids=args.person_ids,
                recurrence_frequency=args.recurrence_frequency,
                recurrence_interval=args.recurrence_interval,
                recurrence_count=args.recurrence_count,
                recurrence_until=args.recurrence_until,
            )
        except (
            event_services.EventAreaReferenceNotFoundError,
            event_services.EventTaskReferenceNotFoundError,
            event_services.EventValidationError,
            LookupError,
        ) as exc:
            return _print_event_error(exc)
    print(f"Created event {event.id}")
    return 0


def handle_event_add(args: argparse.Namespace) -> int:
    return run_async(handle_event_add_async(args))


async def handle_event_list_async(args: argparse.Namespace) -> int:
    if args.local_date is not None and (
        args.window_start is not None or args.window_end is not None
    ):
        print(
            "Use either --date or --window-start/--window-end, not both.",
            file=sys.stderr,
        )
        return 1
    async with db_session.session_scope() as session:
        try:
            events = await event_services.list_events(
                session,
                title_contains=args.title_contains,
                status=args.status,
                area_id=args.area_id,
                task_id=args.task_id,
                person_id=args.person_id,
                tag_id=args.tag_id,
                local_date=args.local_date,
                window_start=args.window_start,
                window_end=args.window_end,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        except event_services.EventValidationError as exc:
            return _print_event_error(exc)
    if not events:
        print("No events found.")
        return 0
    for event in events:
        print(_format_event_summary(event))
    return 0


def handle_event_list(args: argparse.Namespace) -> int:
    return run_async(handle_event_list_async(args))


async def handle_event_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        event = await event_services.get_event(
            session,
            event_id=args.event_id,
            include_deleted=args.include_deleted,
        )
    if event is None:
        print(f"Event {args.event_id} was not found", file=sys.stderr)
        return 1
    print(_format_event_detail(event))
    return 0


def handle_event_show(args: argparse.Namespace) -> int:
    return run_async(handle_event_show_async(args))


async def handle_event_update_async(args: argparse.Namespace) -> int:
    conflicts = (
        (
            args.clear_description and args.description is not None,
            "--description",
            "--clear-description",
        ),
        (args.clear_end_time and args.end_time is not None, "--end-time", "--clear-end-time"),
        (args.clear_area and args.area_id is not None, "--area-id", "--clear-area"),
        (args.clear_task and args.task_id is not None, "--task-id", "--clear-task"),
        (args.clear_tags and args.tag_ids is not None, "--tag-id", "--clear-tags"),
        (args.clear_people and args.person_ids is not None, "--person-id", "--clear-people"),
        (
            args.clear_recurrence
            and any(
                value is not None
                for value in (
                    args.recurrence_frequency,
                    args.recurrence_interval,
                    args.recurrence_count,
                    args.recurrence_until,
                )
            ),
            "--recurrence-*",
            "--clear-recurrence",
        ),
    )
    for is_conflict, value_flag, clear_flag in conflicts:
        if is_conflict:
            print(f"Use either {value_flag} or {clear_flag}, not both.", file=sys.stderr)
            return 1
    async with db_session.session_scope() as session:
        try:
            event = await event_services.update_event(
                session,
                event_id=args.event_id,
                title=args.title,
                description=args.description,
                clear_description=args.clear_description,
                start_time=args.start_time,
                end_time=args.end_time,
                clear_end_time=args.clear_end_time,
                priority=args.priority,
                status=args.status,
                is_all_day=args.all_day,
                area_id=args.area_id,
                clear_area=args.clear_area,
                task_id=args.task_id,
                clear_task=args.clear_task,
                tag_ids=args.tag_ids,
                clear_tags=args.clear_tags,
                person_ids=args.person_ids,
                clear_people=args.clear_people,
                recurrence_frequency=args.recurrence_frequency,
                recurrence_interval=args.recurrence_interval,
                recurrence_count=args.recurrence_count,
                recurrence_until=args.recurrence_until,
                clear_recurrence=args.clear_recurrence,
                scope=args.scope,
                instance_start=args.instance_start,
            )
        except (
            event_services.EventNotFoundError,
            event_services.EventAreaReferenceNotFoundError,
            event_services.EventTaskReferenceNotFoundError,
            event_services.EventValidationError,
            LookupError,
        ) as exc:
            return _print_event_error(exc)
    print(f"Updated event {event.id}")
    return 0


def handle_event_update(args: argparse.Namespace) -> int:
    return run_async(handle_event_update_async(args))


async def handle_event_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            await event_services.delete_event(
                session,
                event_id=args.event_id,
                scope=args.scope,
                instance_start=args.instance_start,
            )
        except event_services.EventNotFoundError as exc:
            return _print_event_error(exc)
        except event_services.EventValidationError as exc:
            return _print_event_error(exc)
    print(f"Soft-deleted event {args.event_id}")
    return 0


def handle_event_delete(args: argparse.Namespace) -> int:
    return run_async(handle_event_delete_async(args))


async def handle_event_batch_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        result = await event_services.batch_delete_events(
            session,
            event_ids=list(args.event_ids),
        )
    return print_batch_result(
        success_label="Deleted events",
        success_count=result.deleted_count,
        failed_label="Failed event IDs",
        result=result,
    )


def handle_event_batch_delete(args: argparse.Namespace) -> int:
    return run_async(handle_event_batch_delete_async(args))
