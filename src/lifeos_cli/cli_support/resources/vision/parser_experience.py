"""Builder helpers for vision experience commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.resources.vision.handlers import (
    handle_vision_add_experience_async,
    handle_vision_harvest_async,
    handle_vision_sync_experience_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_vision_add_experience_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision add-experience command."""
    add_experience_parser = add_documented_parser(
        vision_subparsers,
        "add-experience",
        help_content=HelpContent(
            summary=_("Add vision experience"),
            description=_("Add manual experience points to an active vision."),
            examples=(
                "lifeos vision add-experience 11111111-1111-1111-1111-111111111111 --points 120",
            ),
            notes=(
                _("Use this for explicit manual credit rather than for task-effort recalculation."),
                _("Use `sync-experience` when experience should be recomputed from task effort."),
            ),
        ),
    )
    add_experience_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    add_experience_parser.add_argument(
        "--points",
        dest="experience_points",
        type=int,
        required=True,
        help=_("Experience points to add"),
    )
    add_experience_parser.set_defaults(
        handler=make_sync_handler(handle_vision_add_experience_async)
    )


def build_vision_sync_experience_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision sync-experience command."""
    sync_experience_parser = add_documented_parser(
        vision_subparsers,
        "sync-experience",
        help_content=HelpContent(
            summary=_("Sync vision experience"),
            description=_("Synchronize experience points from root task actual effort totals."),
            examples=("lifeos vision sync-experience 11111111-1111-1111-1111-111111111111",),
            notes=(
                _(
                    "Use this after task effort changes when vision experience should match "
                    "current root-task actual effort."
                ),
                _(
                    "The effective hourly rate comes from the vision override when set, "
                    "otherwise from preferences."
                ),
            ),
        ),
    )
    sync_experience_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    sync_experience_parser.set_defaults(
        handler=make_sync_handler(handle_vision_sync_experience_async)
    )


def build_vision_harvest_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision harvest command."""
    harvest_parser = add_documented_parser(
        vision_subparsers,
        "harvest",
        help_content=HelpContent(
            summary=_("Harvest a vision"),
            description=_("Convert a mature active vision to fruit status."),
            examples=("lifeos vision harvest 11111111-1111-1111-1111-111111111111",),
            notes=(
                _(
                    "This command succeeds only when the vision is active and already at final "
                    "stage."
                ),
                _("A successful harvest changes the vision status from `active` to `fruit`."),
            ),
        ),
    )
    harvest_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    harvest_parser.set_defaults(handler=make_sync_handler(handle_vision_harvest_async))
