"""Task service facade with split query and mutation helpers."""

from __future__ import annotations

from lifeos_cli.db.services.task_effort import (
    recompute_subtree_totals,
    recompute_task_effort_after_timelog_change,
    recompute_task_self_minutes,
    recompute_totals_upwards,
)
from lifeos_cli.db.services.task_mutations import (
    TaskMoveResult,
    batch_delete_tasks,
    create_task,
    delete_task,
    move_task,
    reorder_tasks,
    update_task,
)
from lifeos_cli.db.services.task_queries import (
    TaskHierarchy,
    TaskStats,
    TaskWithSubtasks,
    get_task,
    get_task_stats,
    get_task_with_subtasks,
    get_vision_task_hierarchy,
    list_tasks,
)
from lifeos_cli.db.services.task_support import (
    MAX_TASK_DEPTH,
    VALID_PLANNING_CYCLE_TYPES,
    VALID_TASK_STATUSES,
    CircularTaskReferenceError,
    InvalidPlanningCycleError,
    InvalidTaskDepthError,
    InvalidTaskOperationError,
    ParentTaskReferenceNotFoundError,
    TaskCannotBeCompletedError,
    TaskNotFoundError,
    VisionReferenceNotFoundError,
    load_task_subtree,
    validate_planning_cycle,
    validate_task_status,
    validate_task_status_change,
)
from lifeos_cli.db.services.task_support import (
    deduplicate_task_ids as _deduplicate_task_ids,
)
from lifeos_cli.db.services.task_support import (
    ensure_vision_exists as _ensure_vision_exists,
)
from lifeos_cli.db.services.task_support import (
    validate_parent_task as _validate_parent_task,
)

__all__ = [
    "MAX_TASK_DEPTH",
    "VALID_PLANNING_CYCLE_TYPES",
    "VALID_TASK_STATUSES",
    "CircularTaskReferenceError",
    "InvalidPlanningCycleError",
    "InvalidTaskDepthError",
    "InvalidTaskOperationError",
    "ParentTaskReferenceNotFoundError",
    "TaskCannotBeCompletedError",
    "TaskHierarchy",
    "TaskNotFoundError",
    "TaskStats",
    "TaskWithSubtasks",
    "TaskMoveResult",
    "VisionReferenceNotFoundError",
    "_deduplicate_task_ids",
    "_ensure_vision_exists",
    "_validate_parent_task",
    "batch_delete_tasks",
    "create_task",
    "delete_task",
    "get_task",
    "get_task_stats",
    "get_task_with_subtasks",
    "get_vision_task_hierarchy",
    "list_tasks",
    "move_task",
    "reorder_tasks",
    "recompute_subtree_totals",
    "recompute_task_effort_after_timelog_change",
    "recompute_task_self_minutes",
    "recompute_totals_upwards",
    "update_task",
    "load_task_subtree",
    "validate_planning_cycle",
    "validate_task_status_change",
    "validate_task_status",
]
