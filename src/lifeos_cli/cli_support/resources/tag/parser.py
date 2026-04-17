"""Tag resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.tag.handlers import (
    TAG_SUMMARY_COLUMNS,
    handle_tag_add_async,
    handle_tag_batch_delete_async,
    handle_tag_delete_async,
    handle_tag_list_async,
    handle_tag_show_async,
    handle_tag_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_tag_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the tag command tree."""
    tag_parser = add_documented_parser(
        subparsers,
        "tag",
        help_content=HelpContent(
            summary=_("Manage tags"),
            description=(
                _("Create and maintain tags for notes, people, visions, tasks, and areas.")
                + "\n\n"
                + _("Tags provide cross-cutting classification across otherwise separate domains.")
            ),
            examples=(
                "lifeos tag add --help",
                "lifeos tag list --help",
                "lifeos tag batch --help",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for this resource."),
                _("A tag is scoped by name, entity type, and category."),
                _("See `lifeos tag batch --help` for bulk delete operations."),
            ),
        ),
    )
    tag_parser.set_defaults(handler=make_help_handler(tag_parser))
    tag_subparsers = tag_parser.add_subparsers(
        dest="tag_command", title=_("actions"), metavar=_("action")
    )

    add_parser = add_documented_parser(
        tag_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create a tag"),
            description=(
                _("Create a new tag.")
                + "\n\n"
                + _("Tags are intended for structured labeling, not free-form note content.")
            ),
            examples=(
                'lifeos tag add "family" --entity-type person --category relation',
                'lifeos tag add "urgent" --entity-type task --color "#DC2626"',
                "lifeos tag add "
                '"coach" --entity-type vision --person-id '
                "11111111-1111-1111-1111-111111111111",
                "lifeos tag add "
                '"shared" --entity-type task --person-id '
                "11111111-1111-1111-1111-111111111111 "
                "--person-id 22222222-2222-2222-2222-222222222222",
            ),
            notes=(
                _(
                    "Repeat the same `--person-id` flag to associate multiple people in one "
                    "command."
                ),
            ),
        ),
    )
    add_parser.add_argument("name", help=_("Tag name"))
    add_parser.add_argument("--entity-type", required=True, help=_("Target entity type"))
    add_parser.add_argument("--category", default="general", help=_("Tag category"))
    add_parser.add_argument("--description", help=_("Optional tag description"))
    add_parser.add_argument("--color", help=_("Optional hex color code"))
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to associate one or more people"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_tag_add_async))

    list_parser = add_documented_parser(
        tag_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List tags"),
            description=(
                _("List tags with optional filters.")
                + "\n\n"
                + _(
                    "Use entity type and category to narrow the result set before inspecting "
                    "one tag in detail."
                )
            ),
            examples=(
                "lifeos tag list",
                "lifeos tag list --entity-type person",
                "lifeos tag list --person-id 11111111-1111-1111-1111-111111111111",
                "lifeos tag list --entity-type task --category priority --limit 20",
            ),
            notes=(
                _("Use `--include-deleted` to review previously deleted tags."),
                _(
                    "When results exist, the list command prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(TAG_SUMMARY_COLUMNS)),
            ),
        ),
    )
    list_parser.add_argument("--entity-type", help=_("Filter by entity type"))
    list_parser.add_argument("--category", help=_("Filter by category"))
    list_parser.add_argument("--person-id", type=UUID, help=_("Filter by linked person identifier"))
    add_include_deleted_argument(list_parser, noun="tags")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_tag_list_async))

    show_parser = add_documented_parser(
        tag_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show a tag"),
            description=_("Show one tag with full metadata."),
            examples=(
                "lifeos tag show 11111111-1111-1111-1111-111111111111",
                "lifeos tag show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("tag_id", type=UUID, help=_("Tag identifier"))
    add_include_deleted_argument(show_parser, noun="tags", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_tag_show_async))

    update_parser = add_documented_parser(
        tag_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update a tag"),
            description=(
                _("Update mutable tag fields.")
                + "\n\n"
                + _("Only explicitly provided flags are changed; omitted values are preserved.")
            ),
            examples=(
                'lifeos tag update 11111111-1111-1111-1111-111111111111 --name "urgent"',
                "lifeos tag update 11111111-1111-1111-1111-111111111111 "
                "--person-id 11111111-1111-1111-1111-111111111111",
                "lifeos tag update 11111111-1111-1111-1111-111111111111 "
                "--person-id 11111111-1111-1111-1111-111111111111 "
                "--person-id 22222222-2222-2222-2222-222222222222",
                "lifeos tag update 11111111-1111-1111-1111-111111111111 --clear-color",
            ),
            notes=(
                _(
                    "Use `--clear-description`, `--clear-color`, or `--clear-people` "
                    "to remove optional values."
                ),
                _("Repeat the same `--person-id` flag to replace multiple linked people."),
            ),
        ),
    )
    update_parser.add_argument("tag_id", type=UUID, help=_("Tag identifier"))
    update_parser.add_argument("--name", help=_("Updated tag name"))
    update_parser.add_argument("--entity-type", help=_("Updated entity type"))
    update_parser.add_argument("--category", help=_("Updated tag category"))
    update_parser.add_argument("--description", help=_("Updated tag description"))
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("Clear the optional tag description"),
    )
    update_parser.add_argument("--color", help=_("Updated hex color code"))
    update_parser.add_argument(
        "--clear-color",
        action="store_true",
        help=_("Clear the optional tag color"),
    )
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to replace people with one or more identifiers"),
    )
    update_parser.add_argument("--clear-people", action="store_true", help=_("Remove all people"))
    update_parser.set_defaults(handler=make_sync_handler(handle_tag_update_async))

    delete_parser = add_documented_parser(
        tag_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete a tag"),
            description=(
                _("Soft-delete a tag.")
                + "\n\n"
                + _(
                    "This keeps historical references recoverable while removing the tag "
                    "from normal views."
                )
            ),
            examples=("lifeos tag delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("tag_id", type=UUID, help=_("Tag identifier"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_tag_delete_async))

    batch_parser = add_documented_parser(
        tag_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch tag operations"),
            description=_("Soft-delete multiple tags in one command."),
            examples=(
                "lifeos tag batch delete --help",
                "lifeos tag batch delete --ids <tag-id-1> <tag-id-2>",
            ),
            notes=(_("This namespace currently exposes only the `delete` workflow."),),
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="tag_batch_command",
        title=_("batch actions"),
        metavar=_("batch_action"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple tags"),
            description=_("Soft-delete multiple tags by identifier."),
            notes=(_("Batch delete never performs hard deletion from the public CLI."),),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="tag_ids", noun="tag")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_tag_batch_delete_async))
