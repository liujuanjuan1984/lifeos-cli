"""People resource parser construction."""

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
from lifeos_cli.cli_support.resources.people.handlers import (
    PERSON_SUMMARY_COLUMNS,
    handle_people_add_async,
    handle_people_batch_delete_async,
    handle_people_delete_async,
    handle_people_list_async,
    handle_people_show_async,
    handle_people_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_people_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the people command tree."""
    people_parser = add_documented_parser(
        subparsers,
        "people",
        help_content=HelpContent(
            summary=_("Manage people and relationships"),
            description=(
                _("Create and maintain people records for your social context.")
                + "\n\n"
                + _(
                    "This resource is for named people, relationship context, and explicit "
                    "execution subjects."
                )
                + "\n\n"
                + _(
                    "Use it for the human partner and, when useful, a named automation "
                    "identity so tasks, events, and timelogs can distinguish who the work "
                    "belongs to."
                )
            ),
            examples=(
                "lifeos people add --help",
                "lifeos people list --help",
                "lifeos people batch --help",
            ),
            notes=(
                _("`people` is the intentional CLI resource name for this domain."),
                _("Use `list` as the primary query entrypoint for this resource."),
                _("Use the `batch` namespace for multi-record write operations."),
                _("Delete operations in the CLI always perform soft deletion."),
                _(
                    "Agent callers should keep the human partner and the automation identity "
                    "as separate records when both can own work."
                ),
            ),
        ),
    )
    people_parser.set_defaults(handler=make_help_handler(people_parser))
    people_subparsers = people_parser.add_subparsers(
        dest="people_command", title=_("actions"), metavar=_("action")
    )

    add_parser = add_documented_parser(
        people_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create a person"),
            description=(
                _("Create a new person.")
                + "\n\n"
                + _(
                    "Use tags, nicknames, and location to capture lightweight relationship "
                    "context or an execution subject that should appear in task, event, or "
                    "timelog ownership."
                )
            ),
            examples=(
                'lifeos people add "Human Partner" --nickname ally --location Toronto',
                'lifeos people add "Local Agent" '
                '--description "Automation identity for CLI workflows"',
            ),
            notes=(
                _(
                    "Create separate records when the human and the agent should remain "
                    "distinct subjects in later workflow data."
                ),
            ),
        ),
    )
    add_parser.add_argument("name", help=_("Person name"))
    add_parser.add_argument("--description", help=_("Optional person description"))
    add_parser.add_argument("--nickname", action="append", help=_("Nickname or alias, repeatable"))
    add_parser.add_argument("--birth-date", help=_("Birth date in ISO format YYYY-MM-DD"))
    add_parser.add_argument("--location", help=_("Location label"))
    add_parser.add_argument(
        "--tag-id", action="append", type=UUID, help=_("Tag identifier, repeatable")
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_people_add_async))

    list_parser = add_documented_parser(
        people_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List people"),
            description=(
                _("List people with optional search or tag filters.")
                + "\n\n"
                + _(
                    "Use this as the primary query entrypoint for people rather than expecting "
                    "a separate search command."
                )
            ),
            examples=(
                "lifeos people list",
                "lifeos people list --search ali",
                "lifeos people list --tag-id 11111111-1111-1111-1111-111111111111 --limit 20",
            ),
            notes=(
                _("Search currently matches name, nicknames, and location."),
                _(
                    "When results exist, the list command prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(PERSON_SUMMARY_COLUMNS)),
            ),
        ),
    )
    list_parser.add_argument("--search", help=_("Search by name, nickname, or location"))
    list_parser.add_argument("--tag-id", type=UUID, help=_("Filter by tag identifier"))
    add_include_deleted_argument(list_parser, noun="people")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_people_list_async))

    show_parser = add_documented_parser(
        people_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show a person"),
            description=_("Show one person with full metadata."),
            examples=(
                "lifeos people show 11111111-1111-1111-1111-111111111111",
                "lifeos people show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("person_id", type=UUID, help=_("Person identifier"))
    add_include_deleted_argument(show_parser, noun="people", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_people_show_async))

    update_parser = add_documented_parser(
        people_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update a person"),
            description=(
                _("Update mutable person fields.")
                + "\n\n"
                + _("Only explicitly supplied flags are changed; omitted fields are preserved.")
            ),
            examples=(
                'lifeos people update 11111111-1111-1111-1111-111111111111 --location "New York"',
                "lifeos people update 11111111-1111-1111-1111-111111111111 --tag-id "
                "22222222-2222-2222-2222-222222222222",
                "lifeos people update 11111111-1111-1111-1111-111111111111 --clear-location",
            ),
            notes=(
                _("Use `--clear-*` flags to remove optional values instead of replacing them."),
            ),
        ),
    )
    update_parser.add_argument("person_id", type=UUID, help=_("Person identifier"))
    update_parser.add_argument("--name", help=_("Updated person name"))
    update_parser.add_argument("--description", help=_("Updated description"))
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("Clear the optional person description"),
    )
    update_parser.add_argument(
        "--nickname", action="append", help=_("Updated nicknames, repeatable")
    )
    update_parser.add_argument(
        "--clear-nicknames",
        action="store_true",
        help=_("Clear all nicknames"),
    )
    update_parser.add_argument(
        "--birth-date", help=_("Updated birth date in ISO format YYYY-MM-DD")
    )
    update_parser.add_argument(
        "--clear-birth-date",
        action="store_true",
        help=_("Clear the optional birth date"),
    )
    update_parser.add_argument("--location", help=_("Updated location"))
    update_parser.add_argument(
        "--clear-location",
        action="store_true",
        help=_("Clear the optional location"),
    )
    update_parser.add_argument(
        "--tag-id", action="append", type=UUID, help=_("Replacement tag identifiers")
    )
    update_parser.add_argument(
        "--clear-tags",
        action="store_true",
        help=_("Remove all tag associations from the person"),
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_people_update_async))

    delete_parser = add_documented_parser(
        people_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete a person"),
            description=(
                _("Soft-delete a person.")
                + "\n\n"
                + _("The record remains recoverable through deleted-aware inspection commands.")
            ),
            examples=("lifeos people delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("person_id", type=UUID, help=_("Person identifier"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_people_delete_async))

    batch_parser = add_documented_parser(
        people_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch people operations"),
            description=(
                _("Run write operations that target multiple people in one command.")
                + "\n\n"
                + _("Use this namespace for bulk maintenance operations.")
            ),
            examples=("lifeos people batch delete --help",),
        ),
    )
    batch_parser.set_defaults(handler=make_help_handler(batch_parser))
    batch_subparsers = batch_parser.add_subparsers(
        dest="people_batch_command",
        title=_("batch actions"),
        metavar=_("batch_action"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple people"),
            description=_("Soft-delete multiple people by identifier."),
            notes=(_("Batch delete never performs hard deletion from the public CLI."),),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="person_ids", noun="person")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_people_batch_delete_async))
