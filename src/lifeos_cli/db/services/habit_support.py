"""Support constants and helpers for habit services."""

from __future__ import annotations

from datetime import date, timedelta
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.application.time_preferences import get_current_week_bounds, get_operational_date
from lifeos_cli.db.base import utc_now

if TYPE_CHECKING:
    from lifeos_cli.db.models.habit import Habit
    from lifeos_cli.db.models.habit_action import HabitAction

VALID_HABIT_STATUSES = {"active", "completed", "paused", "expired"}
HABIT_ACTION_STATUS_CONFIG = {
    "pending": {
        "display_name": "Pending",
        "default_for_new": True,
        "manual_status": False,
        "count_as_completed": False,
    },
    "done": {
        "display_name": "Done",
        "default_for_new": False,
        "manual_status": True,
        "count_as_completed": True,
    },
    "skip": {
        "display_name": "Skip",
        "default_for_new": False,
        "manual_status": True,
        "count_as_completed": False,
    },
    "miss": {
        "display_name": "Miss",
        "default_for_new": False,
        "manual_status": True,
        "count_as_completed": False,
    },
}
VALID_HABIT_ACTION_STATUSES = set(HABIT_ACTION_STATUS_CONFIG)
HABIT_DURATION_OPTIONS = {7, 14, 21, 100, 365, 1000}
HABIT_EDITABLE_DAYS = 10000
MAX_ACTIVE_HABITS = 99
DEFAULT_HABIT_ACTION_WINDOW_DAYS = 5
MAX_HABIT_ACTION_WINDOW_DAYS = 100


class HabitNotFoundError(LookupError):
    """Raised when a habit cannot be found."""


class HabitActionNotFoundError(LookupError):
    """Raised when a habit action cannot be found."""


class HabitTaskReferenceNotFoundError(LookupError):
    """Raised when a referenced task cannot be found."""


class HabitValidationError(ValueError):
    """Raised when habit input validation fails."""


class InvalidHabitOperationError(ValueError):
    """Raised when a habit operation is not allowed."""


def deduplicate_habit_ids(habit_ids: list[UUID]) -> list[UUID]:
    """Return habit identifiers without duplicates while keeping input order."""
    return list(dict.fromkeys(habit_ids))


def get_default_habit_action_status() -> str:
    """Return the configured default status for newly generated actions."""
    for status, config in HABIT_ACTION_STATUS_CONFIG.items():
        if config["default_for_new"]:
            return status
    raise HabitValidationError("No default habit action status is configured")


def validate_habit_status(status: str) -> str:
    """Validate and normalize a habit status."""
    normalized = status.strip().lower()
    if normalized not in VALID_HABIT_STATUSES:
        allowed = ", ".join(sorted(VALID_HABIT_STATUSES))
        raise HabitValidationError(
            f"Invalid habit status {normalized!r}. Expected one of: {allowed}"
        )
    return normalized


def validate_habit_action_status(status: str) -> str:
    """Validate and normalize a habit-action status."""
    normalized = status.strip().lower()
    if normalized not in VALID_HABIT_ACTION_STATUSES:
        allowed = ", ".join(sorted(VALID_HABIT_ACTION_STATUSES))
        raise HabitValidationError(
            f"Invalid habit-action status {normalized!r}. Expected one of: {allowed}"
        )
    return normalized


def validate_habit_duration(duration_days: int) -> int:
    """Validate habit duration options."""
    if duration_days not in HABIT_DURATION_OPTIONS:
        allowed = ", ".join(str(value) for value in sorted(HABIT_DURATION_OPTIONS))
        raise HabitValidationError(
            f"Invalid duration_days {duration_days!r}. Expected one of: {allowed}"
        )
    return duration_days


def validate_habit_start_date(start_date: date) -> date:
    """Validate that a habit does not begin too far in the past."""
    if start_date < get_operational_date() - timedelta(days=HABIT_EDITABLE_DAYS):
        raise HabitValidationError(
            f"Start date cannot be more than {HABIT_EDITABLE_DAYS} days in the past"
        )
    return start_date


async def ensure_task_exists(session: AsyncSession, task_id: UUID | None) -> None:
    """Ensure an optional task reference exists."""
    from lifeos_cli.db.models.task import Task

    if task_id is None:
        return
    result = await session.execute(
        select(Task.id).where(Task.id == task_id, Task.deleted_at.is_(None)).limit(1)
    )
    if result.scalar_one_or_none() is None:
        raise HabitTaskReferenceNotFoundError(f"Task {task_id} was not found")


async def ensure_active_capacity(
    session: AsyncSession,
    *,
    exclude_habit_id: UUID | None = None,
) -> None:
    """Ensure the active habit cap has not been exceeded."""
    from lifeos_cli.db.models.habit import Habit

    local_today = get_operational_date()
    end_expr = Habit.start_date + (Habit.duration_days - 1) * text("INTERVAL '1 day'")
    filters = [
        Habit.deleted_at.is_(None),
        Habit.status == "active",
        end_expr >= local_today,
    ]
    if exclude_habit_id is not None:
        filters.append(Habit.id != exclude_habit_id)
    stmt = select(func.count()).where(*filters)
    active_count = (await session.execute(stmt)).scalar_one()
    if active_count >= MAX_ACTIVE_HABITS:
        raise InvalidHabitOperationError(
            f"You already have {MAX_ACTIVE_HABITS} active habits. Pause or complete one first."
        )


async def refresh_habit_expiration(
    session: AsyncSession,
    *,
    habit_id: UUID | None = None,
) -> int:
    """Mark active habits as expired when their end date is in the past."""
    from lifeos_cli.db.models.habit import Habit

    local_today = get_operational_date()
    end_expr = Habit.start_date + (Habit.duration_days - 1) * text("INTERVAL '1 day'")
    filters = [
        Habit.deleted_at.is_(None),
        Habit.status == "active",
        end_expr < local_today,
    ]
    if habit_id is not None:
        filters.append(Habit.id == habit_id)
    stmt = update(Habit).where(*filters).values(status="expired", updated_at=utc_now())
    result = await session.execute(stmt)
    rowcount = getattr(result, "rowcount", 0)
    return int(0 if rowcount is None else rowcount)


def build_habit_stats_payload(habit: Habit, actions: list[HabitAction]) -> dict[str, object]:
    """Build stats shared by overview, show, and stats commands."""
    current_week_start, current_week_end = get_current_week_bounds()
    total_actions = len(actions)
    completed_actions = len(
        [
            action
            for action in actions
            if HABIT_ACTION_STATUS_CONFIG.get(action.status, {}).get("count_as_completed", False)
        ]
    )
    missed_actions = len([action for action in actions if action.status == "miss"])
    skipped_actions = len([action for action in actions if action.status == "skip"])
    progress_percentage = (completed_actions / total_actions) * 100 if total_actions else 0.0
    return {
        "habit_id": habit.id,
        "total_actions": total_actions,
        "completed_actions": completed_actions,
        "missed_actions": missed_actions,
        "skipped_actions": skipped_actions,
        "progress_percentage": progress_percentage,
        "current_streak": calculate_current_streak(actions),
        "longest_streak": calculate_longest_streak(actions),
        "current_week_start": current_week_start,
        "current_week_end": current_week_end,
    }


def calculate_current_streak(actions: list[HabitAction]) -> int:
    """Return the current streak of completed actions."""
    streak = 0
    today = get_operational_date()
    for action in sorted(actions, key=lambda row: row.action_date, reverse=True):
        if action.action_date > today:
            continue
        if action.status == "done":
            streak += 1
            continue
        break
    return streak


def calculate_longest_streak(actions: list[HabitAction]) -> int:
    """Return the longest historical streak of completed actions."""
    max_streak = 0
    current_streak = 0
    for action in sorted(actions, key=lambda row: row.action_date):
        if action.status == "done":
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 0
    return max_streak
