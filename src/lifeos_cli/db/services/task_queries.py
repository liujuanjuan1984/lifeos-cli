"""Read-side task service helpers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.task import Task
from lifeos_cli.db.services.entity_people import load_people_for_entities
from lifeos_cli.db.services.task_support import validate_task_status


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
    task = (await session.execute(stmt)).scalar_one_or_none()
    if task is None:
        return None
    people_map = await load_people_for_entities(session, entity_ids=[task.id], entity_type="task")
    task.people = people_map.get(task.id, [])
    return task


async def list_tasks(
    session: AsyncSession,
    *,
    vision_id: UUID | None = None,
    parent_task_id: UUID | None = None,
    person_id: UUID | None = None,
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
    if person_id is not None:
        stmt = stmt.join(
            person_associations,
            (person_associations.c.entity_id == Task.id)
            & (person_associations.c.entity_type == "task"),
        ).where(person_associations.c.person_id == person_id)
    if status is not None:
        stmt = stmt.where(Task.status == validate_task_status(status))
    stmt = (
        stmt.order_by(Task.display_order.asc(), Task.created_at.asc(), Task.id.asc())
        .offset(offset)
        .limit(limit)
    )
    tasks = list((await session.execute(stmt)).scalars())
    people_map = await load_people_for_entities(
        session,
        entity_ids=[task.id for task in tasks],
        entity_type="task",
    )
    for task in tasks:
        task.people = people_map.get(task.id, [])
    return tasks
