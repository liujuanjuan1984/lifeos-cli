"""CLI handlers for the timelog resource."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.output_utils import format_id_lines, format_timestamp
from lifeos_cli.cli_support.runtime_utils import run_async
from lifeos_cli.db import session as db_session
from lifeos_cli.db.models.timelog import Timelog
from lifeos_cli.db.services import timelogs as timelog_services


def _format_timelog_summary(timelog: Timelog) -> str:
    status = "deleted" if timelog.deleted_at is not None else timelog.tracking_method
    return (
        f"{timelog.id}\t{status}\t{format_timestamp(timelog.start_time)}\t"
        f"{format_timestamp(timelog.end_time)}\t{timelog.task_id or '-'}\t{timelog.title}"
    )


def _format_timelog_detail(timelog: Timelog) -> str:
    tag_names = (
        ", ".join(tag.name for tag in timelog.tags) if getattr(timelog, "tags", None) else "-"
    )
    people_names = (
        ", ".join(person.name for person in timelog.people)
        if getattr(timelog, "people", None)
        else "-"
    )
    return "\n".join(
        (
            f"id: {timelog.id}",
            f"title: {timelog.title}",
            f"tracking_method: {timelog.tracking_method}",
            f"start_time: {format_timestamp(timelog.start_time)}",
            f"end_time: {format_timestamp(timelog.end_time)}",
            f"location: {timelog.location or '-'}",
            f"energy_level: {timelog.energy_level if timelog.energy_level is not None else '-'}",
            f"notes: {timelog.notes or '-'}",
            f"area_id: {timelog.area_id or '-'}",
            f"task_id: {timelog.task_id or '-'}",
            f"tags: {tag_names}",
            f"people: {people_names}",
            f"created_at: {format_timestamp(timelog.created_at)}",
            f"updated_at: {format_timestamp(timelog.updated_at)}",
            f"deleted_at: {format_timestamp(timelog.deleted_at)}",
        )
    )


def _print_timelog_error(exc: Exception) -> int:
    print(str(exc), file=sys.stderr)
    return 1


async def handle_timelog_add_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            timelog = await timelog_services.create_timelog(
                session,
                title=args.title,
                start_time=args.start_time,
                end_time=args.end_time,
                tracking_method=args.tracking_method,
                location=args.location,
                energy_level=args.energy_level,
                notes=args.notes,
                area_id=args.area_id,
                task_id=args.task_id,
                tag_ids=args.tag_ids,
                person_ids=args.person_ids,
            )
        except (
            timelog_services.TimelogAreaReferenceNotFoundError,
            timelog_services.TimelogTaskReferenceNotFoundError,
            timelog_services.TimelogValidationError,
            LookupError,
        ) as exc:
            return _print_timelog_error(exc)
    print(f"Created timelog {timelog.id}")
    return 0


def handle_timelog_add(args: argparse.Namespace) -> int:
    return run_async(handle_timelog_add_async(args))


async def handle_timelog_list_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            timelogs = await timelog_services.list_timelogs(
                session,
                title_contains=args.title_contains,
                tracking_method=args.tracking_method,
                area_id=args.area_id,
                task_id=args.task_id,
                person_id=args.person_id,
                tag_id=args.tag_id,
                window_start=args.window_start,
                window_end=args.window_end,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        except timelog_services.TimelogValidationError as exc:
            return _print_timelog_error(exc)
    if not timelogs:
        print("No timelogs found.")
        return 0
    for timelog in timelogs:
        print(_format_timelog_summary(timelog))
    return 0


def handle_timelog_list(args: argparse.Namespace) -> int:
    return run_async(handle_timelog_list_async(args))


async def handle_timelog_show_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        timelog = await timelog_services.get_timelog(
            session,
            timelog_id=args.timelog_id,
            include_deleted=args.include_deleted,
        )
    if timelog is None:
        print(f"Timelog {args.timelog_id} was not found", file=sys.stderr)
        return 1
    print(_format_timelog_detail(timelog))
    return 0


def handle_timelog_show(args: argparse.Namespace) -> int:
    return run_async(handle_timelog_show_async(args))


async def handle_timelog_update_async(args: argparse.Namespace) -> int:
    conflicts = (
        (args.clear_location and args.location is not None, "--location", "--clear-location"),
        (
            args.clear_energy_level and args.energy_level is not None,
            "--energy-level",
            "--clear-energy-level",
        ),
        (args.clear_notes and args.notes is not None, "--notes", "--clear-notes"),
        (args.clear_area and args.area_id is not None, "--area-id", "--clear-area"),
        (args.clear_task and args.task_id is not None, "--task-id", "--clear-task"),
        (args.clear_tags and args.tag_ids is not None, "--tag-id", "--clear-tags"),
        (args.clear_people and args.person_ids is not None, "--person-id", "--clear-people"),
    )
    for is_conflict, value_flag, clear_flag in conflicts:
        if is_conflict:
            print(f"Use either {value_flag} or {clear_flag}, not both.", file=sys.stderr)
            return 1
    async with db_session.session_scope() as session:
        try:
            timelog = await timelog_services.update_timelog(
                session,
                timelog_id=args.timelog_id,
                title=args.title,
                start_time=args.start_time,
                end_time=args.end_time,
                tracking_method=args.tracking_method,
                location=args.location,
                clear_location=args.clear_location,
                energy_level=args.energy_level,
                clear_energy_level=args.clear_energy_level,
                notes=args.notes,
                clear_notes=args.clear_notes,
                area_id=args.area_id,
                clear_area=args.clear_area,
                task_id=args.task_id,
                clear_task=args.clear_task,
                tag_ids=args.tag_ids,
                clear_tags=args.clear_tags,
                person_ids=args.person_ids,
                clear_people=args.clear_people,
            )
        except (
            timelog_services.TimelogNotFoundError,
            timelog_services.TimelogAreaReferenceNotFoundError,
            timelog_services.TimelogTaskReferenceNotFoundError,
            timelog_services.TimelogValidationError,
            LookupError,
        ) as exc:
            return _print_timelog_error(exc)
    print(f"Updated timelog {timelog.id}")
    return 0


def handle_timelog_update(args: argparse.Namespace) -> int:
    return run_async(handle_timelog_update_async(args))


async def handle_timelog_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        try:
            await timelog_services.delete_timelog(session, timelog_id=args.timelog_id)
        except timelog_services.TimelogNotFoundError as exc:
            return _print_timelog_error(exc)
    print(f"Soft-deleted timelog {args.timelog_id}")
    return 0


def handle_timelog_delete(args: argparse.Namespace) -> int:
    return run_async(handle_timelog_delete_async(args))


async def handle_timelog_batch_delete_async(args: argparse.Namespace) -> int:
    async with db_session.session_scope() as session:
        result = await timelog_services.batch_delete_timelogs(
            session,
            timelog_ids=list(args.timelog_ids),
        )
    print(f"Deleted timelogs: {result.deleted_count}")
    if result.failed_ids:
        print(format_id_lines("Failed timelog IDs", result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


def handle_timelog_batch_delete(args: argparse.Namespace) -> int:
    return run_async(handle_timelog_batch_delete_async(args))
