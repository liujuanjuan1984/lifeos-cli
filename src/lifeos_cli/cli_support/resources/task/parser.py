"""Task resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.task.handlers import (
    handle_task_add,
    handle_task_batch_delete,
    handle_task_delete,
    handle_task_hierarchy,
    handle_task_list,
    handle_task_move,
    handle_task_reorder,
    handle_task_show,
    handle_task_stats,
    handle_task_update,
    handle_task_with_subtasks,
)


def build_task_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the task command tree."""
    task_parser = add_documented_parser(
        subparsers,
        "task",
        help_content=HelpContent(
            summary="Manage hierarchical tasks",
            description=(
                "Create and maintain task trees that belong to a vision.\n\n"
                "Tasks are the main execution unit in LifeOS and can be nested under parent tasks."
            ),
            examples=(
                'lifeos task add "Draft the release checklist" '
                "--vision-id 11111111-1111-1111-1111-111111111111",
                "lifeos task list --vision-id 11111111-1111-1111-1111-111111111111",
            ),
            notes=(
                "Use `list` as the primary query entrypoint for this resource.",
                "Tasks can form trees through `--parent-task-id`.",
                "Use the `batch` namespace for multi-record write operations.",
                "Delete operations in the CLI always perform soft deletion.",
            ),
        ),
    )
    task_parser.set_defaults(handler=make_help_handler(task_parser))
    task_subparsers = task_parser.add_subparsers(
        dest="task_command", title="actions", metavar="action"
    )

    add_parser = add_documented_parser(
        task_subparsers,
        "add",
        help_content=HelpContent(
            summary="Create a task",
            description=(
                "Create a new task for a vision.\n\n"
                "Tasks can be root tasks or child tasks under another task in the same vision."
            ),
            examples=(
                'lifeos task add "Draft the release checklist" '
                "--vision-id 11111111-1111-1111-1111-111111111111",
                'lifeos task add "Write changelog" '
                "--vision-id 11111111-1111-1111-1111-111111111111 "
                "--parent-task-id 22222222-2222-2222-2222-222222222222",
                'lifeos task add "Prepare family meeting" '
                "--vision-id 11111111-1111-1111-1111-111111111111 "
                "--person-id 33333333-3333-3333-3333-333333333333",
            ),
            notes=(
                "Planning-cycle flags must be supplied as a complete set when used.",
                "Repeat `--person-id` to associate one or more people.",
            ),
        ),
    )
    add_parser.add_argument("content", help="Task content")
    add_parser.add_argument(
        "--vision-id", required=True, type=UUID, help="Owning vision identifier"
    )
    add_parser.add_argument("--description", help="Optional task description")
    add_parser.add_argument("--parent-task-id", type=UUID, help="Optional parent task identifier")
    add_parser.add_argument("--status", default="todo", help="Task status")
    add_parser.add_argument("--priority", type=int, default=0, help="Task priority")
    add_parser.add_argument("--display-order", type=int, default=0, help="Display order")
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to associate one or more people",
    )
    add_parser.add_argument("--estimated-effort", type=int, help="Estimated effort in minutes")
    add_parser.add_argument("--planning-cycle-type", help="Planning cycle type")
    add_parser.add_argument(
        "--planning-cycle-days", type=int, help="Planning cycle duration in days"
    )
    add_parser.add_argument(
        "--planning-cycle-start-date", help="Planning cycle start date YYYY-MM-DD"
    )
    add_parser.set_defaults(handler=handle_task_add)

    list_parser = add_documented_parser(
        task_subparsers,
        "list",
        help_content=HelpContent(
            summary="List tasks",
            description=(
                "List tasks with optional vision, parent, or status filters.\n\n"
                "Use this command as the primary query entrypoint for structured task views."
            ),
            examples=(
                "lifeos task list",
                "lifeos task list --vision-id 11111111-1111-1111-1111-111111111111",
                "lifeos task list --person-id 11111111-1111-1111-1111-111111111111",
                "lifeos task list --parent-task-id "
                "22222222-2222-2222-2222-222222222222 --status todo",
            ),
            notes=(
                "When `--vision-id` is provided without `--parent-task-id`, only root "
                "tasks are listed.",
                "Use `--limit` and `--offset` for pagination.",
            ),
        ),
    )
    list_parser.add_argument(
        "--vision-id",
        type=UUID,
        help="Filter by vision identifier",
    )
    list_parser.add_argument("--vision-in", help="Comma-separated vision identifiers")
    list_parser.add_argument("--parent-task-id", type=UUID, help="Filter by parent task identifier")
    list_parser.add_argument("--person-id", type=UUID, help="Filter by linked person identifier")
    list_parser.add_argument("--status", help="Filter by task status")
    list_parser.add_argument("--status-in", help="Comma-separated statuses to include")
    list_parser.add_argument("--exclude-status", help="Comma-separated statuses to exclude")
    list_parser.add_argument("--planning-cycle-type", help="Filter by planning cycle type")
    list_parser.add_argument(
        "--planning-cycle-start-date",
        help="Filter by planning cycle start date YYYY-MM-DD",
    )
    list_parser.add_argument("--content", help="Filter by exact task content")
    add_include_deleted_argument(list_parser, noun="tasks")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=handle_task_list)

    show_parser = add_documented_parser(
        task_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show a task",
            description="Show one task with full metadata.",
            examples=(
                "lifeos task show 11111111-1111-1111-1111-111111111111",
                "lifeos task show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("task_id", type=UUID, help="Task identifier")
    add_include_deleted_argument(show_parser, noun="tasks", help_prefix="Allow")
    show_parser.set_defaults(handler=handle_task_show)

    with_subtasks_parser = add_documented_parser(
        task_subparsers,
        "with-subtasks",
        help_content=HelpContent(
            summary="Show a task subtree",
            description="Show one task with its active nested subtasks.",
            examples=("lifeos task with-subtasks 11111111-1111-1111-1111-111111111111",),
        ),
    )
    with_subtasks_parser.add_argument("task_id", type=UUID, help="Task identifier")
    with_subtasks_parser.set_defaults(handler=handle_task_with_subtasks)

    hierarchy_parser = add_documented_parser(
        task_subparsers,
        "hierarchy",
        help_content=HelpContent(
            summary="Show a vision task hierarchy",
            description="Show all active tasks for a vision as a hierarchy.",
            examples=("lifeos task hierarchy 11111111-1111-1111-1111-111111111111",),
        ),
    )
    hierarchy_parser.add_argument("vision_id", type=UUID, help="Vision identifier")
    hierarchy_parser.set_defaults(handler=handle_task_hierarchy)

    stats_parser = add_documented_parser(
        task_subparsers,
        "stats",
        help_content=HelpContent(
            summary="Show task statistics",
            description="Show subtree completion and effort statistics for one task.",
            examples=("lifeos task stats 11111111-1111-1111-1111-111111111111",),
        ),
    )
    stats_parser.add_argument("task_id", type=UUID, help="Task identifier")
    stats_parser.set_defaults(handler=handle_task_stats)

    move_parser = add_documented_parser(
        task_subparsers,
        "move",
        help_content=HelpContent(
            summary="Move a task",
            description="Move a task to a new parent and optionally a new vision.",
            examples=(
                "lifeos task move 11111111-1111-1111-1111-111111111111 "
                "--new-parent-task-id 22222222-2222-2222-2222-222222222222",
                "lifeos task move 11111111-1111-1111-1111-111111111111 "
                "--new-vision-id 33333333-3333-3333-3333-333333333333 --clear-parent",
            ),
        ),
    )
    move_parser.add_argument("task_id", type=UUID, help="Task identifier")
    move_parser.add_argument(
        "--old-parent-task-id",
        type=UUID,
        help="Expected current parent task identifier",
    )
    move_parser.add_argument(
        "--new-parent-task-id",
        type=UUID,
        help="Target parent task identifier",
    )
    move_parser.add_argument(
        "--clear-parent",
        action="store_true",
        help="Move the task to the root level",
    )
    move_parser.add_argument("--new-vision-id", type=UUID, help="Target vision identifier")
    move_parser.add_argument(
        "--new-display-order",
        type=int,
        default=0,
        help="Target display order",
    )
    move_parser.set_defaults(handler=handle_task_move)

    reorder_parser = add_documented_parser(
        task_subparsers,
        "reorder",
        help_content=HelpContent(
            summary="Reorder tasks",
            description="Update display order values for one or more tasks.",
            examples=(
                "lifeos task reorder --order 11111111-1111-1111-1111-111111111111:0 "
                "--order 22222222-2222-2222-2222-222222222222:1",
            ),
        ),
    )
    reorder_parser.add_argument(
        "--order",
        action="append",
        required=True,
        help="Task order in <task-id>:<display-order> format; repeat for multiple tasks",
    )
    reorder_parser.set_defaults(handler=handle_task_reorder)

    update_parser = add_documented_parser(
        task_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update a task",
            description=(
                "Update mutable task fields.\n\n"
                "Only explicitly provided flags are changed; omitted fields stay unchanged."
            ),
            examples=(
                "lifeos task update 11111111-1111-1111-1111-111111111111 --status in_progress",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--priority 3 --display-order 20",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--person-id 33333333-3333-3333-3333-333333333333",
                "lifeos task update 11111111-1111-1111-1111-111111111111 --clear-parent",
                "lifeos task update 11111111-1111-1111-1111-111111111111 --clear-planning-cycle",
            ),
            notes=(
                "Parent task references must stay within the same vision.",
                "Use `--clear-parent` to move a child task back to the root level.",
                "Use `--clear-*` flags to remove optional values such as descriptions "
                "or planning cycles.",
            ),
        ),
    )
    update_parser.add_argument("task_id", type=UUID, help="Task identifier")
    update_parser.add_argument("--content", help="Updated task content")
    update_parser.add_argument("--description", help="Updated description")
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help="Clear the optional task description",
    )
    update_parser.add_argument("--parent-task-id", type=UUID, help="Updated parent task identifier")
    update_parser.add_argument(
        "--clear-parent",
        action="store_true",
        help="Move the task to the root level by clearing its parent task reference",
    )
    update_parser.add_argument("--status", help="Updated task status")
    update_parser.add_argument("--priority", type=int, help="Updated priority")
    update_parser.add_argument("--display-order", type=int, help="Updated display order")
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to replace people with one or more identifiers",
    )
    update_parser.add_argument("--clear-people", action="store_true", help="Remove all people")
    update_parser.add_argument("--estimated-effort", type=int, help="Updated estimated effort")
    update_parser.add_argument(
        "--clear-estimated-effort",
        action="store_true",
        help="Clear the optional estimated effort value",
    )
    update_parser.add_argument("--planning-cycle-type", help="Updated planning cycle type")
    update_parser.add_argument(
        "--planning-cycle-days", type=int, help="Updated planning cycle days"
    )
    update_parser.add_argument("--planning-cycle-start-date", help="Updated start date YYYY-MM-DD")
    update_parser.add_argument(
        "--clear-planning-cycle",
        action="store_true",
        help="Clear all planning cycle fields",
    )
    update_parser.set_defaults(handler=handle_task_update)

    delete_parser = add_documented_parser(
        task_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete a task",
            description=(
                "Soft-delete a task.\n\n"
                "The record remains recoverable and visible through deleted-aware "
                "inspection commands."
            ),
            examples=("lifeos task delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("task_id", type=UUID, help="Task identifier")
    delete_parser.set_defaults(handler=handle_task_delete)

    batch_parser = add_documented_parser(
        task_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch task operations",
            description=(
                "Run write operations that target multiple tasks in one command.\n\n"
                "Use this namespace for bulk maintenance rather than adding many top-level verbs."
            ),
            examples=(
                "lifeos task batch delete --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222",
            ),
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="task_batch_command",
        title="batch actions",
        metavar="batch_action",
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete multiple tasks",
            description="Soft-delete multiple tasks by identifier.",
            notes=("Batch delete never performs hard deletion from the public CLI.",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="task_ids", noun="task")
    batch_delete_parser.set_defaults(handler=handle_task_batch_delete)
