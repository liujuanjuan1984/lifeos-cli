"""Vision resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
)
from lifeos_cli.cli_support.resources.vision.parser_actions import (
    build_vision_add_parser,
    build_vision_delete_parser,
    build_vision_list_parser,
    build_vision_show_parser,
    build_vision_update_parser,
)
from lifeos_cli.cli_support.resources.vision.parser_batch import build_vision_batch_parser
from lifeos_cli.cli_support.resources.vision.parser_experience import (
    build_vision_add_experience_parser,
    build_vision_harvest_parser,
    build_vision_sync_experience_parser,
)
from lifeos_cli.cli_support.resources.vision.parser_read_models import (
    build_vision_stats_parser,
    build_vision_with_tasks_parser,
)
from lifeos_cli.i18n import gettext_message as _


def build_vision_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the vision command tree."""
    vision_parser = add_documented_help_parser(
        subparsers,
        "vision",
        help_content=HelpContent(
            summary=_("Manage visions"),
            description=(
                _("Create and maintain high-level containers composed of one or more task trees.")
                + "\n\n"
                + _("A vision is broader than a single task and usually lives under an area.")
            ),
            examples=(
                "lifeos vision add --help",
                "lifeos vision list --help",
                "lifeos vision batch --help",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for this resource."),
                _("Visions are intended to group related task trees."),
                _("See `lifeos vision batch --help` for bulk delete operations."),
            ),
        ),
    )
    vision_subparsers = vision_parser.add_subparsers(
        dest="vision_command",
        title=_("actions"),
        metavar=_("action"),
    )

    build_vision_add_parser(vision_subparsers)
    build_vision_list_parser(vision_subparsers)
    build_vision_show_parser(vision_subparsers)
    build_vision_with_tasks_parser(vision_subparsers)
    build_vision_stats_parser(vision_subparsers)
    build_vision_update_parser(vision_subparsers)
    build_vision_add_experience_parser(vision_subparsers)
    build_vision_sync_experience_parser(vision_subparsers)
    build_vision_harvest_parser(vision_subparsers)
    build_vision_delete_parser(vision_subparsers)
    build_vision_batch_parser(vision_subparsers)
