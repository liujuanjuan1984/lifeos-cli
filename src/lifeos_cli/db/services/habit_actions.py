"""Facade exports for habit-action service functions."""

from __future__ import annotations

from lifeos_cli.db.services.habit_mutations import update_habit_action
from lifeos_cli.db.services.habit_queries import (
    count_habit_actions,
    get_habit_action,
    list_habit_actions,
)
from lifeos_cli.db.services.habit_support import (
    DEFAULT_HABIT_ACTION_WINDOW_DAYS,
    HABIT_EDITABLE_DAYS,
    MAX_HABIT_ACTION_WINDOW_DAYS,
    VALID_HABIT_ACTION_STATUSES,
    HabitActionNotFoundError,
    HabitNotFoundError,
    HabitValidationError,
    InvalidHabitOperationError,
    validate_habit_action_status,
)

__all__ = [
    "DEFAULT_HABIT_ACTION_WINDOW_DAYS",
    "HABIT_EDITABLE_DAYS",
    "MAX_HABIT_ACTION_WINDOW_DAYS",
    "HabitActionNotFoundError",
    "HabitNotFoundError",
    "HabitValidationError",
    "InvalidHabitOperationError",
    "VALID_HABIT_ACTION_STATUSES",
    "count_habit_actions",
    "get_habit_action",
    "list_habit_actions",
    "update_habit_action",
    "validate_habit_action_status",
]
