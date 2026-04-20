"""Builder helpers for core vision commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.vision.handlers import (
    VISION_SUMMARY_COLUMNS,
    handle_vision_add_async,
    handle_vision_delete_async,
    handle_vision_list_async,
    handle_vision_show_async,
    handle_vision_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import gettext_message as _


def build_vision_add_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision add command."""
    add_parser = add_documented_parser(
        vision_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("Create a vision"),
            description=(
                _("Create a new vision.")
                + "\n\n"
                + _(
                    "Visions usually represent medium- or long-running themes that will own "
                    "multiple tasks."
                )
            ),
            examples=(
                'lifeos vision add "Launch lifeos-cli" '
                "--area-id 11111111-1111-1111-1111-111111111111",
                'lifeos vision add "Improve sleep quality" --status active',
                'lifeos vision add "Strengthen family rhythm" '
                "--person-id 11111111-1111-1111-1111-111111111111",
                'lifeos vision add "Shared parenting rhythm" '
                "--person-id 11111111-1111-1111-1111-111111111111 "
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
    add_parser.add_argument("name", help=_("Vision name"))
    add_parser.add_argument("--description", help=_("Optional vision description"))
    add_parser.add_argument("--status", default="active", help=_("Vision status"))
    add_parser.add_argument("--area-id", type=UUID, help=_("Owning area identifier"))
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("Repeat to associate one or more people"),
    )
    add_parser.add_argument(
        "--experience-rate-per-hour",
        type=int,
        help=_("Optional experience rate"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_vision_add_async))


def build_vision_list_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision list command."""
    list_parser = add_documented_parser(
        vision_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("List visions"),
            description=(
                _("List visions with optional status or area filters.")
                + "\n\n"
                + _("Use this as the main query entrypoint for visions.")
            ),
            examples=(
                "lifeos vision list",
                "lifeos vision list --status active",
                "lifeos vision list --person-id 11111111-1111-1111-1111-111111111111",
                "lifeos vision list --area-id 11111111-1111-1111-1111-111111111111 --limit 20",
            ),
            notes=(
                _(
                    "When results exist, the list command prints a header row followed by "
                    "tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(VISION_SUMMARY_COLUMNS)),
            ),
        ),
    )
    list_parser.add_argument("--status", help=_("Filter by status"))
    list_parser.add_argument("--area-id", type=UUID, help=_("Filter by area identifier"))
    list_parser.add_argument("--person-id", type=UUID, help=_("Filter by linked person identifier"))
    add_include_deleted_argument(list_parser, noun="visions")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_vision_list_async))


def build_vision_show_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision show command."""
    show_parser = add_documented_parser(
        vision_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show a vision"),
            description=_("Show one vision with full metadata."),
            examples=(
                "lifeos vision show 11111111-1111-1111-1111-111111111111",
                "lifeos vision show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    add_include_deleted_argument(show_parser, noun="visions", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_vision_show_async))


def build_vision_update_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision update command."""
    update_parser = add_documented_parser(
        vision_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("Update a vision"),
            description=(
                _("Update mutable vision fields.")
                + "\n\n"
                + _("Only explicitly provided flags are changed; omitted values are preserved.")
            ),
            examples=(
                "lifeos vision update 11111111-1111-1111-1111-111111111111 "
                '--name "Ship lifeos-cli"',
                "lifeos vision update 11111111-1111-1111-1111-111111111111 --status archived",
                "lifeos vision update 11111111-1111-1111-1111-111111111111 "
                "--person-id 11111111-1111-1111-1111-111111111111",
                "lifeos vision update 11111111-1111-1111-1111-111111111111 "
                "--person-id 11111111-1111-1111-1111-111111111111 "
                "--person-id 22222222-2222-2222-2222-222222222222",
                "lifeos vision update 11111111-1111-1111-1111-111111111111 "
                "--clear-description --clear-experience-rate",
                "lifeos vision update 11111111-1111-1111-1111-111111111111 --clear-area",
            ),
            notes=(
                _("Valid statuses currently include `active`, `archived`, and `fruit`."),
                _("Use `--clear-*` flags to remove optional values, including people."),
                _("Repeat the same `--person-id` flag to replace multiple linked people."),
            ),
        ),
    )
    update_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    update_parser.add_argument("--name", help=_("Updated vision name"))
    update_parser.add_argument("--description", help=_("Updated vision description"))
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("Clear the optional vision description"),
    )
    update_parser.add_argument("--status", help=_("Updated status"))
    update_parser.add_argument("--area-id", type=UUID, help=_("Updated area identifier"))
    update_parser.add_argument(
        "--clear-area",
        action="store_true",
        help=_("Clear the optional area reference"),
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
    update_parser.add_argument(
        "--experience-rate-per-hour", type=int, help=_("Updated experience rate")
    )
    update_parser.add_argument(
        "--clear-experience-rate",
        action="store_true",
        help=_("Clear the optional experience rate"),
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_vision_update_async))


def build_vision_delete_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision delete command."""
    delete_parser = add_documented_parser(
        vision_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete a vision"),
            description=(
                _("Soft-delete a vision.")
                + "\n\n"
                + _(
                    "The record remains in the database and can still be inspected with "
                    "deleted-aware commands."
                )
            ),
            examples=("lifeos vision delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_vision_delete_async))
