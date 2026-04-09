"""Write-side task service helpers."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.task import Task
from lifeos_cli.db.services.batching import BatchDeleteResult
from lifeos_cli.db.services.task_queries import get_task
from lifeos_cli.db.services.task_support import (
    ParentTaskReferenceNotFoundError,
    TaskNotFoundError,
    deduplicate_task_ids,
    ensure_vision_exists,
    validate_parent_task,
    validate_planning_cycle,
    validate_task_status,
)


async def create_task(
    session: AsyncSession,
    *,
    vision_id: UUID,
    content: str,
    description: str | None = None,
    parent_task_id: UUID | None = None,
    status: str = "todo",
    priority: int = 0,
    display_order: int = 0,
    estimated_effort: int | None = None,
    planning_cycle_type: str | None = None,
    planning_cycle_days: int | None = None,
    planning_cycle_start_date: date | None = None,
) -> Task:
    """Create a task."""
    await ensure_vision_exists(session, vision_id)
    await validate_parent_task(session, vision_id=vision_id, parent_task_id=parent_task_id)
    planning_cycle_type, planning_cycle_days, planning_cycle_start_date = validate_planning_cycle(
        planning_cycle_type=planning_cycle_type,
        planning_cycle_days=planning_cycle_days,
        planning_cycle_start_date=planning_cycle_start_date,
    )
    task = Task(
        vision_id=vision_id,
        parent_task_id=parent_task_id,
        content=content.strip(),
        description=description,
        status=validate_task_status(status),
        priority=priority,
        display_order=display_order,
        estimated_effort=estimated_effort,
        planning_cycle_type=planning_cycle_type,
        planning_cycle_days=planning_cycle_days,
        planning_cycle_start_date=planning_cycle_start_date,
    )
    session.add(task)
    await session.flush()
    await session.refresh(task)
    return task


async def update_task(
    session: AsyncSession,
    *,
    task_id: UUID,
    content: str | None = None,
    description: str | None = None,
    parent_task_id: UUID | None = None,
    status: str | None = None,
    priority: int | None = None,
    display_order: int | None = None,
    estimated_effort: int | None = None,
    planning_cycle_type: str | None = None,
    planning_cycle_days: int | None = None,
    planning_cycle_start_date: date | None = None,
) -> Task:
    """Update a task."""
    task = await get_task(session, task_id=task_id)
    if task is None:
        raise TaskNotFoundError(f"Task {task_id} was not found")
    if parent_task_id == task_id:
        raise ParentTaskReferenceNotFoundError("Task cannot be its own parent")
    next_parent_task_id = parent_task_id if parent_task_id is not None else task.parent_task_id
    await validate_parent_task(
        session, vision_id=task.vision_id, parent_task_id=next_parent_task_id
    )
    (
        normalized_cycle_type,
        normalized_cycle_days,
        normalized_cycle_start_date,
    ) = validate_planning_cycle(
        planning_cycle_type=planning_cycle_type
        if planning_cycle_type is not None
        else task.planning_cycle_type,
        planning_cycle_days=planning_cycle_days
        if planning_cycle_days is not None
        else task.planning_cycle_days,
        planning_cycle_start_date=planning_cycle_start_date
        if planning_cycle_start_date is not None
        else task.planning_cycle_start_date,
    )
    if content is not None:
        task.content = content.strip()
    if description is not None:
        task.description = description
    if parent_task_id is not None:
        task.parent_task_id = parent_task_id
    if status is not None:
        task.status = validate_task_status(status)
    if priority is not None:
        task.priority = priority
    if display_order is not None:
        task.display_order = display_order
    if estimated_effort is not None:
        task.estimated_effort = estimated_effort
    task.planning_cycle_type = normalized_cycle_type
    task.planning_cycle_days = normalized_cycle_days
    task.planning_cycle_start_date = normalized_cycle_start_date
    await session.flush()
    await session.refresh(task)
    return task


async def delete_task(session: AsyncSession, *, task_id: UUID) -> None:
    """Soft-delete a task."""
    task = await get_task(session, task_id=task_id, include_deleted=False)
    if task is None:
        raise TaskNotFoundError(f"Task {task_id} was not found")
    task.soft_delete()
    await session.flush()


async def batch_delete_tasks(
    session: AsyncSession,
    *,
    task_ids: list[UUID],
) -> BatchDeleteResult:
    """Soft-delete multiple tasks while preserving per-task error reporting."""
    deleted_count = 0
    failed_ids: list[UUID] = []
    errors: list[str] = []

    for task_id in deduplicate_task_ids(task_ids):
        try:
            await delete_task(session, task_id=task_id)
            deleted_count += 1
        except TaskNotFoundError as exc:
            failed_ids.append(task_id)
            errors.append(str(exc))

    return BatchDeleteResult(
        deleted_count=deleted_count,
        failed_ids=tuple(failed_ids),
        errors=tuple(errors),
    )
