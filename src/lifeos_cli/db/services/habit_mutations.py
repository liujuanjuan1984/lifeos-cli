"""Mutation helpers for habits and habit actions."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.application.time_preferences import get_operational_date
from lifeos_cli.db.base import utc_now
from lifeos_cli.db.models.habit import Habit
from lifeos_cli.db.models.habit_action import HabitAction
from lifeos_cli.db.services.batching import BatchDeleteResult, batch_delete_records
from lifeos_cli.db.services.habit_queries import get_habit, get_habit_action
from lifeos_cli.db.services.habit_support import (
    HABIT_EDITABLE_DAYS,
    HabitActionNotFoundError,
    HabitNotFoundError,
    InvalidHabitOperationError,
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
    return await batch_delete_records(
        identifiers=deduplicate_habit_ids(habit_ids),
        delete_record=lambda habit_id: delete_habit(session, habit_id=habit_id),
        handled_exceptions=(HabitNotFoundError,),
    )


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


async def update_habit_action_by_date(
    session: AsyncSession,
    *,
    habit_id: UUID,
    action_date: date,
    status: str | None = None,
    notes: str | None = None,
    clear_notes: bool = False,
) -> HabitAction:
    """Update one habit action by habit and action date."""
    habit = await get_habit(session, habit_id=habit_id, include_deleted=False)
    if habit is None:
        raise HabitNotFoundError(f"Habit {habit_id} was not found")
    action = (
        await session.execute(
            select(HabitAction).where(
                HabitAction.habit_id == habit_id,
                HabitAction.action_date == action_date,
                HabitAction.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if action is None:
        raise HabitActionNotFoundError(
            f"Habit action for habit {habit_id} on {action_date} was not found"
        )
    return await update_habit_action(
        session,
        action_id=action.id,
        status=status,
        notes=notes,
        clear_notes=clear_notes,
    )


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


async def _load_active_actions(session: AsyncSession, habit: Habit) -> list[HabitAction]:
    stmt = select(HabitAction).where(
        HabitAction.habit_id == habit.id,
        HabitAction.deleted_at.is_(None),
    )
    return list((await session.execute(stmt)).scalars())
