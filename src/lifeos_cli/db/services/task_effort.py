"""Task effort aggregation helpers."""

from __future__ import annotations

from collections import deque
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.task import Task
from lifeos_cli.db.models.timelog import Timelog


def _timelog_minutes(timelog: Timelog) -> int:
    """Return whole minutes for a finished timelog; zero if invalid."""
    delta = timelog.end_time - timelog.start_time
    if delta.total_seconds() <= 0:
        return 0
    return int(delta.total_seconds() // 60)


async def _load_active_task(session: AsyncSession, task_id: UUID) -> Task | None:
    stmt = select(Task).where(Task.id == task_id, Task.deleted_at.is_(None)).limit(1)
    return (await session.execute(stmt)).scalar_one_or_none()


async def _load_children(session: AsyncSession, parent_id: UUID) -> list[Task]:
    stmt = select(Task).where(Task.parent_task_id == parent_id, Task.deleted_at.is_(None))
    return list((await session.execute(stmt)).scalars())


async def recompute_task_self_minutes(session: AsyncSession, task_id: UUID) -> int:
    """Recompute direct timelog minutes for one task."""
    task = await _load_active_task(session, task_id)
    if task is None:
        return 0

    stmt = select(Timelog).where(
        Timelog.task_id == task_id,
        Timelog.deleted_at.is_(None),
    )
    timelogs = list((await session.execute(stmt)).scalars())
    total_minutes = sum(_timelog_minutes(timelog) for timelog in timelogs)
    task.actual_effort_self = total_minutes
    return total_minutes


async def recompute_totals_upwards(session: AsyncSession, start_task_id: UUID) -> None:
    """Recompute total effort for a task and its ancestor chain."""
    chain: list[Task] = []
    current = await _load_active_task(session, start_task_id)
    while current is not None:
        chain.append(current)
        if current.parent_task_id is None:
            break
        current = await _load_active_task(session, current.parent_task_id)

    visited: set[UUID] = set()
    for node in chain:
        if node.id in visited:
            continue
        visited.add(node.id)
        await recompute_task_self_minutes(session, node.id)

    for node in chain:
        children = await _load_children(session, node.id)
        child_total = sum(child.actual_effort_total or 0 for child in children)
        node.actual_effort_total = (node.actual_effort_self or 0) + child_total


async def recompute_subtree_totals(session: AsyncSession, subtree_root_id: UUID) -> None:
    """Recompute effort totals for every task in a subtree."""
    root = await _load_active_task(session, subtree_root_id)
    if root is None:
        return

    queue: deque[Task] = deque([root])
    nodes: list[Task] = []
    while queue:
        node = queue.popleft()
        nodes.append(node)
        queue.extend(await _load_children(session, node.id))

    for node in nodes:
        await recompute_task_self_minutes(session, node.id)

    processed: set[UUID] = set()

    async def _compute(node: Task) -> int:
        if node.id in processed:
            return node.actual_effort_total or 0
        children = await _load_children(session, node.id)
        total_children = 0
        for child in children:
            total_children += await _compute(child)
        node.actual_effort_total = (node.actual_effort_self or 0) + total_children
        processed.add(node.id)
        return node.actual_effort_total

    await _compute(root)


async def recompute_task_effort_after_timelog_change(
    session: AsyncSession,
    *,
    old_task_id: UUID | None,
    new_task_id: UUID | None,
) -> None:
    """Recompute affected task effort after a timelog mutation."""
    task_ids = [task_id for task_id in (old_task_id, new_task_id) if task_id is not None]
    for task_id in dict.fromkeys(task_ids):
        await recompute_task_self_minutes(session, task_id)
        await recompute_totals_upwards(session, task_id)
