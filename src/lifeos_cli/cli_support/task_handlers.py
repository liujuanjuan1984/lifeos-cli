"""CLI handlers for the task resource."""

from __future__ import annotations

import argparse
import sys
from datetime import date

from lifeos_cli.cli_support.shared import format_id_lines, format_timestamp, run_async
from lifeos_cli.db.models.task import Task
from lifeos_cli.db.services import (
    InvalidPlanningCycleError,
    InvalidTaskDepthError,
    ParentTaskReferenceNotFoundError,
    TaskNotFoundError,
    VisionReferenceNotFoundError,
    batch_delete_tasks,
    create_task,
    delete_task,
    get_task,
    list_tasks,
    update_task,
)
from lifeos_cli.db.session import session_scope


def _parse_cycle_date(value: str | None) -> date | None:
    if value is None:
        return None
    return date.fromisoformat(value)


def _format_task_summary(task: Task) -> str:
    status = "deleted" if task.deleted_at is not None else task.status
    return f"{task.id}\t{status}\t{task.vision_id}\t{task.parent_task_id or '-'}\t{task.content}"


def _format_task_detail(task: Task) -> str:
    return "\n".join(
        (
            f"id: {task.id}",
            f"vision_id: {task.vision_id}",
            f"parent_task_id: {task.parent_task_id or '-'}",
            f"content: {task.content}",
            f"description: {task.description or '-'}",
            f"status: {task.status}",
            f"priority: {task.priority}",
            f"display_order: {task.display_order}",
            f"estimated_effort: {task.estimated_effort or '-'}",
            f"planning_cycle_type: {task.planning_cycle_type or '-'}",
            f"planning_cycle_days: {task.planning_cycle_days or '-'}",
            f"planning_cycle_start_date: {task.planning_cycle_start_date or '-'}",
            f"actual_effort_self: {task.actual_effort_self}",
            f"actual_effort_total: {task.actual_effort_total}",
            f"created_at: {format_timestamp(task.created_at)}",
            f"updated_at: {format_timestamp(task.updated_at)}",
            f"deleted_at: {format_timestamp(task.deleted_at)}",
        )
    )


async def handle_task_add_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            task = await create_task(
                session,
                vision_id=args.vision_id,
                content=args.content,
                description=args.description,
                parent_task_id=args.parent_task_id,
                status=args.status,
                priority=args.priority,
                display_order=args.display_order,
                estimated_effort=args.estimated_effort,
                planning_cycle_type=args.planning_cycle_type,
                planning_cycle_days=args.planning_cycle_days,
                planning_cycle_start_date=_parse_cycle_date(args.planning_cycle_start_date),
            )
        except (
            VisionReferenceNotFoundError,
            ParentTaskReferenceNotFoundError,
            InvalidTaskDepthError,
            InvalidPlanningCycleError,
            ValueError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Created task {task.id}")
    return 0


def handle_task_add(args: argparse.Namespace) -> int:
    return run_async(handle_task_add_async(args))


async def handle_task_list_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            tasks = await list_tasks(
                session,
                vision_id=args.vision_id,
                parent_task_id=args.parent_task_id,
                status=args.status,
                include_deleted=args.include_deleted,
                limit=args.limit,
                offset=args.offset,
            )
        except ValueError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    if not tasks:
        print("No tasks found.")
        return 0
    for task in tasks:
        print(_format_task_summary(task))
    return 0


def handle_task_list(args: argparse.Namespace) -> int:
    return run_async(handle_task_list_async(args))


async def handle_task_show_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        task = await get_task(session, task_id=args.task_id, include_deleted=args.include_deleted)
    if task is None:
        print(f"Task {args.task_id} was not found", file=sys.stderr)
        return 1
    print(_format_task_detail(task))
    return 0


def handle_task_show(args: argparse.Namespace) -> int:
    return run_async(handle_task_show_async(args))


async def handle_task_update_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            task = await update_task(
                session,
                task_id=args.task_id,
                content=args.content,
                description=args.description,
                parent_task_id=args.parent_task_id,
                status=args.status,
                priority=args.priority,
                display_order=args.display_order,
                estimated_effort=args.estimated_effort,
                planning_cycle_type=args.planning_cycle_type,
                planning_cycle_days=args.planning_cycle_days,
                planning_cycle_start_date=_parse_cycle_date(args.planning_cycle_start_date)
                if args.planning_cycle_start_date
                else None,
            )
        except (
            TaskNotFoundError,
            ParentTaskReferenceNotFoundError,
            InvalidTaskDepthError,
            InvalidPlanningCycleError,
            ValueError,
        ) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Updated task {task.id}")
    return 0


def handle_task_update(args: argparse.Namespace) -> int:
    return run_async(handle_task_update_async(args))


async def handle_task_delete_async(args: argparse.Namespace) -> int:
    async with session_scope() as session:
        try:
            await delete_task(session, task_id=args.task_id)
        except TaskNotFoundError as exc:
            print(str(exc), file=sys.stderr)
            return 1
    print(f"Soft-deleted task {args.task_id}")
    return 0


def handle_task_delete(args: argparse.Namespace) -> int:
    return run_async(handle_task_delete_async(args))


async def handle_task_batch_delete_async(args: argparse.Namespace) -> int:
    """Delete multiple tasks in one command."""
    async with session_scope() as session:
        result = await batch_delete_tasks(
            session,
            task_ids=list(args.task_ids),
        )
    print(f"Deleted tasks: {result.deleted_count}")
    if result.failed_ids:
        print(format_id_lines("Failed task IDs", result.failed_ids), file=sys.stderr)
    for error in result.errors:
        print(f"Error: {error}", file=sys.stderr)
    return 1 if result.failed_ids else 0


def handle_task_batch_delete(args: argparse.Namespace) -> int:
    """Delete multiple tasks in one command."""
    return run_async(handle_task_batch_delete_async(args))
