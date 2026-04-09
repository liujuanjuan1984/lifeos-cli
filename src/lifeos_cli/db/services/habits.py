"""Async CRUD and overview helpers for habits."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos_cli.db.base import utc_now
from lifeos_cli.db.models.habit import Habit
from lifeos_cli.db.models.habit_action import HabitAction
from lifeos_cli.db.services.batching import BatchDeleteResult
from lifeos_cli.db.services.habit_support import (
    DEFAULT_HABIT_ACTION_WINDOW_DAYS,
    HABIT_ACTION_STATUS_CONFIG,
    HABIT_EDITABLE_DAYS,
    MAX_HABIT_ACTION_WINDOW_DAYS,
    HabitActionNotFoundError,
    HabitNotFoundError,
    HabitTaskReferenceNotFoundError,
    HabitValidationError,
    InvalidHabitOperationError,
    build_habit_stats_payload,
    deduplicate_habit_ids,
    ensure_active_capacity,
    ensure_task_exists,
    get_default_habit_action_status,
    refresh_habit_expiration,
    validate_habit_action_status,
    validate_habit_duration,
    validate_habit_start_date,
    validate_habit_status,
)
from lifeos_cli.time_preferences import get_operational_date


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


async def create_habit(
    session: AsyncSession,
    *,
    title: str,
    description: str | None = None,
    start_date: date,
    duration_days: int,
    task_id: UUID | None = None,
) -> Habit:
    """Create a new habit and generate its dated action rows."""
    normalized_title = title.strip()
    validate_habit_start_date(start_date)
    validate_habit_duration(duration_days)
    await ensure_active_capacity(session)
    await ensure_task_exists(session, task_id)
    habit = Habit(
        title=normalized_title,
        description=description,
        start_date=start_date,
        duration_days=duration_days,
        status="active",
        task_id=task_id,
    )
    session.add(habit)
    await session.flush()
    await _generate_habit_actions(session, habit)
    await refresh_habit_expiration(session, habit_id=habit.id)
    await session.refresh(habit)
    return habit


async def update_habit(
    session: AsyncSession,
    *,
    habit_id: UUID,
    title: str | None = None,
    description: str | None = None,
    clear_description: bool = False,
    start_date: date | None = None,
    duration_days: int | None = None,
    status: str | None = None,
    task_id: UUID | None = None,
    clear_task: bool = False,
) -> Habit:
    """Update a habit and adjust generated actions when timing changes."""
    habit = await get_habit(session, habit_id=habit_id, include_deleted=False)
    if habit is None:
        raise HabitNotFoundError(f"Habit {habit_id} was not found")

    old_start_date = habit.start_date
    old_duration = habit.duration_days
    start_date_changed = False
    duration_changed = False

    if title is not None:
        habit.title = title.strip()
    if clear_description:
        habit.description = None
    elif description is not None:
        habit.description = description
    if start_date is not None:
        validate_habit_start_date(start_date)
        habit.start_date = start_date
        start_date_changed = start_date != old_start_date
    if duration_days is not None:
        habit.duration_days = validate_habit_duration(duration_days)
        duration_changed = duration_days != old_duration
    if clear_task:
        habit.task_id = None
    elif task_id is not None:
        await ensure_task_exists(session, task_id)
        habit.task_id = task_id
    if status is not None:
        normalized_status = validate_habit_status(status)
        if normalized_status == "active" and habit.status != "active":
            await ensure_active_capacity(session, exclude_habit_id=habit.id)
        habit.status = normalized_status

    if start_date_changed and duration_changed:
        await _adjust_actions_for_both_changes(session, habit)
    elif start_date_changed:
        await _adjust_actions_for_start_change(session, habit)
    elif duration_changed:
        await _adjust_actions_for_duration_change(session, habit, old_duration=old_duration)

    await session.flush()
    await refresh_habit_expiration(session, habit_id=habit.id)
    await session.refresh(habit)
    return habit


async def delete_habit(session: AsyncSession, *, habit_id: UUID) -> None:
    """Soft-delete a habit."""
    habit = await get_habit(session, habit_id=habit_id, include_deleted=False)
    if habit is None:
        raise HabitNotFoundError(f"Habit {habit_id} was not found")
    habit.soft_delete()
    await session.flush()


async def batch_delete_habits(
    session: AsyncSession,
    *,
    habit_ids: list[UUID],
) -> BatchDeleteResult:
    """Soft-delete multiple habits."""
    deleted_count = 0
    failed_ids: list[UUID] = []
    errors: list[str] = []

    for habit_id in deduplicate_habit_ids(habit_ids):
        try:
            await delete_habit(session, habit_id=habit_id)
            deleted_count += 1
        except HabitNotFoundError as exc:
            failed_ids.append(habit_id)
            errors.append(str(exc))

    return BatchDeleteResult(
        deleted_count=deleted_count,
        failed_ids=tuple(failed_ids),
        errors=tuple(errors),
    )


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


async def update_habit_action(
    session: AsyncSession,
    *,
    action_id: UUID,
    status: str | None = None,
    notes: str | None = None,
    clear_notes: bool = False,
) -> HabitAction:
    """Update one habit action within the editable window."""
    action = await get_habit_action(session, action_id=action_id, include_deleted=False)
    if action is None:
        raise HabitActionNotFoundError(f"Habit action {action_id} was not found")
    today = get_operational_date()
    if action.action_date > today or (today - action.action_date).days > HABIT_EDITABLE_DAYS:
        raise InvalidHabitOperationError(
            "Habit action cannot be modified outside the allowed time window"
        )
    if status is not None:
        action.status = validate_habit_action_status(status)
    if clear_notes:
        action.notes = None
    elif notes is not None:
        action.notes = notes
    await session.flush()
    await session.refresh(action)
    return action


async def _generate_habit_actions(session: AsyncSession, habit: Habit) -> None:
    current_date = habit.start_date
    while current_date <= habit.end_date:
        session.add(
            HabitAction(
                habit_id=habit.id,
                action_date=current_date,
                status=get_default_habit_action_status(),
            )
        )
        current_date += timedelta(days=1)
    await session.flush()


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


async def _adjust_actions_for_duration_change(
    session: AsyncSession,
    habit: Habit,
    *,
    old_duration: int,
) -> None:
    new_end_date = habit.end_date
    old_end_date = habit.start_date + timedelta(days=old_duration - 1)
    if habit.duration_days > old_duration:
        current_date = old_end_date + timedelta(days=1)
        while current_date <= new_end_date:
            exists = (
                await session.execute(
                    select(HabitAction.id).where(
                        HabitAction.habit_id == habit.id,
                        HabitAction.action_date == current_date,
                        HabitAction.deleted_at.is_(None),
                    )
                )
            ).scalar_one_or_none()
            if exists is None:
                session.add(
                    HabitAction(
                        habit_id=habit.id,
                        action_date=current_date,
                        status=get_default_habit_action_status(),
                    )
                )
            current_date += timedelta(days=1)
    else:
        cutoff_date = habit.start_date + timedelta(days=habit.duration_days - 1)
        actions = list(
            (
                await session.execute(
                    select(HabitAction).where(
                        HabitAction.habit_id == habit.id,
                        HabitAction.action_date > cutoff_date,
                        HabitAction.deleted_at.is_(None),
                    )
                )
            ).scalars()
        )
        for action in actions:
            action.deleted_at = utc_now()
    await session.flush()


async def _adjust_actions_for_start_change(session: AsyncSession, habit: Habit) -> None:
    desired_dates: set[date] = set()
    current_date = habit.start_date
    while current_date <= habit.end_date:
        desired_dates.add(current_date)
        current_date += timedelta(days=1)

    existing_actions = await _load_active_actions(session, habit)
    existing_by_date = {action.action_date: action for action in existing_actions}

    for action in existing_actions:
        if action.action_date not in desired_dates:
            action.deleted_at = utc_now()

    for desired_date in sorted(desired_dates):
        if desired_date not in existing_by_date:
            session.add(
                HabitAction(
                    habit_id=habit.id,
                    action_date=desired_date,
                    status=get_default_habit_action_status(),
                )
            )
    await session.flush()


async def _adjust_actions_for_both_changes(session: AsyncSession, habit: Habit) -> None:
    await _adjust_actions_for_start_change(session, habit)


__all__ = [
    "DEFAULT_HABIT_ACTION_WINDOW_DAYS",
    "HABIT_ACTION_STATUS_CONFIG",
    "HABIT_EDITABLE_DAYS",
    "MAX_HABIT_ACTION_WINDOW_DAYS",
    "HabitActionNotFoundError",
    "HabitNotFoundError",
    "HabitTaskReferenceNotFoundError",
    "HabitValidationError",
    "InvalidHabitOperationError",
    "batch_delete_habits",
    "create_habit",
    "delete_habit",
    "get_habit",
    "get_habit_action",
    "get_habit_overview",
    "get_habit_stats",
    "get_habit_task_associations",
    "list_habit_actions",
    "list_habit_overviews",
    "list_habits",
    "update_habit",
    "update_habit_action",
    "validate_habit_action_status",
    "validate_habit_status",
]
