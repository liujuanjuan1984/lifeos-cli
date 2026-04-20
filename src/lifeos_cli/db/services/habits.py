"""Habit service facade with split query and mutation helpers."""

from __future__ import annotations

from lifeos_cli.db.services.habit_mutations import (
    batch_delete_habits as batch_delete_habits,
)
from lifeos_cli.db.services.habit_mutations import (
    create_habit as create_habit,
)
from lifeos_cli.db.services.habit_mutations import (
    delete_habit as delete_habit,
)
from lifeos_cli.db.services.habit_mutations import (
    update_habit as update_habit,
)
from lifeos_cli.db.services.habit_mutations import (
    update_habit_action as update_habit_action,
)
from lifeos_cli.db.services.habit_mutations import (
    update_habit_action_by_date as update_habit_action_by_date,
)
from lifeos_cli.db.services.habit_queries import (
    count_habit_actions as count_habit_actions,
)
from lifeos_cli.db.services.habit_queries import (
    count_habits as count_habits,
)
from lifeos_cli.db.services.habit_queries import (
    get_habit as get_habit,
)
from lifeos_cli.db.services.habit_queries import (
    get_habit_action as get_habit_action,
)
from lifeos_cli.db.services.habit_queries import (
    get_habit_overview as get_habit_overview,
)
from lifeos_cli.db.services.habit_queries import (
    get_habit_stats as get_habit_stats,
)
from lifeos_cli.db.services.habit_queries import (
    get_habit_task_associations as get_habit_task_associations,
)
from lifeos_cli.db.services.habit_queries import (
    list_habit_actions as list_habit_actions,
)
from lifeos_cli.db.services.habit_queries import (
    list_habit_actions_in_range as list_habit_actions_in_range,
)
from lifeos_cli.db.services.habit_queries import (
    list_habit_overviews as list_habit_overviews,
)
from lifeos_cli.db.services.habit_queries import (
    list_habits as list_habits,
)
from lifeos_cli.db.services.habit_support import (
    DEFAULT_HABIT_ACTION_WINDOW_DAYS as DEFAULT_HABIT_ACTION_WINDOW_DAYS,
)
from lifeos_cli.db.services.habit_support import (
    HABIT_ACTION_STATUS_CONFIG as HABIT_ACTION_STATUS_CONFIG,
)
from lifeos_cli.db.services.habit_support import (
    HABIT_EDITABLE_DAYS as HABIT_EDITABLE_DAYS,
)
from lifeos_cli.db.services.habit_support import (
    MAX_HABIT_ACTION_WINDOW_DAYS as MAX_HABIT_ACTION_WINDOW_DAYS,
)
from lifeos_cli.db.services.habit_support import (
    HabitActionNotFoundError as HabitActionNotFoundError,
)
from lifeos_cli.db.services.habit_support import (
    HabitNotFoundError as HabitNotFoundError,
)
from lifeos_cli.db.services.habit_support import (
    HabitTaskReferenceNotFoundError as HabitTaskReferenceNotFoundError,
)
from lifeos_cli.db.services.habit_support import (
    HabitValidationError as HabitValidationError,
)
from lifeos_cli.db.services.habit_support import (
    InvalidHabitOperationError as InvalidHabitOperationError,
)
from lifeos_cli.db.services.habit_support import (
    validate_habit_action_status as validate_habit_action_status,
)
from lifeos_cli.db.services.habit_support import (
    validate_habit_status as validate_habit_status,
)
