"""Tag resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.tag.handlers import (
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
            description=(
                "Create and maintain tags for notes, people, visions, tasks, and areas.\n\n"
                "Tags provide cross-cutting classification across otherwise separate domains."
            ),
            examples=(
                'lifeos tag add "family" --entity-type person --category relation',
                "lifeos tag list --entity-type note",
            ),
            notes=(
                "Use `list` as the primary query entrypoint for this resource.",
                "A tag is scoped by name, entity type, and category.",
                "Use the `batch` namespace for multi-record write operations.",
                "Delete operations in the CLI always perform soft deletion.",
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
        help_content=HelpContent(
            summary="Create a tag",
            description=(
                "Create a new tag.\n\n"
                "Tags are intended for structured labeling, not free-form note content."
            ),
            examples=(
                'lifeos tag add "family" --entity-type person --category relation',
                'lifeos tag add "urgent" --entity-type task --color "#DC2626"',
            ),
        ),
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
            summary="List tags",
            description=(
                "List tags with optional filters.\n\n"
                "Use entity type and category to narrow the result set before inspecting "
                "one tag in detail."
            ),
            examples=(
                "lifeos tag list",
                "lifeos tag list --entity-type person",
                "lifeos tag list --entity-type task --category priority --limit 20",
            ),
            notes=("Use `--include-deleted` to review previously deleted tags.",),
        ),
    )
    list_parser.add_argument("--entity-type", help="Filter by entity type")
    list_parser.add_argument("--category", help="Filter by category")
    add_include_deleted_argument(list_parser, noun="tags")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=handle_tag_list)

    show_parser = add_documented_parser(
        tag_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show a tag",
            description="Show one tag with full metadata.",
            examples=(
                "lifeos tag show 11111111-1111-1111-1111-111111111111",
                "lifeos tag show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("tag_id", type=UUID, help="Tag identifier")
    add_include_deleted_argument(show_parser, noun="tags", help_prefix="Allow")
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
            description=(
                "Soft-delete a tag.\n\n"
                "This keeps historical references recoverable while removing the tag "
                "from normal views."
            ),
            examples=("lifeos tag delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("tag_id", type=UUID, help="Tag identifier")
    delete_parser.set_defaults(handler=handle_tag_delete)

    batch_parser = add_documented_parser(
        tag_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch tag operations",
            description=(
                "Run write operations that target multiple tags in one command.\n\n"
                "Use this namespace for bulk maintenance rather than adding many top-level verbs."
            ),
            examples=(
                "lifeos tag batch delete --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222",
            ),
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
            description="Soft-delete multiple tags by identifier.",
            notes=("Batch delete never performs hard deletion from the public CLI.",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="tag_ids", noun="tag")
    batch_delete_parser.set_defaults(handler=handle_tag_batch_delete)
