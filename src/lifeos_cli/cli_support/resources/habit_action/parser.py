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
    handle_habit_action_log,
    handle_habit_action_show,
    handle_habit_action_update,
)
from lifeos_cli.i18n import gettext_message as _


def build_habit_action_parser(
    subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the habit-action command tree."""
    action_parser = add_documented_parser(
        subparsers,
        "habit-action",
        help_content=HelpContent(
            summary=_("Manage dated habit actions"),
            description=(
                _("Inspect and update dated habit-action rows generated from habits.")
                + "\n\n"
                + _("Habit actions are generated automatically and are updated in place.")
            ),
            examples=(
                "lifeos habit-action list --habit-id 11111111-1111-1111-1111-111111111111",
                "lifeos habit-action list --action-date 2026-04-09",
                "lifeos habit-action update 11111111-1111-1111-1111-111111111111 --status done",
                "lifeos habit-action log --habit-id 11111111-1111-1111-1111-111111111111 "
                "--action-date 2026-04-09 --status done",
            ),
            notes=(
                _("Use `list` for both per-habit and by-date views."),
                _("Public CLI does not create or delete habit actions directly."),
            ),
        ),
    )
    action_parser.set_defaults(handler=make_help_handler(action_parser))
    action_subparsers = action_parser.add_subparsers(
        dest="habit_action_command",
        title=_("actions"),
        metavar=_("action"),
    )

    list_parser = add_documented_parser(
        action_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List habit actions"),
            description=(
                _("List habit actions for one habit or by date/window filters.")
                + "\n\n"
                + _("Use this command to inspect daily execution records.")
            ),
            examples=(
                "lifeos habit-action list --habit-id 11111111-1111-1111-1111-111111111111",
                "lifeos habit-action list --action-date 2026-04-09",
                "lifeos habit-action list --center-date 2026-04-09 --days-before 3 --days-after 3",
                "lifeos habit-action list --action-date 2026-04-09 --count",
            ),
            notes=(
                _("Use `--action-date` for one exact day."),
                _("Use `--center-date` with a window when browsing nearby days."),
            ),
        ),
    )
    list_parser.add_argument("--habit-id", type=UUID, help=_("Filter by habit identifier"))
    list_parser.add_argument("--status", help=_("Filter by habit-action status"))
    list_parser.add_argument(
        "--action-date",
        type=date.fromisoformat,
        help=_("Filter by one exact action date in YYYY-MM-DD format"),
    )
    list_parser.add_argument(
        "--center-date",
        type=date.fromisoformat,
        help=_("Reference date for a windowed action query in YYYY-MM-DD format"),
    )
    list_parser.add_argument("--days-before", type=int, help=_("Days before the center date"))
    list_parser.add_argument("--days-after", type=int, help=_("Days after the center date"))
    list_parser.add_argument("--count", action="store_true", help=_("Print total matched count"))
    add_include_deleted_argument(list_parser, noun="habit actions")
    add_limit_offset_arguments(list_parser, row_noun="habit actions")
    list_parser.set_defaults(handler=handle_habit_action_list)

    show_parser = add_documented_parser(
        action_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show a habit action"),
            description=_("Show one habit action with its linked habit metadata."),
            examples=(
                "lifeos habit-action show 11111111-1111-1111-1111-111111111111",
                "lifeos habit-action show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("action_id", type=UUID, help=_("Habit-action identifier"))
    add_include_deleted_argument(show_parser, noun="habit actions", help_prefix="Allow")
    show_parser.set_defaults(handler=handle_habit_action_show)

    update_parser = add_documented_parser(
        action_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update a habit action"),
            description=(
                _("Update a generated habit action.")
                + "\n\n"
                + _("This command only allows status and notes changes within the editable window.")
            ),
            examples=(
                "lifeos habit-action update 11111111-1111-1111-1111-111111111111 --status done",
                "lifeos habit-action update 11111111-1111-1111-1111-111111111111 "
                '--notes "Completed after lunch"',
            ),
            notes=(_("Use `--clear-notes` to remove optional notes."),),
        ),
    )
    update_parser.add_argument("action_id", type=UUID, help=_("Habit-action identifier"))
    update_parser.add_argument("--status", help=_("Updated habit-action status"))
    update_parser.add_argument("--notes", help=_("Updated notes"))
    update_parser.add_argument(
        "--clear-notes",
        action="store_true",
        help=_("Clear the optional notes field"),
    )
    update_parser.set_defaults(handler=handle_habit_action_update)

    log_parser = add_documented_parser(
        action_subparsers,
        "log",
        help_content=HelpContent(
            summary=_("Update a habit action by date"),
            description=(
                _("Update a generated habit action by habit identifier and action date.")
                + "\n\n"
                + _("Use this command when checking in without first looking up the action ID.")
            ),
            examples=(
                "lifeos habit-action log --habit-id 11111111-1111-1111-1111-111111111111 "
                "--action-date 2026-04-09 --status done",
                "lifeos habit-action log --habit-id 11111111-1111-1111-1111-111111111111 "
                '--action-date 2026-04-09 --status skip --notes "Travel day"',
            ),
            notes=(_("This command follows the same editable-window rules as `update`."),),
        ),
    )
    log_parser.add_argument("--habit-id", required=True, type=UUID, help=_("Habit identifier"))
    log_parser.add_argument(
        "--action-date",
        required=True,
        type=date.fromisoformat,
        help=_("Action date in YYYY-MM-DD format"),
    )
    log_parser.add_argument("--status", help=_("Updated habit-action status"))
    log_parser.add_argument("--notes", help=_("Updated notes"))
    log_parser.add_argument(
        "--clear-notes",
        action="store_true",
        help=_("Clear the optional notes field"),
    )
    log_parser.set_defaults(handler=handle_habit_action_log)
