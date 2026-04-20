"""Area resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.area.handlers import (
    AREA_SUMMARY_COLUMNS,
    handle_area_add_async,
    handle_area_batch_delete_async,
    handle_area_delete_async,
    handle_area_list_async,
    handle_area_show_async,
    handle_area_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_area_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the area command tree."""
    area_parser = add_documented_help_parser(
        subparsers,
        "area",
        help_content=HelpContent(
            summary=_("Manage life areas"),
            description=(
                _(
                    "Create and maintain high-level life areas such as work, health, or "
                    "relationships."
                )
                + "\n\n"
                + _(
                    "Areas provide one of the top-level organizing layers for the rest of the "
                    "system."
                )
            ),
            examples=(
                "lifeos area add --help",
                "lifeos area list --help",
                "lifeos area batch --help",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for this resource."),
                _("Use areas to group visions and other higher-level planning objects."),
                _("See `lifeos area batch --help` for bulk delete operations."),
            ),
        ),
    )
    area_subparsers = area_parser.add_subparsers(
        dest="area_command", title=_("actions"), metavar=_("action")
    )

    add_parser = add_documented_parser(
        area_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create an area"),
            description=(
                _("Create a new area.")
                + "\n\n"
                + _(
                    "Areas usually represent stable parts of life such as health, work, family, "
                    "or learning."
                )
            ),
            examples=(
                'lifeos area add "Health"',
                'lifeos area add "Deep Work" --color "#2563EB" --icon brain --display-order 10',
                'lifeos area add "Travel" --inactive',
            ),
            notes=(_("Use `--inactive` when the area should exist but not appear as active yet."),),
        ),
    )
    add_parser.add_argument("name", help=_("Area name"))
    add_parser.add_argument("--description", help=_("Optional area description"))
    add_parser.add_argument("--color", default="#3B82F6", help=_("Hex color code"))
    add_parser.add_argument("--icon", help=_("Optional icon identifier"))
    add_parser.add_argument(
        "--inactive", action="store_true", help=_("Create the area as inactive")
    )
    add_parser.add_argument("--display-order", type=int, default=0, help=_("Display order"))
    add_parser.set_defaults(handler=make_sync_handler(handle_area_add_async))

    list_parser = add_documented_parser(
        area_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List areas"),
            description=(
                _("List areas in display order.")
                + "\n\n"
                + _(
                    "Use filters and pagination flags here instead of expecting a separate "
                    "search command."
                )
            ),
            examples=(
                "lifeos area list",
                "lifeos area list --include-inactive",
                "lifeos area list --include-deleted --limit 20 --offset 20",
            ),
            notes=(
                _("Soft-deleted areas are hidden unless `--include-deleted` is set."),
                _(
                    "When results exist, the list command prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(AREA_SUMMARY_COLUMNS)),
                _("Use `--limit` and `--offset` together for pagination."),
            ),
        ),
    )
    add_include_deleted_argument(list_parser, noun="areas")
    list_parser.add_argument(
        "--include-inactive", action="store_true", help=_("Include inactive areas")
    )
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_area_list_async))

    show_parser = add_documented_parser(
        area_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show an area"),
            description=(
                _("Show one area with full metadata.")
                + "\n\n"
                + _(
                    "Use this action when you need exact field values instead of the compact "
                    "list view."
                )
            ),
            examples=(
                "lifeos area show 11111111-1111-1111-1111-111111111111",
                "lifeos area show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
            notes=(_("Use `--include-deleted` to inspect a soft-deleted area."),),
        ),
    )
    show_parser.add_argument("area_id", type=UUID, help=_("Area identifier"))
    add_include_deleted_argument(show_parser, noun="areas", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_area_show_async))

    update_parser = add_documented_parser(
        area_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update an area"),
            description=(
                _("Update mutable area fields.")
                + "\n\n"
                + _("Only explicitly provided flags are changed; omitted fields stay as they are.")
            ),
            examples=(
                'lifeos area update 11111111-1111-1111-1111-111111111111 --name "Fitness"',
                "lifeos area update 11111111-1111-1111-1111-111111111111 "
                "--display-order 20 --active",
                "lifeos area update 11111111-1111-1111-1111-111111111111 --clear-description",
                "lifeos area update 11111111-1111-1111-1111-111111111111 --clear-icon",
            ),
            notes=(_("Use `--clear-description` or `--clear-icon` to remove optional values."),),
        ),
    )
    update_parser.add_argument("area_id", type=UUID, help=_("Area identifier"))
    update_parser.add_argument("--name", help=_("Updated area name"))
    update_parser.add_argument("--description", help=_("Updated description"))
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("Clear the optional area description"),
    )
    update_parser.add_argument("--color", help=_("Updated hex color code"))
    update_parser.add_argument("--icon", help=_("Updated icon identifier"))
    update_parser.add_argument(
        "--clear-icon",
        action="store_true",
        help=_("Clear the optional icon identifier"),
    )
    update_parser.add_argument(
        "--active",
        action=argparse.BooleanOptionalAction,
        default=None,
        help=_("Toggle whether the area is active"),
    )
    update_parser.add_argument("--display-order", type=int, help=_("Updated display order"))
    update_parser.set_defaults(handler=make_sync_handler(handle_area_update_async))

    delete_parser = add_documented_parser(
        area_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete an area"),
            description=(
                _("Soft-delete an area.")
                + "\n\n"
                + _(
                    "The record remains in the database and can still be inspected through "
                    "`list --include-deleted` or `show --include-deleted`."
                )
            ),
            examples=("lifeos area delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("area_id", type=UUID, help=_("Area identifier"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_area_delete_async))

    batch_parser = add_documented_help_parser(
        area_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch area operations"),
            description=_("Soft-delete multiple areas in one command."),
            examples=(
                "lifeos area batch delete --help",
                "lifeos area batch delete --ids <area-id-1> <area-id-2>",
            ),
            notes=(_("This namespace currently exposes only the `delete` workflow."),),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="area_batch_command",
        title=_("batch actions"),
        metavar=_("batch_action"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple areas"),
            description=_("Soft-delete multiple areas by identifier."),
            examples=("lifeos area batch delete --ids <area-id-1> <area-id-2>",),
            notes=(_("Batch delete never performs hard deletion from the public CLI."),),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="area_ids", noun="area")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_area_batch_delete_async))
