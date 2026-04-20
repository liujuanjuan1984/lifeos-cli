"""Task resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
)
from lifeos_cli.cli_support.resources.task.parser_batch import build_task_batch_parser
from lifeos_cli.cli_support.resources.task.parser_read_models import (
    build_task_hierarchy_parser,
    build_task_list_parser,
    build_task_show_parser,
    build_task_stats_parser,
    build_task_with_subtasks_parser,
)
from lifeos_cli.cli_support.resources.task.parser_structure import (
    build_task_move_parser,
    build_task_reorder_parser,
)
from lifeos_cli.cli_support.resources.task.parser_write import (
    build_task_add_parser,
    build_task_delete_parser,
    build_task_update_parser,
)
from lifeos_cli.i18n import gettext_message as _


def build_task_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the task command tree."""
    task_parser = add_documented_help_parser(
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
                + " "
                + _(
                    "Use planning-cycle fields for the broader timebox. Use `event` when the "
                    "task also needs a concrete time block."
                )
            ),
            examples=(
                "lifeos task add --help",
                "lifeos task list --help",
                "lifeos task batch --help",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for this resource."),
                _("Tasks can form trees through `--parent-task-id`."),
                _(
                    "Use `lifeos event add --task-id <task-id>` when the task also needs a "
                    "specific appointment, timeblock, or deadline."
                ),
                _("See `lifeos task batch --help` for bulk delete operations."),
            ),
        ),
    )
    task_subparsers = task_parser.add_subparsers(
        dest="task_command", title=_("actions"), metavar=_("action")
    )

    build_task_add_parser(task_subparsers)
    build_task_list_parser(task_subparsers)
    build_task_show_parser(task_subparsers)
    build_task_with_subtasks_parser(task_subparsers)
    build_task_hierarchy_parser(task_subparsers)
    build_task_stats_parser(task_subparsers)
    build_task_move_parser(task_subparsers)
    build_task_reorder_parser(task_subparsers)
    build_task_update_parser(task_subparsers)
    build_task_delete_parser(task_subparsers)
    build_task_batch_parser(task_subparsers)
