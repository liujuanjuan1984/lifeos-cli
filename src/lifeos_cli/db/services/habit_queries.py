"""Query helpers for habits and sparse habit-action occurrences."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, cast
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
    HabitActionLike,
    HabitActionNotFoundError,
    HabitNotFoundError,
    HabitValidationError,
    build_habit_stats_payload,
    habit_occurs_on_date,
    refresh_habit_expiration,
    validate_habit_action_status,
    validate_habit_status,
)
from lifeos_cli.db.services.read_models import HabitActionView


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
        return action_date, action_date
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


def _habit_end_expr() -> Any:
    return Habit.start_date + (Habit.duration_days - 1) * text("INTERVAL '1 day'")


def _build_materialized_action_view(
    action: HabitAction,
    *,
    habit_title: str,
) -> HabitActionView:
    return HabitActionView(
        id=action.id,
        habit_id=action.habit_id,
        habit_title=habit_title,
        action_date=action.action_date,
        status=action.status,
        notes=action.notes,
        created_at=action.created_at,
        updated_at=action.updated_at,
        deleted_at=action.deleted_at,
    )


def _build_synthetic_action_view(
    *,
    habit: Habit,
    action_date: date,
) -> HabitActionView:
    return HabitActionView(
        id=None,
        habit_id=habit.id,
        habit_title=habit.title,
        action_date=action_date,
        status="pending",
        notes=None,
        created_at=None,
        updated_at=None,
        deleted_at=None,
    )


async def _materialize_habit_action_for_date(
    session: AsyncSession,
    *,
    habit: Habit,
    action_date: date,
) -> HabitAction:
    """Create one materialized dated action for a scheduled occurrence."""
    if not habit_occurs_on_date(
        start_date=habit.start_date,
        end_date=habit.end_date,
        cadence_weekdays=habit.cadence_weekdays,
        target_date=action_date,
    ):
        raise HabitActionNotFoundError(
            f"Habit action for habit {habit.id} on {action_date} was not found"
        )
    action = HabitAction(
        habit_id=habit.id,
        action_date=action_date,
    )
    session.add(action)
    await session.flush()
    await session.refresh(action)
    return action


def _iter_habit_window_dates(
    *,
    habit: Habit,
    start_date: date,
    end_date: date,
) -> list[date]:
    effective_start = max(start_date, habit.start_date)
    effective_end = min(end_date, habit.end_date)
    if effective_end < effective_start:
        return []
    return [
        current_date
        for current_date in (
            effective_start + timedelta(days=offset)
            for offset in range((effective_end - effective_start).days + 1)
        )
        if habit_occurs_on_date(
            start_date=habit.start_date,
            end_date=habit.end_date,
            cadence_weekdays=habit.cadence_weekdays,
            target_date=current_date,
        )
    ]


async def _load_materialized_actions_for_habits(
    session: AsyncSession,
    *,
    habit_ids: list[UUID],
    start_date: date | None,
    end_date: date | None,
    include_deleted: bool,
) -> list[HabitAction]:
    if not habit_ids:
        return []
    stmt = select(HabitAction).where(HabitAction.habit_id.in_(habit_ids))
    if not include_deleted:
        stmt = stmt.where(HabitAction.deleted_at.is_(None))
    if start_date is not None:
        stmt = stmt.where(HabitAction.action_date >= start_date)
    if end_date is not None:
        stmt = stmt.where(HabitAction.action_date <= end_date)
    stmt = stmt.order_by(
        HabitAction.action_date.asc(),
        HabitAction.created_at.asc(),
        HabitAction.id.asc(),
    )
    return list((await session.execute(stmt)).scalars())


async def _load_candidate_habits(
    session: AsyncSession,
    *,
    habit_id: UUID | None,
    include_deleted: bool,
    action_window: tuple[date, date] | None,
) -> list[Habit]:
    if habit_id is not None:
        habit = await get_habit(session, habit_id=habit_id, include_deleted=include_deleted)
        if habit is None:
            raise HabitNotFoundError(f"Habit {habit_id} was not found")
        return [habit]

    stmt = select(Habit).options(selectinload(Habit.task))
    if not include_deleted:
        stmt = stmt.where(Habit.deleted_at.is_(None))
    if action_window is not None:
        start_date, end_date = action_window
        stmt = stmt.where(Habit.start_date <= end_date, _habit_end_expr() >= start_date)
    stmt = stmt.order_by(Habit.created_at.desc(), Habit.id.desc())
    return list((await session.execute(stmt)).scalars())


def _build_habit_occurrence_views(
    *,
    habit: Habit,
    materialized_actions: list[HabitAction],
    start_date: date,
    end_date: date,
    include_deleted: bool,
) -> list[HabitActionView]:
    active_actions_by_date = {
        action.action_date: action for action in materialized_actions if action.deleted_at is None
    }
    deleted_actions = [action for action in materialized_actions if action.deleted_at is not None]
    views: list[HabitActionView] = []

    for action_date in _iter_habit_window_dates(
        habit=habit,
        start_date=start_date,
        end_date=end_date,
    ):
        materialized = active_actions_by_date.get(action_date)
        if materialized is None:
            views.append(_build_synthetic_action_view(habit=habit, action_date=action_date))
            continue
        views.append(_build_materialized_action_view(materialized, habit_title=habit.title))

    if include_deleted:
        views.extend(
            _build_materialized_action_view(action, habit_title=habit.title)
            for action in deleted_actions
            if start_date <= action.action_date <= end_date
        )
    return views


def _filter_habit_action_views(
    views: list[HabitActionView],
    *,
    status: str | None,
) -> list[HabitActionView]:
    if status is None:
        return views
    normalized_status = validate_habit_action_status(status)
    return [view for view in views if view.status == normalized_status]


def _sort_habit_action_views(views: list[HabitActionView]) -> list[HabitActionView]:
    return sorted(
        views,
        key=lambda view: (
            view.action_date,
            view.habit_title,
            view.habit_id,
            view.id is None,
            str(view.id or view.habit_id),
        ),
    )


async def _build_habit_action_views(
    session: AsyncSession,
    *,
    habit_id: UUID | None,
    status: str | None,
    action_date: date | None,
    center_date: date | None,
    days_before: int | None,
    days_after: int | None,
    explicit_action_window: tuple[date, date] | None,
    include_deleted: bool,
) -> list[HabitActionView]:
    action_window = explicit_action_window or _resolve_habit_action_window(
        action_date=action_date,
        center_date=center_date,
        days_before=days_before,
        days_after=days_after,
    )
    habits = await _load_candidate_habits(
        session,
        habit_id=habit_id,
        include_deleted=include_deleted,
        action_window=action_window,
    )
    if not habits:
        return []

    habit_ids = [habit.id for habit in habits]
    if action_window is None:
        range_start = min(habit.start_date for habit in habits)
        range_end = max(habit.end_date for habit in habits)
    else:
        range_start, range_end = action_window

    materialized_actions = await _load_materialized_actions_for_habits(
        session,
        habit_ids=habit_ids,
        start_date=range_start,
        end_date=range_end,
        include_deleted=include_deleted,
    )
    actions_by_habit: dict[UUID, list[HabitAction]] = {habit_id: [] for habit_id in habit_ids}
    for action in materialized_actions:
        actions_by_habit.setdefault(action.habit_id, []).append(action)

    views: list[HabitActionView] = []
    for habit in habits:
        habit_start = range_start if action_window is None else action_window[0]
        habit_end = range_end if action_window is None else action_window[1]
        views.extend(
            _build_habit_occurrence_views(
                habit=habit,
                materialized_actions=actions_by_habit.get(habit.id, []),
                start_date=habit_start,
                end_date=habit_end,
                include_deleted=include_deleted,
            )
        )
    return _sort_habit_action_views(_filter_habit_action_views(views, status=status))


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
    actions = await _build_habit_action_views(
        session,
        habit_id=habit.id,
        status=None,
        action_date=None,
        center_date=None,
        days_before=None,
        days_after=None,
        explicit_action_window=None,
        include_deleted=False,
    )
    return build_habit_stats_payload(habit, cast(list[HabitActionLike], actions))


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
    actions = await _build_habit_action_views(
        session,
        habit_id=habit.id,
        status=None,
        action_date=None,
        center_date=None,
        days_before=None,
        days_after=None,
        explicit_action_window=None,
        include_deleted=False,
    )
    return {
        "habit": habit,
        "stats": build_habit_stats_payload(habit, cast(list[HabitActionLike], actions)),
    }


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
    overviews: list[dict[str, object]] = []
    for habit in habits:
        actions = await _build_habit_action_views(
            session,
            habit_id=habit.id,
            status=None,
            action_date=None,
            center_date=None,
            days_before=None,
            days_after=None,
            explicit_action_window=None,
            include_deleted=False,
        )
        overviews.append(
            {
                "habit": habit,
                "stats": build_habit_stats_payload(habit, cast(list[HabitActionLike], actions)),
            }
        )
    return overviews


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
) -> list[HabitActionView]:
    """List habit-action occurrence views with optional filters."""
    views = await _build_habit_action_views(
        session,
        habit_id=habit_id,
        status=status,
        action_date=action_date,
        center_date=center_date,
        days_before=days_before,
        days_after=days_after,
        explicit_action_window=None,
        include_deleted=include_deleted,
    )
    paged_views = views[offset : offset + limit]
    synthetic_views = [view for view in paged_views if view.id is None]
    if not synthetic_views or include_deleted:
        return paged_views

    habit_ids = {view.habit_id for view in synthetic_views}
    habits = list(
        (
            await session.execute(
                select(Habit).where(Habit.id.in_(habit_ids), Habit.deleted_at.is_(None))
            )
        ).scalars()
    )
    habits_by_id = {habit.id: habit for habit in habits}
    materialized_by_key: dict[tuple[UUID, date], HabitActionView] = {}
    for view in synthetic_views:
        habit = habits_by_id.get(view.habit_id)
        if habit is None:
            continue
        action = await _materialize_habit_action_for_date(
            session,
            habit=habit,
            action_date=view.action_date,
        )
        materialized_by_key[(view.habit_id, view.action_date)] = _build_materialized_action_view(
            action,
            habit_title=habit.title,
        )

    return [
        materialized_by_key.get((view.habit_id, view.action_date), view) for view in paged_views
    ]


async def list_habit_actions_in_range(
    session: AsyncSession,
    *,
    start_date: date,
    end_date: date,
    include_deleted: bool = False,
) -> list[HabitActionView]:
    """List habit-action occurrence views for an explicit inclusive date range."""
    if end_date < start_date:
        raise HabitValidationError("end_date must be on or after start_date")
    views = await _build_habit_action_views(
        session,
        habit_id=None,
        status=None,
        action_date=None,
        center_date=None,
        days_before=None,
        days_after=None,
        explicit_action_window=(start_date, end_date),
        include_deleted=include_deleted,
    )
    return [view for view in views if start_date <= view.action_date <= end_date]


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
    """Count habit-action occurrence views with the same filters used by list_habit_actions."""
    views = await _build_habit_action_views(
        session,
        habit_id=habit_id,
        status=status,
        action_date=action_date,
        center_date=center_date,
        days_before=days_before,
        days_after=days_after,
        explicit_action_window=None,
        include_deleted=include_deleted,
    )
    return len(views)


async def get_habit_action(
    session: AsyncSession,
    *,
    action_id: UUID,
    include_deleted: bool = False,
) -> HabitAction | None:
    """Load one materialized habit action with its parent habit."""
    stmt = (
        select(HabitAction)
        .where(HabitAction.id == action_id)
        .options(selectinload(HabitAction.habit))
        .limit(1)
    )
    if not include_deleted:
        stmt = stmt.where(HabitAction.deleted_at.is_(None))
    return (await session.execute(stmt)).scalar_one_or_none()
