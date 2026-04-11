"""Read-side helpers for CLI schedule views."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from lifeos_cli.application.time_preferences import get_utc_window_for_local_date
from lifeos_cli.db.models.habit_action import HabitAction
from lifeos_cli.db.models.task import Task
from lifeos_cli.db.services.events import EventOccurrence, list_event_occurrences


@dataclass(frozen=True)
class ScheduleTaskItem:
    """Task item included in a schedule day."""

    id: UUID
    content: str
    status: str
    planning_cycle_type: str
    planning_cycle_days: int
    planning_cycle_start_date: date
    planning_cycle_end_date: date


@dataclass(frozen=True)
class ScheduleHabitActionItem:
    """Habit-action item included in a schedule day."""

    id: UUID
    habit_id: UUID
    habit_title: str
    action_date: date
    status: str
    notes: str | None


@dataclass(frozen=True)
class ScheduleEventItem:
    """Event item included in a schedule day."""

    id: UUID
    title: str
    status: str
    start_time: datetime
    end_time: datetime | None
    task_id: UUID | None


@dataclass(frozen=True)
class ScheduleDay:
    """Aggregated schedule view for one local date."""

    local_date: date
    tasks: tuple[ScheduleTaskItem, ...]
    habit_actions: tuple[ScheduleHabitActionItem, ...]
    events: tuple[ScheduleEventItem, ...]


def _iter_date_range(start_date: date, end_date: date) -> list[date]:
    day_count = (end_date - start_date).days + 1
    return [start_date + timedelta(days=offset) for offset in range(day_count)]


def _normalize_schedule_range(*, start_date: date, end_date: date) -> tuple[date, date]:
    if end_date < start_date:
        raise ValueError("end_date must be on or after start_date")
    return start_date, end_date


def _task_cycle_end_date(task: Task) -> date:
    assert task.planning_cycle_start_date is not None
    assert task.planning_cycle_days is not None
    return task.planning_cycle_start_date + timedelta(days=task.planning_cycle_days - 1)


async def _load_schedule_tasks(
    session: AsyncSession,
    *,
    start_date: date,
    end_date: date,
) -> list[Task]:
    stmt = (
        select(Task)
        .where(
            Task.deleted_at.is_(None),
            Task.planning_cycle_start_date.is_not(None),
            Task.planning_cycle_days.is_not(None),
            Task.planning_cycle_type.is_not(None),
            Task.planning_cycle_start_date <= end_date,
            Task.planning_cycle_start_date
            + (Task.planning_cycle_days - 1) * text("INTERVAL '1 day'")
            >= start_date,
        )
        .order_by(Task.planning_cycle_start_date.asc(), Task.display_order.asc(), Task.id.asc())
    )
    return list((await session.execute(stmt)).scalars())


async def _load_schedule_habit_actions(
    session: AsyncSession,
    *,
    start_date: date,
    end_date: date,
) -> list[HabitAction]:
    stmt = (
        select(HabitAction)
        .options(selectinload(HabitAction.habit))
        .where(
            HabitAction.deleted_at.is_(None),
            HabitAction.action_date >= start_date,
            HabitAction.action_date <= end_date,
        )
        .order_by(HabitAction.action_date.asc(), HabitAction.id.asc())
    )
    return list((await session.execute(stmt)).scalars())


async def _load_schedule_events(
    session: AsyncSession,
    *,
    start_date: date,
    end_date: date,
) -> list[EventOccurrence]:
    range_window_start, _ = get_utc_window_for_local_date(start_date)
    _, range_window_end_exclusive = get_utc_window_for_local_date(end_date)
    range_window_end = range_window_end_exclusive - timedelta(microseconds=1)
    return await list_event_occurrences(
        session,
        window_start=range_window_start,
        window_end=range_window_end,
    )


def _map_task_item(task: Task) -> ScheduleTaskItem:
    assert task.planning_cycle_type is not None
    assert task.planning_cycle_days is not None
    assert task.planning_cycle_start_date is not None
    return ScheduleTaskItem(
        id=task.id,
        content=task.content,
        status=task.status,
        planning_cycle_type=task.planning_cycle_type,
        planning_cycle_days=task.planning_cycle_days,
        planning_cycle_start_date=task.planning_cycle_start_date,
        planning_cycle_end_date=_task_cycle_end_date(task),
    )


def _map_habit_action_item(action: HabitAction) -> ScheduleHabitActionItem:
    assert action.habit is not None
    return ScheduleHabitActionItem(
        id=action.id,
        habit_id=action.habit_id,
        habit_title=action.habit.title,
        action_date=action.action_date,
        status=action.status,
        notes=action.notes,
    )


def _map_event_item(event: EventOccurrence) -> ScheduleEventItem:
    return ScheduleEventItem(
        id=event.id,
        title=event.title,
        status=event.status,
        start_time=event.start_time,
        end_time=event.end_time,
        task_id=event.task_id,
    )


async def list_schedule_in_range(
    session: AsyncSession,
    *,
    start_date: date,
    end_date: date,
) -> list[ScheduleDay]:
    """Return a grouped schedule view for one local-date range."""
    start_date, end_date = _normalize_schedule_range(start_date=start_date, end_date=end_date)
    dates = _iter_date_range(start_date, end_date)
    tasks = await _load_schedule_tasks(session, start_date=start_date, end_date=end_date)
    habit_actions = await _load_schedule_habit_actions(
        session,
        start_date=start_date,
        end_date=end_date,
    )
    events = await _load_schedule_events(session, start_date=start_date, end_date=end_date)

    task_items = [_map_task_item(task) for task in tasks]
    action_items = [_map_habit_action_item(action) for action in habit_actions]
    event_items = [_map_event_item(event) for event in events]

    days: list[ScheduleDay] = []
    for current_date in dates:
        current_tasks = tuple(
            item
            for item in task_items
            if item.planning_cycle_start_date <= current_date <= item.planning_cycle_end_date
        )
        current_actions = tuple(item for item in action_items if item.action_date == current_date)
        (
            current_window_start,
            current_window_end_exclusive,
        ) = get_utc_window_for_local_date(current_date)
        current_window_end = current_window_end_exclusive - timedelta(microseconds=1)
        current_events = tuple(
            item
            for item in event_items
            if item.start_time <= current_window_end
            and (item.end_time is None or item.end_time >= current_window_start)
        )
        days.append(
            ScheduleDay(
                local_date=current_date,
                tasks=current_tasks,
                habit_actions=current_actions,
                events=current_events,
            )
        )
    return days


async def get_schedule_for_date(
    session: AsyncSession,
    *,
    target_date: date,
) -> ScheduleDay:
    """Return a grouped schedule view for one local date."""
    return (await list_schedule_in_range(session, start_date=target_date, end_date=target_date))[0]
