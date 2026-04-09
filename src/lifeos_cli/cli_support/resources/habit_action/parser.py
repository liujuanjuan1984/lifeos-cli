"""Habit-action resource parser construction."""

from __future__ import annotations

import argparse
from datetime import date
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.parser_common import (
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.habit_action.handlers import (
    handle_habit_action_list,
    handle_habit_action_show,
    handle_habit_action_update,
)


def build_habit_action_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit-action command tree."""
    action_parser = add_documented_parser(
        subparsers,
        "habit-action",
        help_content=HelpContent(
            summary="Manage dated habit actions",
            description=(
                "Inspect and update dated habit-action rows generated from habits.\n\n"
                "Habit actions are generated automatically and are updated in place."
            ),
            examples=(
                "lifeos habit-action list --habit-id 11111111-1111-1111-1111-111111111111",
                "lifeos habit-action list --action-date 2026-04-09",
                "lifeos habit-action update 11111111-1111-1111-1111-111111111111 --status done",
            ),
            notes=(
                "Use `list` for both per-habit and by-date views.",
                "Public CLI does not create or delete habit actions directly.",
            ),
        ),
    )
    action_parser.set_defaults(handler=make_help_handler(action_parser))
    action_subparsers = action_parser.add_subparsers(
        dest="habit_action_command",
        title="actions",
        metavar="action",
    )

    list_parser = add_documented_parser(
        action_subparsers,
        "list",
        help_content=HelpContent(
            summary="List habit actions",
            description=(
                "List habit actions for one habit or by date/window filters.\n\n"
                "Use this command to inspect daily execution records."
            ),
            examples=(
                "lifeos habit-action list --habit-id 11111111-1111-1111-1111-111111111111",
                "lifeos habit-action list --action-date 2026-04-09",
                "lifeos habit-action list --center-date 2026-04-09 --days-before 3 --days-after 3",
            ),
            notes=(
                "Use `--action-date` for one exact day.",
                "Use `--center-date` with a window when browsing nearby days.",
            ),
        ),
    )
    list_parser.add_argument("--habit-id", type=UUID, help="Filter by habit identifier")
    list_parser.add_argument("--status", help="Filter by habit-action status")
    list_parser.add_argument(
        "--action-date",
        type=date.fromisoformat,
        help="Filter by one exact action date in YYYY-MM-DD format",
    )
    list_parser.add_argument(
        "--center-date",
        type=date.fromisoformat,
        help="Reference date for a windowed action query in YYYY-MM-DD format",
    )
    list_parser.add_argument("--days-before", type=int, help="Days before the center date")
    list_parser.add_argument("--days-after", type=int, help="Days after the center date")
    add_include_deleted_argument(list_parser, noun="habit actions")
    add_limit_offset_arguments(list_parser, row_noun="habit actions")
    list_parser.set_defaults(handler=handle_habit_action_list)

    show_parser = add_documented_parser(
        action_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show a habit action",
            description="Show one habit action with its linked habit metadata.",
            examples=(
                "lifeos habit-action show 11111111-1111-1111-1111-111111111111",
                "lifeos habit-action show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("action_id", type=UUID, help="Habit-action identifier")
    add_include_deleted_argument(show_parser, noun="habit actions", help_prefix="Allow")
    show_parser.set_defaults(handler=handle_habit_action_show)

    update_parser = add_documented_parser(
        action_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update a habit action",
            description=(
                "Update a generated habit action.\n\n"
                "This command only allows status and notes changes within the editable window."
            ),
            examples=(
                "lifeos habit-action update 11111111-1111-1111-1111-111111111111 --status done",
                "lifeos habit-action update 11111111-1111-1111-1111-111111111111 "
                '--notes "Completed after lunch"',
            ),
            notes=("Use `--clear-notes` to remove optional notes.",),
        ),
    )
    update_parser.add_argument("action_id", type=UUID, help="Habit-action identifier")
    update_parser.add_argument("--status", help="Updated habit-action status")
    update_parser.add_argument("--notes", help="Updated notes")
    update_parser.add_argument(
        "--clear-notes",
        action="store_true",
        help="Clear the optional notes field",
    )
    update_parser.set_defaults(handler=handle_habit_action_update)
