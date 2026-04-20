"""Builder helpers for task read-model commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.task.handlers import (
    TASK_SUMMARY_COLUMNS,
    handle_task_hierarchy_async,
    handle_task_list_async,
    handle_task_show_async,
    handle_task_stats_async,
    handle_task_with_subtasks_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_task_list_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task list command."""
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


def build_task_show_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task show command."""
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


def build_task_with_subtasks_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task with-subtasks command."""
    with_subtasks_parser = add_documented_parser(
        task_subparsers,
        "with-subtasks",
        help_content=HelpContent(
            summary=_("Show a task subtree"),
            description=_("Show one task with its active nested subtasks."),
            examples=("lifeos task with-subtasks 11111111-1111-1111-1111-111111111111",),
            notes=(
                _(
                    "The root task prints first, followed by active descendants indented by "
                    "depth with columns: task_id, status, completion_percentage, content."
                ),
                _("Use `hierarchy` when you need the full active tree for an entire vision."),
            ),
        ),
    )
    with_subtasks_parser.add_argument("task_id", type=UUID, help=_("Task identifier"))
    with_subtasks_parser.set_defaults(handler=make_sync_handler(handle_task_with_subtasks_async))


def build_task_hierarchy_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task hierarchy command."""
    hierarchy_parser = add_documented_parser(
        task_subparsers,
        "hierarchy",
        help_content=HelpContent(
            summary=_("Show a vision task hierarchy"),
            description=_("Show all active tasks for a vision as a hierarchy."),
            examples=("lifeos task hierarchy 11111111-1111-1111-1111-111111111111",),
            notes=(
                _(
                    "The output starts with the vision identifier, then prints each root task "
                    "and descendant using the same indented task tree shape as `with-subtasks`."
                ),
                _("Use `with-subtasks` when you want to inspect only one branch of the tree."),
            ),
        ),
    )
    hierarchy_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    hierarchy_parser.set_defaults(handler=make_sync_handler(handle_task_hierarchy_async))


def build_task_stats_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task stats command."""
    stats_parser = add_documented_parser(
        task_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("Show task statistics"),
            description=_("Show subtree completion and effort statistics for one task."),
            examples=("lifeos task stats 11111111-1111-1111-1111-111111111111",),
            notes=(
                _("Totals aggregate the selected task together with all active descendants."),
                _(
                    "When the task has direct children, `completion_percentage` measures how "
                    "many of those children are done."
                ),
            ),
        ),
    )
    stats_parser.add_argument("task_id", type=UUID, help=_("Task identifier"))
    stats_parser.set_defaults(handler=make_sync_handler(handle_task_stats_async))
