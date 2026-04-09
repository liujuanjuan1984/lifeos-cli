"""Async CRUD helpers for hierarchical tasks."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.task import Task
from lifeos_cli.db.models.vision import Vision
from lifeos_cli.db.services.batching import BatchDeleteResult

VALID_TASK_STATUSES = {"todo", "in_progress", "done", "cancelled", "paused"}
VALID_PLANNING_CYCLE_TYPES = {"year", "month", "week", "day"}
MAX_TASK_DEPTH = 8


class TaskNotFoundError(LookupError):
    """Raised when a task cannot be found."""


class VisionReferenceNotFoundError(LookupError):
    """Raised when a referenced vision cannot be found."""


class ParentTaskReferenceNotFoundError(LookupError):
    """Raised when a referenced parent task cannot be found."""


class InvalidTaskDepthError(ValueError):
    """Raised when a task hierarchy exceeds the configured max depth."""


class InvalidPlanningCycleError(ValueError):
    """Raised when planning cycle fields are incomplete or invalid."""


def _deduplicate_task_ids(task_ids: list[UUID]) -> list[UUID]:
    """Return task identifiers in their original order without duplicates."""
    return list(dict.fromkeys(task_ids))


def validate_task_status(status: str) -> str:
    """Validate a task status."""
    normalized = status.strip().lower()
    if normalized not in VALID_TASK_STATUSES:
        allowed = ", ".join(sorted(VALID_TASK_STATUSES))
        raise ValueError(f"Invalid task status {normalized!r}. Expected one of: {allowed}")
    return normalized


def validate_planning_cycle(
    *,
    planning_cycle_type: str | None,
    planning_cycle_days: int | None,
    planning_cycle_start_date: date | None,
) -> tuple[str | None, int | None, date | None]:
    """Validate planning cycle fields."""
    values = (planning_cycle_type, planning_cycle_days, planning_cycle_start_date)
    if all(value is None for value in values):
        return values
    if any(value is None for value in values):
        raise InvalidPlanningCycleError(
            "Planning cycle type, days, and start date must be provided together"
        )
    assert planning_cycle_type is not None
    assert planning_cycle_days is not None
    normalized_type = planning_cycle_type.strip().lower()
    if normalized_type not in VALID_PLANNING_CYCLE_TYPES:
        allowed = ", ".join(sorted(VALID_PLANNING_CYCLE_TYPES))
        raise InvalidPlanningCycleError(
            f"Invalid planning cycle type {normalized_type!r}. Expected one of: {allowed}"
        )
    if planning_cycle_days <= 0:
        raise InvalidPlanningCycleError("Planning cycle days must be greater than zero")
    return normalized_type, planning_cycle_days, planning_cycle_start_date


async def _ensure_vision_exists(session: AsyncSession, vision_id: UUID) -> None:
    result = await session.execute(
        select(Vision.id).where(Vision.id == vision_id, Vision.deleted_at.is_(None)).limit(1)
    )
    if result.scalar_one_or_none() is None:
        raise VisionReferenceNotFoundError(f"Vision {vision_id} was not found")


async def _load_parent_task(session: AsyncSession, parent_task_id: UUID | None) -> Task | None:
    if parent_task_id is None:
        return None
    return (
        await session.execute(
            select(Task).where(Task.id == parent_task_id, Task.deleted_at.is_(None)).limit(1)
        )
    ).scalar_one_or_none()


async def _validate_parent_task(
    session: AsyncSession,
    *,
    vision_id: UUID,
    parent_task_id: UUID | None,
) -> Task | None:
    parent_task = await _load_parent_task(session, parent_task_id)
    if parent_task_id is None:
        return None
    if parent_task is None:
        raise ParentTaskReferenceNotFoundError(f"Task {parent_task_id} was not found")
    if parent_task.vision_id != vision_id:
        raise ParentTaskReferenceNotFoundError(
            "Parent task must belong to the same vision as the child task"
        )
    depth = 1
    current = parent_task
    while current.parent_task_id is not None:
        depth += 1
        if depth >= MAX_TASK_DEPTH:
            raise InvalidTaskDepthError(
                f"Task hierarchy depth cannot exceed {MAX_TASK_DEPTH} levels"
            )
        next_parent = await _load_parent_task(session, current.parent_task_id)
        if next_parent is None:
            break
        current = next_parent
    return parent_task


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
    await _ensure_vision_exists(session, vision_id)
    await _validate_parent_task(session, vision_id=vision_id, parent_task_id=parent_task_id)
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


async def get_task(
    session: AsyncSession,
    *,
    task_id: UUID,
    include_deleted: bool = False,
) -> Task | None:
    """Load a task by identifier."""
    stmt = select(Task).where(Task.id == task_id).limit(1)
    if not include_deleted:
        stmt = stmt.where(Task.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_tasks(
    session: AsyncSession,
    *,
    vision_id: UUID | None = None,
    parent_task_id: UUID | None = None,
    status: str | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Task]:
    """List tasks with basic filters."""
    stmt = select(Task)
    if not include_deleted:
        stmt = stmt.where(Task.deleted_at.is_(None))
    if vision_id is not None:
        stmt = stmt.where(Task.vision_id == vision_id)
    if parent_task_id is None and vision_id is not None:
        stmt = stmt.where(Task.parent_task_id.is_(None))
    elif parent_task_id is not None:
        stmt = stmt.where(Task.parent_task_id == parent_task_id)
    if status is not None:
        stmt = stmt.where(Task.status == validate_task_status(status))
    stmt = (
        stmt.order_by(Task.display_order.asc(), Task.created_at.asc(), Task.id.asc())
        .offset(offset)
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars())


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
    await _validate_parent_task(
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


async def delete_task(session: AsyncSession, *, task_id: UUID, hard_delete: bool = False) -> None:
    """Delete a task."""
    task = await get_task(session, task_id=task_id, include_deleted=hard_delete)
    if task is None:
        raise TaskNotFoundError(f"Task {task_id} was not found")
    if hard_delete:
        await session.delete(task)
    else:
        task.soft_delete()
        await session.flush()


async def batch_delete_tasks(
    session: AsyncSession,
    *,
    task_ids: list[UUID],
    hard_delete: bool = False,
) -> BatchDeleteResult:
    """Delete multiple tasks while preserving per-task error reporting."""
    deleted_count = 0
    failed_ids: list[UUID] = []
    errors: list[str] = []

    for task_id in _deduplicate_task_ids(task_ids):
        try:
            await delete_task(session, task_id=task_id, hard_delete=hard_delete)
            deleted_count += 1
        except TaskNotFoundError as exc:
            failed_ids.append(task_id)
            errors.append(str(exc))

    return BatchDeleteResult(
        deleted_count=deleted_count,
        failed_ids=tuple(failed_ids),
        errors=tuple(errors),
    )
