"""Builder helpers for vision read-model commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.resources.vision.handlers import (
    VISION_WITH_TASKS_COLUMNS,
    handle_vision_stats_async,
    handle_vision_with_tasks_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_vision_with_tasks_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision with-tasks command."""
    with_tasks_parser = add_documented_parser(
        vision_subparsers,
        "with-tasks",
        help_content=HelpContent(
            summary=_("Show a vision task tree"),
            description=_("Show one vision with its active tasks."),
            examples=("lifeos vision with-tasks 11111111-1111-1111-1111-111111111111",),
            notes=(
                _(
                    "When the vision has tasks, the `tasks` section prints a header row "
                    "followed by tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(VISION_WITH_TASKS_COLUMNS)),
            ),
        ),
    )
    with_tasks_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    with_tasks_parser.set_defaults(handler=make_sync_handler(handle_vision_with_tasks_async))


def build_vision_stats_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision stats command."""
    stats_parser = add_documented_parser(
        vision_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("Show vision stats"),
            description=_("Show task counts and effort totals for one vision."),
            examples=("lifeos vision stats 11111111-1111-1111-1111-111111111111",),
            notes=(
                _("Counts and effort totals aggregate all active tasks linked to the vision."),
                _("Use `with-tasks` when you need the row-level task list instead of totals."),
            ),
        ),
    )
    stats_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    stats_parser.set_defaults(handler=make_sync_handler(handle_vision_stats_async))
