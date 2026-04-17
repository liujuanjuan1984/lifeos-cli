"""Task resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.task.handlers import (
    TASK_SUMMARY_COLUMNS,
    handle_task_add_async,
    handle_task_batch_delete_async,
    handle_task_delete_async,
    handle_task_hierarchy_async,
    handle_task_list_async,
    handle_task_move_async,
    handle_task_reorder_async,
    handle_task_show_async,
    handle_task_stats_async,
    handle_task_update_async,
    handle_task_with_subtasks_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_task_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the task command tree."""
    task_parser = add_documented_parser(
        subparsers,
        "task",
        help_content=HelpContent(
            summary=_("Manage hierarchical tasks"),
            description=(
                _("Create and maintain task trees that belong to a vision.")
                + "\n\n"
                + _(
                    "Tasks are the main execution unit in LifeOS and can be nested under parent "
                    "tasks."
                )
                + "\n"
                + _("Use planning-cycle fields to place a task inside a broader timebox, and use")
                + "\n"
                + _("`event` commands when the task also needs a concrete scheduled time block.")
            ),
            examples=(
                "lifeos task add --help",
                'lifeos task add "Draft the release checklist" '
                "--vision-id 11111111-1111-1111-1111-111111111111",
                "lifeos task list --vision-id 11111111-1111-1111-1111-111111111111",
                "lifeos task with-subtasks 11111111-1111-1111-1111-111111111111",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for this resource."),
                _("Tasks can form trees through `--parent-task-id`."),
                _(
                    "Use `lifeos event add --task-id <task-id>` when a task also needs a specific "
                    "appointment, timeblock, or deadline in the daily schedule."
                ),
                _("Use the `batch` namespace for multi-record write operations."),
                _("Delete operations in the CLI always perform soft deletion."),
            ),
        ),
    )
    task_parser.set_defaults(handler=make_help_handler(task_parser))
    task_subparsers = task_parser.add_subparsers(
        dest="task_command", title=_("actions"), metavar=_("action")
    )

    add_parser = add_documented_parser(
        task_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create a task"),
            description=(
                _("Create a new task for a vision.")
                + "\n\n"
                + _("Tasks can be root tasks or child tasks under another task in the same vision.")
                + "\n"
                + _(
                    "Planning-cycle fields describe the enclosing timebox for the task, not a "
                    "clock-time execution slot."
                )
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
                'lifeos task add "Draft sprint backlog" '
                "--vision-id 11111111-1111-1111-1111-111111111111 "
                "--planning-cycle-type week --planning-cycle-days 7 "
                "--planning-cycle-start-date 2026-04-14",
            ),
            notes=(
                _("Planning-cycle flags must be supplied as a complete set when used."),
                _(
                    "Use planning-cycle fields for the broader year, month, week, or day window "
                    "that the task belongs to."
                ),
                _(
                    "Use `lifeos event add --task-id <task-id>` if the task also needs a specific "
                    "scheduled time block on a calendar day."
                ),
                _("Repeat `--person-id` to associate one or more people."),
                _(
                    "When an agent creates tasks on behalf of a human, use `--person-id` to "
                    "mark whether the task belongs to the human, the agent, or both."
                ),
            ),
        ),
    )
    add_parser.add_argument("content", help=_("Task content"))
    add_parser.add_argument(
        "--vision-id", required=True, type=UUID, help=_("Owning vision identifier")
    )
    add_parser.add_argument("--description", help=_("Optional task description"))
    add_parser.add_argument(
        "--parent-task-id", type=UUID, help=_("Optional parent task identifier")
    )
    add_parser.add_argument("--status", default="todo", help=_("Task status"))
    add_parser.add_argument("--priority", type=int, default=0, help=_("Task priority"))
    add_parser.add_argument("--display-order", type=int, default=0, help=_("Display order"))
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to associate one or more people"),
    )
    add_parser.add_argument("--estimated-effort", type=int, help=_("Estimated effort in minutes"))
    add_parser.add_argument(
        "--planning-cycle-type",
        help=_("Planning cycle type: year, month, week, or day"),
    )
    add_parser.add_argument(
        "--planning-cycle-days",
        type=int,
        help=_("Planning cycle duration in days for the enclosing timebox"),
    )
    add_parser.add_argument(
        "--planning-cycle-start-date",
        help=_("Start date of the enclosing planning cycle window in YYYY-MM-DD format"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_task_add_async))

    list_parser = add_documented_parser(
        task_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List tasks"),
            description=(
                _("List tasks with optional vision, parent, or status filters.")
                + "\n\n"
                + _("Use this command as the primary query entrypoint for structured task views.")
            ),
            examples=(
                "lifeos task list",
                "lifeos task list --vision-id 11111111-1111-1111-1111-111111111111",
                "lifeos task list --person-id 11111111-1111-1111-1111-111111111111",
                "lifeos task list --parent-task-id "
                "22222222-2222-2222-2222-222222222222 --status todo",
            ),
            notes=(
                _(
                    "When `--vision-id` is provided without `--parent-task-id`, only root "
                    "tasks are listed."
                ),
                _(
                    "When results exist, the list command prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(TASK_SUMMARY_COLUMNS)),
                _("Use `--limit` and `--offset` for pagination."),
            ),
        ),
    )
    list_parser.add_argument(
        "--vision-id",
        type=UUID,
        help=_("Filter by vision identifier"),
    )
    list_parser.add_argument("--vision-in", help=_("Comma-separated vision identifiers"))
    list_parser.add_argument(
        "--parent-task-id", type=UUID, help=_("Filter by parent task identifier")
    )
    list_parser.add_argument("--person-id", type=UUID, help=_("Filter by linked person identifier"))
    list_parser.add_argument("--status", help=_("Filter by task status"))
    list_parser.add_argument("--status-in", help=_("Comma-separated statuses to include"))
    list_parser.add_argument("--exclude-status", help=_("Comma-separated statuses to exclude"))
    list_parser.add_argument("--planning-cycle-type", help=_("Filter by planning cycle type"))
    list_parser.add_argument(
        "--planning-cycle-start-date",
        help=_("Filter by planning cycle start date YYYY-MM-DD"),
    )
    list_parser.add_argument("--content", help=_("Filter by exact task content"))
    add_include_deleted_argument(list_parser, noun="tasks")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_task_list_async))

    show_parser = add_documented_parser(
        task_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show a task"),
            description=_("Show one task with full metadata."),
            examples=(
                "lifeos task show 11111111-1111-1111-1111-111111111111",
                "lifeos task show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("task_id", type=UUID, help=_("Task identifier"))
    add_include_deleted_argument(show_parser, noun="tasks", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_task_show_async))

    with_subtasks_parser = add_documented_parser(
        task_subparsers,
        "with-subtasks",
        help_content=HelpContent(
            summary=_("Show a task subtree"),
            description=_("Show one task with its active nested subtasks."),
            examples=("lifeos task with-subtasks 11111111-1111-1111-1111-111111111111",),
        ),
    )
    with_subtasks_parser.add_argument("task_id", type=UUID, help=_("Task identifier"))
    with_subtasks_parser.set_defaults(handler=make_sync_handler(handle_task_with_subtasks_async))

    hierarchy_parser = add_documented_parser(
        task_subparsers,
        "hierarchy",
        help_content=HelpContent(
            summary=_("Show a vision task hierarchy"),
            description=_("Show all active tasks for a vision as a hierarchy."),
            examples=("lifeos task hierarchy 11111111-1111-1111-1111-111111111111",),
        ),
    )
    hierarchy_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    hierarchy_parser.set_defaults(handler=make_sync_handler(handle_task_hierarchy_async))

    stats_parser = add_documented_parser(
        task_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("Show task statistics"),
            description=_("Show subtree completion and effort statistics for one task."),
            examples=("lifeos task stats 11111111-1111-1111-1111-111111111111",),
        ),
    )
    stats_parser.add_argument("task_id", type=UUID, help=_("Task identifier"))
    stats_parser.set_defaults(handler=make_sync_handler(handle_task_stats_async))

    move_parser = add_documented_parser(
        task_subparsers,
        "move",
        help_content=HelpContent(
            summary=_("Move a task"),
            description=_("Move a task to a new parent and optionally a new vision."),
            examples=(
                "lifeos task move 11111111-1111-1111-1111-111111111111 "
                "--new-parent-task-id 22222222-2222-2222-2222-222222222222",
                "lifeos task move 11111111-1111-1111-1111-111111111111 "
                "--new-vision-id 33333333-3333-3333-3333-333333333333 --clear-parent",
            ),
        ),
    )
    move_parser.add_argument("task_id", type=UUID, help=_("Task identifier"))
    move_parser.add_argument(
        "--old-parent-task-id",
        type=UUID,
        help=_("Expected current parent task identifier"),
    )
    move_parser.add_argument(
        "--new-parent-task-id",
        type=UUID,
        help=_("Target parent task identifier"),
    )
    move_parser.add_argument(
        "--clear-parent",
        action="store_true",
        help=_("Move the task to the root level"),
    )
    move_parser.add_argument("--new-vision-id", type=UUID, help=_("Target vision identifier"))
    move_parser.add_argument(
        "--new-display-order",
        type=int,
        help=_("Target display order"),
    )
    move_parser.set_defaults(handler=make_sync_handler(handle_task_move_async))

    reorder_parser = add_documented_parser(
        task_subparsers,
        "reorder",
        help_content=HelpContent(
            summary=_("Reorder tasks"),
            description=_("Update display order values for one or more tasks."),
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
        help=_("Task order in <task-id>:<display-order> format; repeat for multiple tasks"),
    )
    reorder_parser.set_defaults(handler=make_sync_handler(handle_task_reorder_async))

    update_parser = add_documented_parser(
        task_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update a task"),
            description=(
                _("Update mutable task fields.")
                + "\n\n"
                + _("Only explicitly provided flags are changed; omitted fields stay unchanged.")
            ),
            examples=(
                "lifeos task update 11111111-1111-1111-1111-111111111111 --status in_progress",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--priority 3 --display-order 20",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--person-id 33333333-3333-3333-3333-333333333333",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--planning-cycle-type month --planning-cycle-days 30 "
                "--planning-cycle-start-date 2026-04-01",
                "lifeos task update 11111111-1111-1111-1111-111111111111 --clear-parent",
                "lifeos task update 11111111-1111-1111-1111-111111111111 --clear-planning-cycle",
            ),
            notes=(
                _("Parent task references must stay within the same vision."),
                _("Use `--clear-parent` to move a child task back to the root level."),
                _(
                    "Updated planning-cycle fields still describe the enclosing timebox, not "
                    "a specific scheduled timestamp."
                ),
                _(
                    "Use `--clear-*` flags to remove optional values such as descriptions or "
                    "planning cycles."
                ),
                _(
                    "Use repeated `--person-id` to keep human-only, agent-only, and shared "
                    "task ownership explicit."
                ),
            ),
        ),
    )
    update_parser.add_argument("task_id", type=UUID, help=_("Task identifier"))
    update_parser.add_argument("--content", help=_("Updated task content"))
    update_parser.add_argument("--description", help=_("Updated description"))
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("Clear the optional task description"),
    )
    update_parser.add_argument(
        "--parent-task-id", type=UUID, help=_("Updated parent task identifier")
    )
    update_parser.add_argument(
        "--clear-parent",
        action="store_true",
        help=_("Move the task to the root level by clearing its parent task reference"),
    )
    update_parser.add_argument("--status", help=_("Updated task status"))
    update_parser.add_argument("--priority", type=int, help=_("Updated priority"))
    update_parser.add_argument("--display-order", type=int, help=_("Updated display order"))
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace people with one or more identifiers"),
    )
    update_parser.add_argument("--clear-people", action="store_true", help=_("Remove all people"))
    update_parser.add_argument("--estimated-effort", type=int, help=_("Updated estimated effort"))
    update_parser.add_argument(
        "--clear-estimated-effort",
        action="store_true",
        help=_("Clear the optional estimated effort value"),
    )
    update_parser.add_argument(
        "--planning-cycle-type",
        help=_("Updated planning cycle type: year, month, week, or day"),
    )
    update_parser.add_argument(
        "--planning-cycle-days",
        type=int,
        help=_("Updated planning cycle duration in days for the enclosing timebox"),
    )
    update_parser.add_argument(
        "--planning-cycle-start-date",
        help=_("Updated start date of the enclosing planning cycle window in YYYY-MM-DD format"),
    )
    update_parser.add_argument(
        "--clear-planning-cycle",
        action="store_true",
        help=_("Clear all planning cycle fields"),
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_task_update_async))

    delete_parser = add_documented_parser(
        task_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete a task"),
            description=(
                _("Soft-delete a task.")
                + "\n\n"
                + _(
                    "The record remains recoverable and visible through deleted-aware "
                    "inspection commands."
                )
            ),
            examples=("lifeos task delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("task_id", type=UUID, help=_("Task identifier"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_task_delete_async))

    batch_parser = add_documented_parser(
        task_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch task operations"),
            description=(
                _("Run write operations that target multiple tasks in one command.")
                + "\n\n"
                + _(
                    "Use this namespace for bulk maintenance rather than adding many top-level "
                    "verbs."
                )
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
        title=_("batch actions"),
        metavar=_("batch_action"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple tasks"),
            description=_("Soft-delete multiple tasks by identifier."),
            notes=(_("Batch delete never performs hard deletion from the public CLI."),),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="task_ids", noun="task")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_task_batch_delete_async))
