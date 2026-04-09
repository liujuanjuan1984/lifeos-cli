"""Vision resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.vision_handlers import (
    handle_vision_add,
    handle_vision_batch_delete,
    handle_vision_delete,
    handle_vision_list,
    handle_vision_show,
    handle_vision_update,
)


def build_vision_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the vision command tree."""
    vision_parser = add_documented_parser(
        subparsers,
        "vision",
        help_content=HelpContent(
            summary="Manage visions",
            description=(
                "Create and maintain high-level containers composed of one or more task trees."
            ),
            examples=(
                'lifeos vision add "Launch lifeos-cli" '
                "--area-id 11111111-1111-1111-1111-111111111111",
                "lifeos vision list --status active",
            ),
            notes=(
                "Use `list` as the primary query entrypoint for this resource.",
                "Use the `batch` namespace for multi-record write operations.",
            ),
        ),
    )
    vision_parser.set_defaults(handler=make_help_handler(vision_parser))
    vision_subparsers = vision_parser.add_subparsers(
        dest="vision_command",
        title="actions",
        metavar="action",
    )

    add_parser = add_documented_parser(
        vision_subparsers,
        "add",
        help_content=HelpContent(
            summary="Create a vision",
            description="Create a new vision.",
        ),
    )
    add_parser.add_argument("name", help="Vision name")
    add_parser.add_argument("--description", help="Optional vision description")
    add_parser.add_argument("--status", default="active", help="Vision status")
    add_parser.add_argument("--area-id", type=UUID, help="Owning area identifier")
    add_parser.add_argument(
        "--experience-rate-per-hour",
        type=int,
        help="Optional experience rate",
    )
    add_parser.set_defaults(handler=handle_vision_add)

    list_parser = add_documented_parser(
        vision_subparsers,
        "list",
        help_content=HelpContent(
            summary="List visions",
            description="List visions with optional status or area filters.",
        ),
    )
    list_parser.add_argument("--status", help="Filter by status")
    list_parser.add_argument("--area-id", type=UUID, help="Filter by area identifier")
    list_parser.add_argument(
        "--include-deleted", action="store_true", help="Include soft-deleted visions"
    )
    list_parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Maximum number of rows",
    )
    list_parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help="Number of rows to skip",
    )
    list_parser.set_defaults(handler=handle_vision_list)

    show_parser = add_documented_parser(
        vision_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show a vision", description="Show one vision with full metadata."
        ),
    )
    show_parser.add_argument("vision_id", type=UUID, help="Vision identifier")
    show_parser.add_argument(
        "--include-deleted",
        action="store_true",
        help="Allow deleted visions",
    )
    show_parser.set_defaults(handler=handle_vision_show)

    update_parser = add_documented_parser(
        vision_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update a vision", description="Update mutable vision fields."
        ),
    )
    update_parser.add_argument("vision_id", type=UUID, help="Vision identifier")
    update_parser.add_argument("--name", help="Updated vision name")
    update_parser.add_argument("--description", help="Updated vision description")
    update_parser.add_argument("--status", help="Updated status")
    update_parser.add_argument("--area-id", type=UUID, help="Updated area identifier")
    update_parser.add_argument(
        "--experience-rate-per-hour", type=int, help="Updated experience rate"
    )
    update_parser.set_defaults(handler=handle_vision_update)

    delete_parser = add_documented_parser(
        vision_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete a vision",
            description="Soft-delete a vision.",
        ),
    )
    delete_parser.add_argument("vision_id", type=UUID, help="Vision identifier")
    delete_parser.set_defaults(handler=handle_vision_delete)

    batch_parser = add_documented_parser(
        vision_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch vision operations",
            description="Run write operations that target multiple visions in one command.",
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="vision_batch_command",
        title="batch actions",
        metavar="batch_action",
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete multiple visions",
            description="Soft-delete multiple visions.",
        ),
    )
    batch_delete_parser.add_argument(
        "--ids",
        dest="vision_ids",
        type=UUID,
        nargs="+",
        required=True,
        help="Vision identifiers to delete",
    )
    batch_delete_parser.set_defaults(handler=handle_vision_batch_delete)
