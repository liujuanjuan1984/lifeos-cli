"""Write-side task service helpers."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.task import Task
from lifeos_cli.db.services.batching import BatchDeleteResult
from lifeos_cli.db.services.entity_people import load_people_for_entities, sync_entity_people
from lifeos_cli.db.services.task_effort import recompute_subtree_totals, recompute_totals_upwards
from lifeos_cli.db.services.task_queries import get_task
from lifeos_cli.db.services.task_support import (
    ParentTaskReferenceNotFoundError,
    TaskNotFoundError,
    deduplicate_task_ids,
    ensure_vision_exists,
    load_task_subtree,
    validate_parent_task,
    validate_planning_cycle,
    validate_task_status,
    validate_task_status_change,
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
    person_ids: list[UUID] | None = None,
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
    if person_ids is not None:
        await sync_entity_people(
            session, entity_id=task.id, entity_type="task", desired_person_ids=person_ids
        )
    await session.refresh(task)
    people_map = await load_people_for_entities(session, entity_ids=[task.id], entity_type="task")
    task.people = people_map.get(task.id, [])
    return task


async def update_task(
    session: AsyncSession,
    *,
    task_id: UUID,
    content: str | None = None,
    description: str | None = None,
    clear_description: bool = False,
    parent_task_id: UUID | None = None,
    clear_parent: bool = False,
    status: str | None = None,
    priority: int | None = None,
    display_order: int | None = None,
    estimated_effort: int | None = None,
    clear_estimated_effort: bool = False,
    planning_cycle_type: str | None = None,
    planning_cycle_days: int | None = None,
    planning_cycle_start_date: date | None = None,
    clear_planning_cycle: bool = False,
    person_ids: list[UUID] | None = None,
    clear_people: bool = False,
) -> Task:
    """Update a task."""
    task = await get_task(session, task_id=task_id)
    if task is None:
        raise TaskNotFoundError(f"Task {task_id} was not found")
    if parent_task_id == task_id:
        raise ParentTaskReferenceNotFoundError("Task cannot be its own parent")
    old_parent_task_id = task.parent_task_id
    next_parent_task_id = (
        None
        if clear_parent
        else parent_task_id
        if parent_task_id is not None
        else task.parent_task_id
    )
    next_cycle_type = (
        None
        if clear_planning_cycle
        else planning_cycle_type
        if planning_cycle_type is not None
        else task.planning_cycle_type
    )
    next_cycle_days = (
        None
        if clear_planning_cycle
        else planning_cycle_days
        if planning_cycle_days is not None
        else task.planning_cycle_days
    )
    next_cycle_start_date = (
        None
        if clear_planning_cycle
        else planning_cycle_start_date
        if planning_cycle_start_date is not None
        else task.planning_cycle_start_date
    )
    await validate_parent_task(
        session,
        vision_id=task.vision_id,
        parent_task_id=next_parent_task_id,
        child_task_id=task.id,
    )
    (
        normalized_cycle_type,
        normalized_cycle_days,
        normalized_cycle_start_date,
    ) = validate_planning_cycle(
        planning_cycle_type=next_cycle_type,
        planning_cycle_days=next_cycle_days,
        planning_cycle_start_date=next_cycle_start_date,
    )
    if content is not None:
        task.content = content.strip()
    if clear_description:
        task.description = None
    elif description is not None:
        task.description = description
    if clear_parent:
        task.parent_task_id = None
    elif parent_task_id is not None:
        task.parent_task_id = parent_task_id
    if status is not None:
        task.status = await validate_task_status_change(session, task=task, new_status=status)
    if priority is not None:
        task.priority = priority
    if display_order is not None:
        task.display_order = display_order
    if clear_estimated_effort:
        task.estimated_effort = None
    elif estimated_effort is not None:
        task.estimated_effort = estimated_effort
    if clear_people:
        await sync_entity_people(
            session, entity_id=task.id, entity_type="task", desired_person_ids=[]
        )
    elif person_ids is not None:
        await sync_entity_people(
            session, entity_id=task.id, entity_type="task", desired_person_ids=person_ids
        )
    task.planning_cycle_type = normalized_cycle_type
    task.planning_cycle_days = normalized_cycle_days
    task.planning_cycle_start_date = normalized_cycle_start_date
    if task.parent_task_id != old_parent_task_id:
        await recompute_subtree_totals(session, task.id)
        if old_parent_task_id is not None:
            await recompute_totals_upwards(session, old_parent_task_id)
        await recompute_totals_upwards(session, task.id)
    await session.flush()
    await session.refresh(task)
    people_map = await load_people_for_entities(session, entity_ids=[task.id], entity_type="task")
    task.people = people_map.get(task.id, [])
    return task


async def delete_task(session: AsyncSession, *, task_id: UUID) -> None:
    """Soft-delete a task."""
    task = await get_task(session, task_id=task_id, include_deleted=False)
    if task is None:
        raise TaskNotFoundError(f"Task {task_id} was not found")
    old_parent_task_id = task.parent_task_id
    subtree = await load_task_subtree(session, root_task_id=task_id)
    for subtree_task in subtree:
        subtree_task.soft_delete()
    if old_parent_task_id is not None:
        await recompute_totals_upwards(session, old_parent_task_id)
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
