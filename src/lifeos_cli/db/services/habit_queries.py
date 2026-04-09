"""Query helpers for habits and habit actions."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos_cli.application.time_preferences import get_operational_date
from lifeos_cli.db.models.habit import Habit
from lifeos_cli.db.models.habit_action import HabitAction
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
    stmt = stmt.order_by(Habit.created_at.desc(), Habit.id.desc()).offset(offset).limit(limit)
    return list((await session.execute(stmt)).scalars())


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
    """Return task-to-habits mappings for active, non-deleted habits."""
    await refresh_habit_expiration(session)
    stmt = (
        select(Habit)
        .where(
            Habit.deleted_at.is_(None),
            Habit.task_id.is_not(None),
            Habit.status == "active",
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
        use_window = any(value is not None for value in (center_date, days_before, days_after))
        if use_window:
            reference_date = center_date or get_operational_date()
            window_before = (
                days_before if days_before is not None else DEFAULT_HABIT_ACTION_WINDOW_DAYS
            )
            window_after = days_after if days_after is not None else window_before
            if window_before < 0 or window_after < 0:
                raise HabitValidationError("days_before and days_after must be non-negative")
            if window_before + window_after + 1 > MAX_HABIT_ACTION_WINDOW_DAYS:
                raise HabitValidationError(
                    "The requested action window is larger than the allowed maximum"
                )
            start = reference_date - timedelta(days=window_before)
            end = reference_date + timedelta(days=window_after)
            stmt = stmt.where(HabitAction.action_date >= start, HabitAction.action_date <= end)
    stmt = stmt.order_by(HabitAction.action_date.asc(), HabitAction.id.asc())
    stmt = stmt.offset(offset).limit(limit)
    return list((await session.execute(stmt)).scalars())


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
