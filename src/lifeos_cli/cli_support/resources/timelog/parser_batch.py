"""Builder helpers for batch timelog actions."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.parser_common import add_identifier_list_argument
from lifeos_cli.cli_support.resources.timelog.handlers import (
    handle_timelog_batch_delete_async,
    handle_timelog_batch_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import cli_message as _


def build_timelog_batch_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog batch command tree."""
    batch_parser = add_documented_help_parser(
        timelog_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("messages.run_batch_timelog_operations_a20746bb"),
            description=_("messages.run_bulk_update_and_delete_operations_for_timelogs_2ef9db00"),
            examples=(
                "lifeos timelog batch update --help",
                "lifeos timelog batch delete --help",
            ),
            notes=(
                _("messages.use_update_to_edit_mutable_fields_across_active_timelogs_4330aad2"),
                _("messages.use_delete_to_remove_multiple_timelogs_in_one_command_8082b19c"),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="timelog_batch_command",
        title=_("messages.batch_actions_fb880b71"),
        metavar=_("messages.batch_action_a7c086fa"),
    )

    batch_update_parser = add_documented_parser(
        batch_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("messages.update_multiple_timelogs_3325d766"),
            description=_(
                "messages.update_mutable_fields_across_multiple_active_timelogs_17592b52"
            ),
            examples=(
                "lifeos timelog batch update --ids <timelog-id-1> <timelog-id-2> --clear-task",
                "lifeos timelog batch update --ids <timelog-id-1> <timelog-id-2> "
                '--find-title-text "deep" --replace-title-text "focused"',
                "lifeos timelog batch update --ids <timelog-id-1> "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
            ),
            notes=(
                _("messages.repeat_the_same_tag_id_or_person_id_flag_to_replace_mult_9979678d"),
                _("messages.use_clear_flags_to_remove_optional_links_7adb32a1"),
            ),
        ),
    )
    add_identifier_list_argument(
        batch_update_parser,
        dest="timelog_ids",
        noun="timelog",
        action_verb="update",
    )
    batch_update_parser.add_argument("--title", help=_("messages.replace_the_full_title_c0e77eb4"))
    batch_update_parser.add_argument(
        "--find-title-text", help=_("messages.title_text_to_find_29aa061a")
    )
    batch_update_parser.add_argument(
        "--replace-title-text",
        help=_("messages.replacement_text_for_title_matches_0c2dec33"),
    )
    batch_update_parser.add_argument(
        "--area-id", type=UUID, help=_("messages.replace_linked_area_9f303132")
    )
    batch_update_parser.add_argument(
        "--clear-area", action="store_true", help=_("messages.clear_linked_area_58b02385")
    )
    batch_update_parser.add_argument(
        "--task-id", type=UUID, help=_("messages.replace_linked_task_d160bd1a")
    )
    batch_update_parser.add_argument(
        "--clear-task", action="store_true", help=_("messages.clear_linked_task_6f9bf5d9")
    )
    batch_update_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_replace_tags_with_one_or_more_identifiers_4e3e164c"),
    )
    batch_update_parser.add_argument(
        "--clear-tags", action="store_true", help=_("messages.remove_all_tags_43833702")
    )
    batch_update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_replace_people_with_one_or_more_identifiers_3ec3c70d"),
    )
    batch_update_parser.add_argument(
        "--clear-people",
        action="store_true",
        help=_("messages.remove_all_people_d2c07476"),
    )
    batch_update_parser.set_defaults(handler=make_sync_handler(handle_timelog_batch_update_async))

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_multiple_timelogs_a712e161"),
            description=_("messages.delete_multiple_timelogs_by_identifier_8d3da9d1"),
            examples=("lifeos timelog batch delete --ids <timelog-id-1> <timelog-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="timelog_ids", noun="timelog")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_timelog_batch_delete_async))
