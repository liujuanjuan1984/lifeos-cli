"""Area resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.area.handlers import (
    handle_area_add,
    handle_area_batch_delete,
    handle_area_delete,
    handle_area_list,
    handle_area_show,
    handle_area_update,
)


def build_area_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the area command tree."""
    area_parser = add_documented_parser(
        subparsers,
        "area",
        help_content=HelpContent(
            summary="Manage life areas",
            description=(
                "Create and maintain high-level life areas such as work, health, or "
                "relationships.\n\n"
                "Areas provide one of the top-level organizing layers for the rest of the system."
            ),
            examples=(
                'lifeos area add "Health" --color "#16A34A"',
                "lifeos area list",
                "lifeos area show 11111111-1111-1111-1111-111111111111",
                "lifeos area batch delete --ids 11111111-1111-1111-1111-111111111111",
            ),
            notes=(
                "Use `list` as the primary query entrypoint for this resource.",
                "Use areas to group visions and other higher-level planning objects.",
                "Use the `batch` namespace for multi-record write operations.",
                "Delete operations in the CLI always perform soft deletion.",
            ),
        ),
    )
    area_parser.set_defaults(handler=make_help_handler(area_parser))
    area_subparsers = area_parser.add_subparsers(
        dest="area_command", title="actions", metavar="action"
    )

    add_parser = add_documented_parser(
        area_subparsers,
        "add",
        help_content=HelpContent(
            summary="Create an area",
            description=(
                "Create a new area.\n\n"
                "Areas usually represent stable parts of life such as health, work, family, "
                "or learning."
            ),
            examples=(
                'lifeos area add "Health"',
                'lifeos area add "Deep Work" --color "#2563EB" --icon brain --display-order 10',
                'lifeos area add "Travel" --inactive',
            ),
            notes=("Use `--inactive` when the area should exist but not appear as active yet.",),
        ),
    )
    add_parser.add_argument("name", help="Area name")
    add_parser.add_argument("--description", help="Optional area description")
    add_parser.add_argument("--color", default="#3B82F6", help="Hex color code")
    add_parser.add_argument("--icon", help="Optional icon identifier")
    add_parser.add_argument("--inactive", action="store_true", help="Create the area as inactive")
    add_parser.add_argument("--display-order", type=int, default=0, help="Display order")
    add_parser.set_defaults(handler=handle_area_add)

    list_parser = add_documented_parser(
        area_subparsers,
        "list",
        help_content=HelpContent(
            summary="List areas",
            description=(
                "List areas in display order.\n\n"
                "Use filters and pagination flags here instead of expecting a separate "
                "search command."
            ),
            examples=(
                "lifeos area list",
                "lifeos area list --include-inactive",
                "lifeos area list --include-deleted --limit 20 --offset 20",
            ),
            notes=(
                "Soft-deleted areas are hidden unless `--include-deleted` is set.",
                "Use `--limit` and `--offset` together for pagination.",
            ),
        ),
    )
    add_include_deleted_argument(list_parser, noun="areas")
    list_parser.add_argument(
        "--include-inactive", action="store_true", help="Include inactive areas"
    )
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=handle_area_list)

    show_parser = add_documented_parser(
        area_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show an area",
            description=(
                "Show one area with full metadata.\n\n"
                "Use this action when you need exact field values instead of the compact list view."
            ),
            examples=(
                "lifeos area show 11111111-1111-1111-1111-111111111111",
                "lifeos area show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
            notes=("Use `--include-deleted` to inspect a soft-deleted area.",),
        ),
    )
    show_parser.add_argument("area_id", type=UUID, help="Area identifier")
    add_include_deleted_argument(show_parser, noun="areas", help_prefix="Allow")
    show_parser.set_defaults(handler=handle_area_show)

    update_parser = add_documented_parser(
        area_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update an area",
            description=(
                "Update mutable area fields.\n\n"
                "Only explicitly provided flags are changed; omitted fields stay as they are."
            ),
            examples=(
                'lifeos area update 11111111-1111-1111-1111-111111111111 --name "Fitness"',
                "lifeos area update 11111111-1111-1111-1111-111111111111 "
                "--display-order 20 --active",
            ),
        ),
    )
    update_parser.add_argument("area_id", type=UUID, help="Area identifier")
    update_parser.add_argument("--name", help="Updated area name")
    update_parser.add_argument("--description", help="Updated description")
    update_parser.add_argument("--color", help="Updated hex color code")
    update_parser.add_argument("--icon", help="Updated icon identifier")
    update_parser.add_argument(
        "--active",
        action=argparse.BooleanOptionalAction,
        default=None,
        help="Toggle whether the area is active",
    )
    update_parser.add_argument("--display-order", type=int, help="Updated display order")
    update_parser.set_defaults(handler=handle_area_update)

    delete_parser = add_documented_parser(
        area_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete an area",
            description=(
                "Soft-delete an area.\n\n"
                "The record remains in the database and can still be inspected through "
                "`list --include-deleted` or `show --include-deleted`."
            ),
            examples=("lifeos area delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("area_id", type=UUID, help="Area identifier")
    delete_parser.set_defaults(handler=handle_area_delete)

    batch_parser = add_documented_parser(
        area_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch area operations",
            description=(
                "Run write operations that target multiple areas in one command.\n\n"
                "Use this namespace for bulk maintenance so the resource keeps a stable CLI shape."
            ),
            examples=(
                "lifeos area batch delete --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222",
            ),
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="area_batch_command",
        title="batch actions",
        metavar="batch_action",
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete multiple areas",
            description="Soft-delete multiple areas by identifier.",
            notes=("Batch delete never performs hard deletion from the public CLI.",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="area_ids", noun="area")
    batch_delete_parser.set_defaults(handler=handle_area_batch_delete)
