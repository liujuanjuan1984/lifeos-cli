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
from lifeos_cli.cli_support.resources.people.handlers import (
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
            description=(
                "Create and maintain people records for your social context.\n\n"
                "This resource is for named people, relationship context, and explicit "
                "execution subjects.\n\n"
                "Use it for the human partner and, when useful, a named automation "
                "identity so tasks, events, and timelogs can distinguish who the work "
                "belongs to."
            ),
            examples=(
                'lifeos people add "Human Partner" --nickname ally --location Toronto',
                'lifeos people add "Local Agent" '
                '--description "Automation identity for CLI workflows"',
                "lifeos people list --search ali",
            ),
            notes=(
                "`people` is the intentional CLI resource name for this domain.",
                "Use `list` as the primary query entrypoint for this resource.",
                "Use the `batch` namespace for multi-record write operations.",
                "Delete operations in the CLI always perform soft deletion.",
                "Agent callers should keep the human partner and the automation identity "
                "as separate records when both can own work.",
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
        help_content=HelpContent(
            summary="Create a person",
            description=(
                "Create a new person.\n\n"
                "Use tags, nicknames, and location to capture lightweight relationship "
                "context or an execution subject that should appear in task, event, or "
                "timelog ownership."
            ),
            examples=(
                'lifeos people add "Human Partner" --nickname ally --location Toronto',
                'lifeos people add "Local Agent" '
                '--description "Automation identity for CLI workflows"',
            ),
            notes=(
                "Create separate records when the human and the agent should remain distinct "
                "subjects in later workflow data.",
            ),
        ),
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
            summary="List people",
            description=(
                "List people with optional search or tag filters.\n\n"
                "Use this as the primary query entrypoint for people rather than "
                "expecting a separate search command."
            ),
            examples=(
                "lifeos people list",
                "lifeos people list --search ali",
                "lifeos people list --tag-id 11111111-1111-1111-1111-111111111111 --limit 20",
            ),
            notes=("Search currently matches name, nicknames, and location.",),
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
            summary="Show a person",
            description="Show one person with full metadata.",
            examples=(
                "lifeos people show 11111111-1111-1111-1111-111111111111",
                "lifeos people show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("person_id", type=UUID, help="Person identifier")
    add_include_deleted_argument(show_parser, noun="people", help_prefix="Allow")
    show_parser.set_defaults(handler=handle_people_show)

    update_parser = add_documented_parser(
        people_subparsers,
        "update",
        help_content=HelpContent(
            summary="Update a person",
            description=(
                "Update mutable person fields.\n\n"
                "Only explicitly supplied flags are changed; omitted fields are preserved."
            ),
            examples=(
                'lifeos people update 11111111-1111-1111-1111-111111111111 --location "New York"',
                "lifeos people update 11111111-1111-1111-1111-111111111111 --tag-id "
                "22222222-2222-2222-2222-222222222222",
                "lifeos people update 11111111-1111-1111-1111-111111111111 --clear-location",
            ),
            notes=("Use `--clear-*` flags to remove optional values instead of replacing them.",),
        ),
    )
    update_parser.add_argument("person_id", type=UUID, help="Person identifier")
    update_parser.add_argument("--name", help="Updated person name")
    update_parser.add_argument("--description", help="Updated description")
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help="Clear the optional person description",
    )
    update_parser.add_argument("--nickname", action="append", help="Updated nicknames, repeatable")
    update_parser.add_argument(
        "--clear-nicknames",
        action="store_true",
        help="Clear all nicknames",
    )
    update_parser.add_argument("--birth-date", help="Updated birth date in ISO format YYYY-MM-DD")
    update_parser.add_argument(
        "--clear-birth-date",
        action="store_true",
        help="Clear the optional birth date",
    )
    update_parser.add_argument("--location", help="Updated location")
    update_parser.add_argument(
        "--clear-location",
        action="store_true",
        help="Clear the optional location",
    )
    update_parser.add_argument(
        "--tag-id", action="append", type=UUID, help="Replacement tag identifiers"
    )
    update_parser.add_argument(
        "--clear-tags",
        action="store_true",
        help="Remove all tag associations from the person",
    )
    update_parser.set_defaults(handler=handle_people_update)

    delete_parser = add_documented_parser(
        people_subparsers,
        "delete",
        help_content=HelpContent(
            summary="Delete a person",
            description=(
                "Soft-delete a person.\n\n"
                "The record remains recoverable through deleted-aware inspection commands."
            ),
            examples=("lifeos people delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("person_id", type=UUID, help="Person identifier")
    delete_parser.set_defaults(handler=handle_people_delete)

    batch_parser = add_documented_parser(
        people_subparsers,
        "batch",
        help_content=HelpContent(
            summary="Run batch people operations",
            description=(
                "Run write operations that target multiple people in one command.\n\n"
                "Use this namespace for bulk maintenance operations."
            ),
            examples=(
                "lifeos people batch delete --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222",
            ),
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
            description="Soft-delete multiple people by identifier.",
            notes=("Batch delete never performs hard deletion from the public CLI.",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="person_ids", noun="person")
    batch_delete_parser.set_defaults(handler=handle_people_batch_delete)
