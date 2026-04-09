"""Tag resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.shared import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.tag_handlers import (
    handle_tag_add,
    handle_tag_batch_delete,
    handle_tag_delete,
    handle_tag_list,
    handle_tag_show,
    handle_tag_update,
)


def build_tag_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the tag command tree."""
    tag_parser = add_documented_parser(
        subparsers,
        "tag",
        help_content=HelpContent(
            summary="Manage tags",
            description="Create and maintain tags for notes, people, visions, tasks, and areas.",
            examples=(
                'lifeos tag add "family" --entity-type person --category relation',
                "lifeos tag list --entity-type note",
            ),
            notes=(
                "Use `list` as the primary query entrypoint for this resource.",
                "Use the `batch` namespace for multi-record write operations.",
            ),
        ),
    )
    tag_parser.set_defaults(handler=make_help_handler(tag_parser))
    tag_subparsers = tag_parser.add_subparsers(
        dest="tag_command", title="actions", metavar="action"
    )

    add_parser = add_documented_parser(
        tag_subparsers,
        "add",
        help_content=HelpContent(summary="Create a tag", description="Create a new tag."),
    )
    add_parser.add_argument("name", help="Tag name")
    add_parser.add_argument("--entity-type", required=True, help="Target entity type")
    add_parser.add_argument("--category", default="general", help="Tag category")
    add_parser.add_argument("--description", help="Optional tag description")
    add_parser.add_argument("--color", help="Optional hex color code")
    add_parser.set_defaults(handler=handle_tag_add)

    list_parser = add_documented_parser(
        tag_subparsers,
        "list",
        help_content=HelpContent(
            summary="List tags", description="List tags with optional filters."
        ),
    )
    list_parser.add_argument("--entity-type", help="Filter by entity type")
    list_parser.add_argument("--category", help="Filter by category")
    list_parser.add_argument(
        "--include-deleted", action="store_true", help="Include soft-deleted tags"
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
    list_parser.set_defaults(handler=handle_tag_list)

    show_parser = add_documented_parser(
        tag_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show a tag", description="Show one tag with full metadata."
        ),
    )
    show_parser.add_argument("tag_id", type=UUID, help="Tag identifier")
    show_parser.add_argument(
        "--include-deleted",
        action="store_true",
        help="Allow deleted tags",
    )
    show_parser.set_defaults(handler=handle_tag_show)

    update_parser = add_documented_parser(
        tag_subparsers,
        "update",
        help_content=HelpContent(summary="Update a tag", description="Update mutable tag fields."),
    )
    update_parser.add_argument("tag_id", type=UUID, help="Tag identifier")
    update_parser.add_argument("--name", help="Updated tag name")
    update_parser.add_argument("--entity-type", help="Updated entity type")
    update_parser.add_argument("--category", help="Updated tag category")
    update_parser.add_argument("--description", help="Updated tag description")
    update_parser.add_argument("--color", help="Updated hex color code")
    update_parser.set_defaults(handler=handle_tag_update)

    delete_parser = add_documented_parser(
        tag_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete a tag",
            description="Soft-delete a tag.",
        ),
    )
    delete_parser.add_argument("tag_id", type=UUID, help="Tag identifier")
    delete_parser.set_defaults(handler=handle_tag_delete)

    batch_parser = add_documented_parser(
        tag_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch tag operations",
            description="Run write operations that target multiple tags in one command.",
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="tag_batch_command",
        title="batch actions",
        metavar="batch_action",
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete multiple tags",
            description="Soft-delete multiple tags.",
        ),
    )
    batch_delete_parser.add_argument(
        "--ids",
        dest="tag_ids",
        type=UUID,
        nargs="+",
        required=True,
        help="Tag identifiers to delete",
    )
    batch_delete_parser.set_defaults(handler=handle_tag_batch_delete)
