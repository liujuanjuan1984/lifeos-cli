"""Builder helpers for task write commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.resources.task.handlers import (
    handle_task_add_async,
    handle_task_delete_async,
    handle_task_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_task_add_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task add command."""
    add_parser = add_documented_parser(
        task_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create a task"),
            description=(
                _("Create a new task for a vision.")
                + "\n\n"
                + _("Tasks can be root tasks or child tasks under another task in the same vision.")
                + " "
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
                'lifeos task add "Plan shared trip" '
                "--vision-id 11111111-1111-1111-1111-111111111111 "
                "--person-id 33333333-3333-3333-3333-333333333333 "
                "--person-id 44444444-4444-4444-4444-444444444444",
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
                    "time block on a calendar day."
                ),
                _(
                    "Repeat the same `--person-id` flag to associate multiple people in one "
                    "command."
                ),
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


def build_task_update_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task update command."""
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
                "--person-id 33333333-3333-3333-3333-333333333333 "
                "--person-id 44444444-4444-4444-4444-444444444444",
                "lifeos task update 11111111-1111-1111-1111-111111111111 "
                "--clear-description --clear-estimated-effort",
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


def build_task_delete_parser(
    task_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the task delete command."""
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
