"""Vision resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.vision.handlers import (
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
                "Create and maintain high-level containers composed of one or more task trees.\n\n"
                "A vision is broader than a single task and usually lives under an area."
            ),
            examples=(
                'lifeos vision add "Launch lifeos-cli" '
                "--area-id 11111111-1111-1111-1111-111111111111",
                "lifeos vision list --status active",
            ),
            notes=(
                "Use `list` as the primary query entrypoint for this resource.",
                "Visions are intended to group related task trees.",
                "Use the `batch` namespace for multi-record write operations.",
                "Delete operations in the CLI always perform soft deletion.",
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
            description=(
                "Create a new vision.\n\n"
                "Visions usually represent medium- or long-running themes that will "
                "own multiple tasks."
            ),
            examples=(
                'lifeos vision add "Launch lifeos-cli" '
                "--area-id 11111111-1111-1111-1111-111111111111",
                'lifeos vision add "Improve sleep quality" --status active',
                'lifeos vision add "Strengthen family rhythm" '
                "--person-id 11111111-1111-1111-1111-111111111111",
            ),
        ),
    )
    add_parser.add_argument("name", help="Vision name")
    add_parser.add_argument("--description", help="Optional vision description")
    add_parser.add_argument("--status", default="active", help="Vision status")
    add_parser.add_argument("--area-id", type=UUID, help="Owning area identifier")
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to associate one or more people",
    )
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
            description=(
                "List visions with optional status or area filters.\n\n"
                "Use this as the main query entrypoint for visions."
            ),
            examples=(
                "lifeos vision list",
                "lifeos vision list --status active",
                "lifeos vision list --person-id 11111111-1111-1111-1111-111111111111",
                "lifeos vision list --area-id 11111111-1111-1111-1111-111111111111 --limit 20",
            ),
        ),
    )
    list_parser.add_argument("--status", help="Filter by status")
    list_parser.add_argument("--area-id", type=UUID, help="Filter by area identifier")
    list_parser.add_argument("--person-id", type=UUID, help="Filter by linked person identifier")
    add_include_deleted_argument(list_parser, noun="visions")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=handle_vision_list)

    show_parser = add_documented_parser(
        vision_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show a vision",
            description="Show one vision with full metadata.",
            examples=(
                "lifeos vision show 11111111-1111-1111-1111-111111111111",
                "lifeos vision show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("vision_id", type=UUID, help="Vision identifier")
    add_include_deleted_argument(show_parser, noun="visions", help_prefix="Allow")
    show_parser.set_defaults(handler=handle_vision_show)

    update_parser = add_documented_parser(
        vision_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update a vision",
            description=(
                "Update mutable vision fields.\n\n"
                "Only explicitly provided flags are changed; omitted values are preserved."
            ),
            examples=(
                "lifeos vision update 11111111-1111-1111-1111-111111111111 "
                '--name "Ship lifeos-cli"',
                "lifeos vision update 11111111-1111-1111-1111-111111111111 --status archived",
                "lifeos vision update 11111111-1111-1111-1111-111111111111 "
                "--person-id 11111111-1111-1111-1111-111111111111",
                "lifeos vision update 11111111-1111-1111-1111-111111111111 --clear-area",
            ),
            notes=(
                "Valid statuses currently include `active`, `archived`, and `fruit`.",
                "Use `--clear-*` flags to remove optional values, including people.",
            ),
        ),
    )
    update_parser.add_argument("vision_id", type=UUID, help="Vision identifier")
    update_parser.add_argument("--name", help="Updated vision name")
    update_parser.add_argument("--description", help="Updated vision description")
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help="Clear the optional vision description",
    )
    update_parser.add_argument("--status", help="Updated status")
    update_parser.add_argument("--area-id", type=UUID, help="Updated area identifier")
    update_parser.add_argument(
        "--clear-area",
        action="store_true",
        help="Clear the optional area reference",
    )
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help="Repeat to replace people with one or more identifiers",
    )
    update_parser.add_argument("--clear-people", action="store_true", help="Remove all people")
    update_parser.add_argument(
        "--experience-rate-per-hour", type=int, help="Updated experience rate"
    )
    update_parser.add_argument(
        "--clear-experience-rate",
        action="store_true",
        help="Clear the optional experience rate",
    )
    update_parser.set_defaults(handler=handle_vision_update)

    delete_parser = add_documented_parser(
        vision_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete a vision",
            description=(
                "Soft-delete a vision.\n\n"
                "The record remains in the database and can still be inspected with "
                "deleted-aware commands."
            ),
            examples=("lifeos vision delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("vision_id", type=UUID, help="Vision identifier")
    delete_parser.set_defaults(handler=handle_vision_delete)

    batch_parser = add_documented_parser(
        vision_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch vision operations",
            description=(
                "Run write operations that target multiple visions in one command.\n\n"
                "Use this namespace for bulk maintenance instead of adding many top-level verbs."
            ),
            examples=(
                "lifeos vision batch delete --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222",
            ),
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
            description="Soft-delete multiple visions by identifier.",
            notes=("Batch delete never performs hard deletion from the public CLI.",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="vision_ids", noun="vision")
    batch_delete_parser.set_defaults(handler=handle_vision_batch_delete)
