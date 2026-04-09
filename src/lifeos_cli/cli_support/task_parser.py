"""Task resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.shared import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.task_handlers import (
    handle_task_add,
    handle_task_delete,
    handle_task_list,
    handle_task_show,
    handle_task_update,
)


def build_task_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the task command tree."""
    task_parser = add_documented_parser(
        subparsers,
        "task",
        help_content=HelpContent(
            summary="Manage hierarchical tasks",
            description="Create and maintain task trees that belong to a vision.",
            examples=(
                'lifeos task add "Draft the release checklist" --vision-id 11111111-1111-1111-1111-111111111111',
                "lifeos task list --vision-id 11111111-1111-1111-1111-111111111111",
            ),
        ),
    )
    task_parser.set_defaults(handler=make_help_handler(task_parser))
    task_subparsers = task_parser.add_subparsers(dest="task_command", title="actions", metavar="action")

    add_parser = add_documented_parser(task_subparsers, "add", help_content=HelpContent(summary="Create a task", description="Create a new task for a vision."))
    add_parser.add_argument("content", help="Task content")
    add_parser.add_argument("--vision-id", required=True, type=UUID, help="Owning vision identifier")
    add_parser.add_argument("--description", help="Optional task description")
    add_parser.add_argument("--parent-task-id", type=UUID, help="Optional parent task identifier")
    add_parser.add_argument("--status", default="todo", help="Task status")
    add_parser.add_argument("--priority", type=int, default=0, help="Task priority")
    add_parser.add_argument("--display-order", type=int, default=0, help="Display order")
    add_parser.add_argument("--estimated-effort", type=int, help="Estimated effort in minutes")
    add_parser.add_argument("--planning-cycle-type", help="Planning cycle type")
    add_parser.add_argument("--planning-cycle-days", type=int, help="Planning cycle duration in days")
    add_parser.add_argument("--planning-cycle-start-date", help="Planning cycle start date YYYY-MM-DD")
    add_parser.set_defaults(handler=handle_task_add)

    list_parser = add_documented_parser(task_subparsers, "list", help_content=HelpContent(summary="List tasks", description="List tasks with optional vision, parent, or status filters."))
    list_parser.add_argument("--vision-id", type=UUID, help="Filter by vision identifier")
    list_parser.add_argument("--parent-task-id", type=UUID, help="Filter by parent task identifier")
    list_parser.add_argument("--status", help="Filter by task status")
    list_parser.add_argument("--include-deleted", action="store_true", help="Include soft-deleted tasks")
    list_parser.add_argument("--limit", type=int, default=100, help="Maximum number of rows")
    list_parser.add_argument("--offset", type=int, default=0, help="Number of rows to skip")
    list_parser.set_defaults(handler=handle_task_list)

    show_parser = add_documented_parser(task_subparsers, "show", help_content=HelpContent(summary="Show a task", description="Show one task with full metadata."))
    show_parser.add_argument("task_id", type=UUID, help="Task identifier")
    show_parser.add_argument("--include-deleted", action="store_true", help="Allow deleted tasks")
    show_parser.set_defaults(handler=handle_task_show)

    update_parser = add_documented_parser(task_subparsers, "update", help_content=HelpContent(summary="Update a task", description="Update mutable task fields."))
    update_parser.add_argument("task_id", type=UUID, help="Task identifier")
    update_parser.add_argument("--content", help="Updated task content")
    update_parser.add_argument("--description", help="Updated description")
    update_parser.add_argument("--parent-task-id", type=UUID, help="Updated parent task identifier")
    update_parser.add_argument("--status", help="Updated task status")
    update_parser.add_argument("--priority", type=int, help="Updated priority")
    update_parser.add_argument("--display-order", type=int, help="Updated display order")
    update_parser.add_argument("--estimated-effort", type=int, help="Updated estimated effort")
    update_parser.add_argument("--planning-cycle-type", help="Updated planning cycle type")
    update_parser.add_argument("--planning-cycle-days", type=int, help="Updated planning cycle days")
    update_parser.add_argument("--planning-cycle-start-date", help="Updated start date YYYY-MM-DD")
    update_parser.set_defaults(handler=handle_task_update)

    delete_parser = add_documented_parser(task_subparsers, "delete", help_content=HelpContent(summary="Delete a task", description="Soft-delete a task by default. Use --hard for permanent deletion."))
    delete_parser.add_argument("task_id", type=UUID, help="Task identifier")
    delete_parser.add_argument("--hard", action="store_true", help="Permanently delete the task")
    delete_parser.set_defaults(handler=handle_task_delete)
