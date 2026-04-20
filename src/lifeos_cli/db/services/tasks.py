"""Task service facade with split query and mutation helpers."""

from __future__ import annotations

from lifeos_cli.db.services.task_effort import (
    recompute_subtree_totals as recompute_subtree_totals,
)
from lifeos_cli.db.services.task_effort import (
    recompute_task_effort_after_timelog_change as recompute_task_effort_after_timelog_change,
)
from lifeos_cli.db.services.task_effort import (
    recompute_task_self_minutes as recompute_task_self_minutes,
)
from lifeos_cli.db.services.task_effort import (
    recompute_totals_upwards as recompute_totals_upwards,
)
from lifeos_cli.db.services.task_mutations import (
    TaskMoveResult as TaskMoveResult,
)
from lifeos_cli.db.services.task_mutations import (
    batch_delete_tasks as batch_delete_tasks,
)
from lifeos_cli.db.services.task_mutations import (
    create_task as create_task,
)
from lifeos_cli.db.services.task_mutations import (
    delete_task as delete_task,
)
from lifeos_cli.db.services.task_mutations import (
    move_task as move_task,
)
from lifeos_cli.db.services.task_mutations import (
    reorder_tasks as reorder_tasks,
)
from lifeos_cli.db.services.task_mutations import (
    update_task as update_task,
)
from lifeos_cli.db.services.task_queries import (
    TaskHierarchy as TaskHierarchy,
)
from lifeos_cli.db.services.task_queries import (
    TaskStats as TaskStats,
)
from lifeos_cli.db.services.task_queries import (
    TaskView as TaskView,
)
from lifeos_cli.db.services.task_queries import (
    TaskWithSubtasks as TaskWithSubtasks,
)
from lifeos_cli.db.services.task_queries import (
    get_task as get_task,
)
from lifeos_cli.db.services.task_queries import (
    get_task_stats as get_task_stats,
)
from lifeos_cli.db.services.task_queries import (
    get_task_with_subtasks as get_task_with_subtasks,
)
from lifeos_cli.db.services.task_queries import (
    get_vision_task_hierarchy as get_vision_task_hierarchy,
)
from lifeos_cli.db.services.task_queries import (
    list_tasks as list_tasks,
)
from lifeos_cli.db.services.task_support import (
    MAX_TASK_DEPTH as MAX_TASK_DEPTH,
)
from lifeos_cli.db.services.task_support import (
    VALID_PLANNING_CYCLE_TYPES as VALID_PLANNING_CYCLE_TYPES,
)
from lifeos_cli.db.services.task_support import (
    VALID_TASK_STATUSES as VALID_TASK_STATUSES,
)
from lifeos_cli.db.services.task_support import (
    CircularTaskReferenceError as CircularTaskReferenceError,
)
from lifeos_cli.db.services.task_support import (
    InvalidPlanningCycleError as InvalidPlanningCycleError,
)
from lifeos_cli.db.services.task_support import (
    InvalidTaskDepthError as InvalidTaskDepthError,
)
from lifeos_cli.db.services.task_support import (
    InvalidTaskOperationError as InvalidTaskOperationError,
)
from lifeos_cli.db.services.task_support import (
    ParentTaskReferenceNotFoundError as ParentTaskReferenceNotFoundError,
)
from lifeos_cli.db.services.task_support import (
    TaskCannotBeCompletedError as TaskCannotBeCompletedError,
)
from lifeos_cli.db.services.task_support import (
    TaskNotFoundError as TaskNotFoundError,
)
from lifeos_cli.db.services.task_support import (
    VisionReferenceNotFoundError as VisionReferenceNotFoundError,
)
from lifeos_cli.db.services.task_support import (
    ensure_vision_exists as ensure_vision_exists,
)
from lifeos_cli.db.services.task_support import (
    load_task_subtree as load_task_subtree,
)
from lifeos_cli.db.services.task_support import (
    validate_parent_task as validate_parent_task,
)
from lifeos_cli.db.services.task_support import (
    validate_planning_cycle as validate_planning_cycle,
)
from lifeos_cli.db.services.task_support import (
    validate_task_status as validate_task_status,
)
from lifeos_cli.db.services.task_support import (
    validate_task_status_change as validate_task_status_change,
)
