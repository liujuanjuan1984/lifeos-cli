"""Read-side task service helpers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.task import Task
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
