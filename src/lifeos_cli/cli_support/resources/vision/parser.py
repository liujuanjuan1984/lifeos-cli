"""Vision resource parser construction."""

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
from lifeos_cli.cli_support.resources.vision.handlers import (
    VISION_SUMMARY_COLUMNS,
    VISION_WITH_TASKS_COLUMNS,
    handle_vision_add,
    handle_vision_add_experience,
    handle_vision_batch_delete,
    handle_vision_delete,
    handle_vision_harvest,
    handle_vision_list,
    handle_vision_show,
    handle_vision_stats,
    handle_vision_sync_experience,
    handle_vision_update,
    handle_vision_with_tasks,
)
from lifeos_cli.i18n import gettext_message as _


def build_vision_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the vision command tree."""
    vision_parser = add_documented_parser(
        subparsers,
        "vision",
        help_content=HelpContent(
            summary=_("Manage visions"),
            description=(
                _("Create and maintain high-level containers composed of one or more task trees.")
                + "\n\n"
                + _("A vision is broader than a single task and usually lives under an area.")
            ),
            examples=(
                'lifeos vision add "Launch lifeos-cli" '
                "--area-id 11111111-1111-1111-1111-111111111111",
                "lifeos vision list --status active",
            ),
            notes=(
                _("Use `list` as the primary query entrypoint for this resource."),
                _("Visions are intended to group related task trees."),
                _("Use the `batch` namespace for multi-record write operations."),
                _("Delete operations in the CLI always perform soft deletion."),
            ),
        ),
    )
    vision_parser.set_defaults(handler=make_help_handler(vision_parser))
    vision_subparsers = vision_parser.add_subparsers(
        dest="vision_command",
        title=_("actions"),
        metavar=_("action"),
    )

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
    add_parser.set_defaults(handler=handle_vision_add)

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
    list_parser.set_defaults(handler=handle_vision_list)

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
    show_parser.set_defaults(handler=handle_vision_show)

    with_tasks_parser = add_documented_parser(
        vision_subparsers,
        "with-tasks",
        help_content=HelpContent(
            summary=_("Show a vision task tree"),
            description=_("Show one vision with its active tasks."),
            examples=("lifeos vision with-tasks 11111111-1111-1111-1111-111111111111",),
            notes=(
                _(
                    "When the vision has tasks, the `tasks` section prints a header row "
                    "followed by tab-separated columns: {columns}."
                ).format(columns=format_summary_column_list(VISION_WITH_TASKS_COLUMNS)),
            ),
        ),
    )
    with_tasks_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    with_tasks_parser.set_defaults(handler=handle_vision_with_tasks)

    stats_parser = add_documented_parser(
        vision_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("Show vision stats"),
            description=_("Show task counts and effort totals for one vision."),
            examples=("lifeos vision stats 11111111-1111-1111-1111-111111111111",),
        ),
    )
    stats_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    stats_parser.set_defaults(handler=handle_vision_stats)

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
                "lifeos vision update 11111111-1111-1111-1111-111111111111 --clear-area",
            ),
            notes=(
                _("Valid statuses currently include `active`, `archived`, and `fruit`."),
                _("Use `--clear-*` flags to remove optional values, including people."),
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
    update_parser.set_defaults(handler=handle_vision_update)

    add_experience_parser = add_documented_parser(
        vision_subparsers,
        "add-experience",
        help_content=HelpContent(
            summary=_("Add vision experience"),
            description=_("Add manual experience points to an active vision."),
            examples=(
                "lifeos vision add-experience 11111111-1111-1111-1111-111111111111 --points 120",
            ),
        ),
    )
    add_experience_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    add_experience_parser.add_argument(
        "--points",
        dest="experience_points",
        type=int,
        required=True,
        help=_("Experience points to add"),
    )
    add_experience_parser.set_defaults(handler=handle_vision_add_experience)

    sync_experience_parser = add_documented_parser(
        vision_subparsers,
        "sync-experience",
        help_content=HelpContent(
            summary=_("Sync vision experience"),
            description=_("Synchronize experience points from root task actual effort totals."),
            examples=("lifeos vision sync-experience 11111111-1111-1111-1111-111111111111",),
        ),
    )
    sync_experience_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    sync_experience_parser.set_defaults(handler=handle_vision_sync_experience)

    harvest_parser = add_documented_parser(
        vision_subparsers,
        "harvest",
        help_content=HelpContent(
            summary=_("Harvest a vision"),
            description=_("Convert a mature active vision to fruit status."),
            examples=("lifeos vision harvest 11111111-1111-1111-1111-111111111111",),
        ),
    )
    harvest_parser.add_argument("vision_id", type=UUID, help=_("Vision identifier"))
    harvest_parser.set_defaults(handler=handle_vision_harvest)

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
    delete_parser.set_defaults(handler=handle_vision_delete)

    batch_parser = add_documented_parser(
        vision_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("Run batch vision operations"),
            description=(
                _("Run write operations that target multiple visions in one command.")
                + "\n\n"
                + _(
                    "Use this namespace for bulk maintenance instead of adding many top-level "
                    "verbs."
                )
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
        title=_("batch actions"),
        metavar=_("batch_action"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("Delete multiple visions"),
            description=_("Soft-delete multiple visions by identifier."),
            notes=(_("Batch delete never performs hard deletion from the public CLI."),),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="vision_ids", noun="vision")
    batch_delete_parser.set_defaults(handler=handle_vision_batch_delete)
