"""Lifecycle reconciliation for planning-oriented views."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.models.habit import Habit
from lifeos_cli.db.models.habit_action import HabitAction
from lifeos_cli.db.services.habit_queries import (
    _materialize_habit_action_for_date,
    build_habit_action_views,
    get_habit,
)
from lifeos_cli.db.services.habit_support import (
    HABIT_ACTION_AUTO_MISS_AFTER_DAYS,
    HabitValidationError,
)


async def reconcile_planning_habit_action_lifecycle(
    session: AsyncSession,
    *,
    reference_date: date,
    start_date: date,
    end_date: date,
    habit_id: UUID | None = None,
) -> int:
    """Persist pending habit actions older than the planning grace window as missed."""
    if end_date < start_date:
        raise HabitValidationError("end_date must be on or after start_date")
    cutoff_date = reference_date - timedelta(days=HABIT_ACTION_AUTO_MISS_AFTER_DAYS)
    expiration_end_date = min(end_date, cutoff_date - timedelta(days=1))
    if expiration_end_date < start_date:
        return 0

    stmt = select(HabitAction).where(
        HabitAction.action_date >= start_date,
        HabitAction.action_date <= expiration_end_date,
        HabitAction.status == "pending",
        HabitAction.deleted_at.is_(None),
    )
    if habit_id is not None:
        stmt = stmt.where(HabitAction.habit_id == habit_id)
    materialized_actions = list((await session.execute(stmt)).scalars())

    expired_count = 0
    for action in materialized_actions:
        action.status = "miss"
        expired_count += 1

    views = await build_habit_action_views(
        session,
        habit_id=habit_id,
        status="pending",
        action_window=(start_date, expiration_end_date),
    )
    habits_by_id: dict[UUID, Habit] = {}
    for view in views:
        if view.id is not None:
            continue
        habit = habits_by_id.get(view.habit_id)
        if habit is None:
            loaded_habit = await get_habit(session, habit_id=view.habit_id)
            if loaded_habit is None:
                continue
            habit = loaded_habit
            habits_by_id[habit.id] = habit
        action = await _materialize_habit_action_for_date(
            session,
            habit=habit,
            action_date=view.action_date,
        )
        action.status = "miss"
        expired_count += 1

    if expired_count:
        await session.flush()
    return expired_count
