"""Query helpers for habits and habit actions."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos_cli.application.time_preferences import get_operational_date
from lifeos_cli.db.models.habit import Habit
from lifeos_cli.db.models.habit_action import HabitAction
from lifeos_cli.db.models.task import Task
from lifeos_cli.db.services.habit_support import (
    DEFAULT_HABIT_ACTION_WINDOW_DAYS,
    MAX_HABIT_ACTION_WINDOW_DAYS,
    HabitNotFoundError,
    HabitValidationError,
    build_habit_stats_payload,
    refresh_habit_expiration,
    validate_habit_action_status,
    validate_habit_status,
)


def _apply_habit_filters(
    stmt: Any,
    *,
    status: str | None,
    title: str | None,
    active_window_only: bool,
    include_deleted: bool,
) -> Any:
    if not include_deleted:
        stmt = stmt.where(Habit.deleted_at.is_(None))
    if status is not None:
        stmt = stmt.where(Habit.status == validate_habit_status(status))
    if title is not None:
        normalized_title = title.strip()
        if normalized_title:
            stmt = stmt.where(Habit.title == normalized_title)
    if active_window_only:
        local_today = get_operational_date()
        end_expr = Habit.start_date + (Habit.duration_days - 1) * text("INTERVAL '1 day'")
        stmt = stmt.where(Habit.start_date <= local_today)
        stmt = stmt.where(end_expr >= local_today)
    return stmt


def _resolve_habit_action_window(
    *,
    action_date: date | None,
    center_date: date | None,
    days_before: int | None,
    days_after: int | None,
) -> tuple[date, date] | None:
    if action_date is not None:
        return None
    if not any(value is not None for value in (center_date, days_before, days_after)):
        return None

    reference_date = center_date or get_operational_date()
    window_before = days_before if days_before is not None else DEFAULT_HABIT_ACTION_WINDOW_DAYS
    window_after = days_after if days_after is not None else window_before
    if window_before < 0 or window_after < 0:
        raise HabitValidationError("days_before and days_after must be non-negative")
    if window_before + window_after + 1 > MAX_HABIT_ACTION_WINDOW_DAYS:
        raise HabitValidationError("The requested action window is larger than the allowed maximum")
    return reference_date - timedelta(days=window_before), reference_date + timedelta(
        days=window_after
    )


async def _apply_habit_action_filters(
    session: AsyncSession,
    stmt: Any,
    *,
    habit_id: UUID | None,
    status: str | None,
    action_date: date | None,
    center_date: date | None,
    days_before: int | None,
    days_after: int | None,
    include_deleted: bool,
) -> Any:
    if habit_id is not None:
        habit = await get_habit(session, habit_id=habit_id, include_deleted=include_deleted)
        if habit is None:
            raise HabitNotFoundError(f"Habit {habit_id} was not found")
        stmt = stmt.where(HabitAction.habit_id == habit_id)
    if not include_deleted:
        stmt = stmt.where(HabitAction.deleted_at.is_(None))
    if status is not None:
        stmt = stmt.where(HabitAction.status == validate_habit_action_status(status))
    if action_date is not None:
        stmt = stmt.where(HabitAction.action_date == action_date)
    else:
        action_window = _resolve_habit_action_window(
            action_date=action_date,
            center_date=center_date,
            days_before=days_before,
            days_after=days_after,
        )
        if action_window is not None:
            start, end = action_window
            stmt = stmt.where(HabitAction.action_date >= start, HabitAction.action_date <= end)
    return stmt


async def get_habit(
    session: AsyncSession,
    *,
    habit_id: UUID,
    include_deleted: bool = False,
) -> Habit | None:
    """Load a habit by identifier."""
    await refresh_habit_expiration(session, habit_id=habit_id)
    stmt = select(Habit).where(Habit.id == habit_id).options(selectinload(Habit.task)).limit(1)
    if not include_deleted:
        stmt = stmt.where(Habit.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_habits(
    session: AsyncSession,
    *,
    status: str | None = None,
    title: str | None = None,
    active_window_only: bool = False,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[Habit]:
    """List habits with optional status and title filters."""
    await refresh_habit_expiration(session)
    stmt = select(Habit).options(selectinload(Habit.task))
    stmt = _apply_habit_filters(
        stmt,
        status=status,
        title=title,
        active_window_only=active_window_only,
        include_deleted=include_deleted,
    )
    stmt = stmt.order_by(Habit.created_at.desc(), Habit.id.desc()).offset(offset).limit(limit)
    return list((await session.execute(stmt)).scalars())


async def count_habits(
    session: AsyncSession,
    *,
    status: str | None = None,
    title: str | None = None,
    active_window_only: bool = False,
    include_deleted: bool = False,
) -> int:
    """Count habits with the same filters used by list_habits."""
    await refresh_habit_expiration(session)
    stmt = select(func.count()).select_from(Habit)
    stmt = _apply_habit_filters(
        stmt,
        status=status,
        title=title,
        active_window_only=active_window_only,
        include_deleted=include_deleted,
    )
    return int((await session.execute(stmt)).scalar_one())


async def get_habit_stats(session: AsyncSession, *, habit_id: UUID) -> dict[str, object]:
    """Return statistics for one habit."""
    habit = await get_habit(session, habit_id=habit_id, include_deleted=False)
    if habit is None:
        raise HabitNotFoundError(f"Habit {habit_id} was not found")
    actions = await _load_active_actions(session, habit)
    return build_habit_stats_payload(habit, actions)


async def get_habit_overview(
    session: AsyncSession,
    *,
    habit_id: UUID,
    include_deleted: bool = False,
) -> dict[str, object]:
    """Return a habit plus its derived statistics."""
    habit = await get_habit(session, habit_id=habit_id, include_deleted=include_deleted)
    if habit is None:
        raise HabitNotFoundError(f"Habit {habit_id} was not found")
    actions = await _load_actions_for_overview(
        session, habit_id=habit.id, include_deleted=include_deleted
    )
    return {"habit": habit, "stats": build_habit_stats_payload(habit, actions)}


async def list_habit_overviews(
    session: AsyncSession,
    *,
    status: str | None = None,
    title: str | None = None,
    active_window_only: bool = False,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[dict[str, object]]:
    """Return habits with derived statistics."""
    habits = await list_habits(
        session,
        status=status,
        title=title,
        active_window_only=active_window_only,
        include_deleted=include_deleted,
        limit=limit,
        offset=offset,
    )
    if not habits:
        return []
    habit_ids = [habit.id for habit in habits]
    actions_stmt = select(HabitAction).where(HabitAction.habit_id.in_(habit_ids))
    if not include_deleted:
        actions_stmt = actions_stmt.where(HabitAction.deleted_at.is_(None))
    actions_stmt = actions_stmt.order_by(HabitAction.action_date.asc())
    actions = list((await session.execute(actions_stmt)).scalars())
    action_map: dict[UUID, list[HabitAction]] = {habit_id: [] for habit_id in habit_ids}
    for action in actions:
        action_map.setdefault(action.habit_id, []).append(action)
    return [
        {"habit": habit, "stats": build_habit_stats_payload(habit, action_map.get(habit.id, []))}
        for habit in habits
    ]


async def get_habit_task_associations(session: AsyncSession) -> dict[UUID, list[Habit]]:
    """Return task-to-habits mappings for non-deleted habits and tasks."""
    await refresh_habit_expiration(session)
    stmt = (
        select(Habit)
        .join(Task, Habit.task_id == Task.id)
        .where(
            Habit.deleted_at.is_(None),
            Habit.task_id.is_not(None),
            Task.deleted_at.is_(None),
        )
        .options(selectinload(Habit.task))
        .order_by(Habit.created_at.desc())
    )
    habits = list((await session.execute(stmt)).scalars())
    associations: dict[UUID, list[Habit]] = {}
    for habit in habits:
        if habit.task_id is None:
            continue
        associations.setdefault(habit.task_id, []).append(habit)
    return associations


async def list_habit_actions(
    session: AsyncSession,
    *,
    habit_id: UUID | None = None,
    status: str | None = None,
    action_date: date | None = None,
    center_date: date | None = None,
    days_before: int | None = None,
    days_after: int | None = None,
    include_deleted: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[HabitAction]:
    """List habit actions with optional habit, status, and date filters."""
    stmt = select(HabitAction).options(selectinload(HabitAction.habit))
    stmt = await _apply_habit_action_filters(
        session,
        stmt,
        habit_id=habit_id,
        status=status,
        action_date=action_date,
        center_date=center_date,
        days_before=days_before,
        days_after=days_after,
        include_deleted=include_deleted,
    )
    stmt = stmt.order_by(HabitAction.action_date.asc(), HabitAction.id.asc())
    stmt = stmt.offset(offset).limit(limit)
    return list((await session.execute(stmt)).scalars())


async def count_habit_actions(
    session: AsyncSession,
    *,
    habit_id: UUID | None = None,
    status: str | None = None,
    action_date: date | None = None,
    center_date: date | None = None,
    days_before: int | None = None,
    days_after: int | None = None,
    include_deleted: bool = False,
) -> int:
    """Count habit actions with the same filters used by list_habit_actions."""
    stmt = select(func.count()).select_from(HabitAction)
    stmt = await _apply_habit_action_filters(
        session,
        stmt,
        habit_id=habit_id,
        status=status,
        action_date=action_date,
        center_date=center_date,
        days_before=days_before,
        days_after=days_after,
        include_deleted=include_deleted,
    )
    return int((await session.execute(stmt)).scalar_one())


async def get_habit_action(
    session: AsyncSession,
    *,
    action_id: UUID,
    include_deleted: bool = False,
) -> HabitAction | None:
    """Load one habit action with its parent habit."""
    stmt = (
        select(HabitAction)
        .where(HabitAction.id == action_id)
        .options(selectinload(HabitAction.habit))
        .limit(1)
    )
    if not include_deleted:
        stmt = stmt.where(HabitAction.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()


async def _load_active_actions(session: AsyncSession, habit: Habit) -> list[HabitAction]:
    stmt = select(HabitAction).where(
        HabitAction.habit_id == habit.id,
        HabitAction.deleted_at.is_(None),
    )
    return list((await session.execute(stmt)).scalars())


async def _load_actions_for_overview(
    session: AsyncSession,
    *,
    habit_id: UUID,
    include_deleted: bool,
) -> list[HabitAction]:
    stmt = select(HabitAction).where(HabitAction.habit_id == habit_id)
    if not include_deleted:
        stmt = stmt.where(HabitAction.deleted_at.is_(None))
    stmt = stmt.order_by(HabitAction.action_date.asc())
    return list((await session.execute(stmt)).scalars())
