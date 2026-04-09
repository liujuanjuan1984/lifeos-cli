"""People resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.parser_common import (
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.people_handlers import (
    handle_people_add,
    handle_people_batch_delete,
    handle_people_delete,
    handle_people_list,
    handle_people_show,
    handle_people_update,
)


def build_people_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the people command tree."""
    people_parser = add_documented_parser(
        subparsers,
        "people",
        help_content=HelpContent(
            summary="Manage people and relationships",
            description="Create and maintain people records for your social context.",
            examples=(
                'lifeos people add "Alice" --nickname ally --location Toronto',
                "lifeos people list --search ali",
            ),
            notes=(
                "`people` is the intentional CLI resource name for this domain.",
                "Use `list` as the primary query entrypoint for this resource.",
                "Use the `batch` namespace for multi-record write operations.",
            ),
        ),
    )
    people_parser.set_defaults(handler=make_help_handler(people_parser))
    people_subparsers = people_parser.add_subparsers(
        dest="people_command", title="actions", metavar="action"
    )

    add_parser = add_documented_parser(
        people_subparsers,
        "add",
        help_content=HelpContent(summary="Create a person", description="Create a new person."),
    )
    add_parser.add_argument("name", help="Person name")
    add_parser.add_argument("--description", help="Optional person description")
    add_parser.add_argument("--nickname", action="append", help="Nickname or alias, repeatable")
    add_parser.add_argument("--birth-date", help="Birth date in ISO format YYYY-MM-DD")
    add_parser.add_argument("--location", help="Location label")
    add_parser.add_argument(
        "--tag-id", action="append", type=UUID, help="Tag identifier, repeatable"
    )
    add_parser.set_defaults(handler=handle_people_add)

    list_parser = add_documented_parser(
        people_subparsers,
        "list",
        help_content=HelpContent(
            summary="List people", description="List people with optional search or tag filters."
        ),
    )
    list_parser.add_argument("--search", help="Search by name, nickname, or location")
    list_parser.add_argument("--tag-id", type=UUID, help="Filter by tag identifier")
    add_include_deleted_argument(list_parser, noun="people")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=handle_people_list)

    show_parser = add_documented_parser(
        people_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show a person", description="Show one person with full metadata."
        ),
    )
    show_parser.add_argument("person_id", type=UUID, help="Person identifier")
    add_include_deleted_argument(show_parser, noun="people", help_prefix="Allow")
    show_parser.set_defaults(handler=handle_people_show)

    update_parser = add_documented_parser(
        people_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update a person", description="Update mutable person fields."
        ),
    )
    update_parser.add_argument("person_id", type=UUID, help="Person identifier")
    update_parser.add_argument("--name", help="Updated person name")
    update_parser.add_argument("--description", help="Updated description")
    update_parser.add_argument("--nickname", action="append", help="Updated nicknames, repeatable")
    update_parser.add_argument("--birth-date", help="Updated birth date in ISO format YYYY-MM-DD")
    update_parser.add_argument("--location", help="Updated location")
    update_parser.add_argument(
        "--tag-id", action="append", type=UUID, help="Replacement tag identifiers"
    )
    update_parser.set_defaults(handler=handle_people_update)

    delete_parser = add_documented_parser(
        people_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete a person",
            description="Soft-delete a person.",
        ),
    )
    delete_parser.add_argument("person_id", type=UUID, help="Person identifier")
    delete_parser.set_defaults(handler=handle_people_delete)

    batch_parser = add_documented_parser(
        people_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch people operations",
            description="Run write operations that target multiple people in one command.",
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="people_batch_command",
        title="batch actions",
        metavar="batch_action",
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete multiple people",
            description="Soft-delete multiple people.",
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="person_ids", noun="person")
    batch_delete_parser.set_defaults(handler=handle_people_batch_delete)
