"""Task service facade with split query and mutation helpers."""

from __future__ import annotations

from lifeos_cli.db.services.task_effort import (
    recompute_subtree_totals,
    recompute_task_effort_after_timelog_change,
    recompute_task_self_minutes,
    recompute_totals_upwards,
)
from lifeos_cli.db.services.task_mutations import (
    batch_delete_tasks,
    create_task,
    delete_task,
    update_task,
)
from lifeos_cli.db.services.task_queries import get_task, list_tasks
from lifeos_cli.db.services.task_support import (
    MAX_TASK_DEPTH,
    VALID_PLANNING_CYCLE_TYPES,
    VALID_TASK_STATUSES,
    InvalidPlanningCycleError,
    InvalidTaskDepthError,
    ParentTaskReferenceNotFoundError,
    TaskNotFoundError,
    VisionReferenceNotFoundError,
    validate_planning_cycle,
    validate_task_status,
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
    "InvalidPlanningCycleError",
    "InvalidTaskDepthError",
    "ParentTaskReferenceNotFoundError",
    "TaskNotFoundError",
    "VisionReferenceNotFoundError",
    "_deduplicate_task_ids",
    "_ensure_vision_exists",
    "_validate_parent_task",
    "batch_delete_tasks",
    "create_task",
    "delete_task",
    "get_task",
    "list_tasks",
    "recompute_subtree_totals",
    "recompute_task_effort_after_timelog_change",
    "recompute_task_self_minutes",
    "recompute_totals_upwards",
    "update_task",
    "validate_planning_cycle",
    "validate_task_status",
]
