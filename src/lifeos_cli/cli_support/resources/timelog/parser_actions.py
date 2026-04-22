"""Builder helpers for core timelog actions."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_parser,
    help_message,
)
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_date_range_arguments,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.timelog.handlers import (
    TIMELOG_SUMMARY_COLUMNS,
    TIMELOG_SUMMARY_COLUMNS_WITH_COUNTS,
    handle_timelog_add_async,
    handle_timelog_delete_async,
    handle_timelog_list_async,
    handle_timelog_show_async,
    handle_timelog_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.cli_support.time_args import parse_datetime_or_date_value, parse_user_datetime_value
from lifeos_cli.i18n import cli_message as _


def build_timelog_add_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog add command."""
    add_parser = add_documented_parser(
        timelog_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("messages.create_a_timelog_c3a7a0cc"),
            description=_(
                "messages.create_one_actual_time_record_or_preview_a_quick_batch_a_de052581"
            ),
            examples=(
                'lifeos timelog add "Deep work" --start-time 2026-04-10T13:00:00 '
                "--end-time 2026-04-10T14:30:00",
                'lifeos timelog add "Run" --start-time 2026-04-10T07:00:00 '
                "--end-time 2026-04-10T07:30:00 --area-id <area-id> --energy-level 4",
                'lifeos timelog add "Shared pairing" --start-time 2026-04-10T15:00:00 '
                "--end-time 2026-04-10T16:30:00 "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
                'lifeos timelog add --entry "0700 Breakfast" --entry "0830 Deep work" '
                "--first-start-time 2026-04-10T06:30:00",
                "printf '0700 Breakfast\\n0830 Deep work\\n' | lifeos timelog add --stdin "
                "--first-start-time 2026-04-10T06:30:00",
                "lifeos timelog add --file quick-timelog.txt",
            ),
            notes=(
                help_message("notes.relations.repeatTagOrPersonAttach"),
                _("messages.single_record_mode_requires_both_start_time_and_end_time_ee8c94a7"),
                _("messages.quick_batch_mode_accepts_hhmm_title_and_hh_mm_hh_mm_titl_ba472358"),
                help_message("notes.datetime.configuredTimezone"),
                _("messages.when_quick_batch_mode_omits_first_start_time_the_first_r_beec670a"),
                _("messages.when_an_agent_records_actual_work_use_person_id_to_state_c4b76f20"),
            ),
        ),
    )
    add_parser.add_argument("title", nargs="?", help=_("messages.timelog_title_fd63a24c"))
    add_parser.add_argument(
        "--start-time", type=parse_user_datetime_value, help=_("messages.start_time_88d8206d")
    )
    add_parser.add_argument(
        "--end-time", type=parse_user_datetime_value, help=_("messages.end_time_cd7800da")
    )
    add_parser.add_argument(
        "--entry",
        dest="entry_lines",
        action="append",
        default=None,
        help=_("messages.repeat_to_add_one_quick_batch_entry_line_9fdc1ef7"),
    )
    add_parser.add_argument(
        "--stdin",
        action="store_true",
        help=_("messages.read_quick_batch_entries_from_standard_input_8e42bc71"),
    )
    add_parser.add_argument(
        "--file", help=_("messages.read_quick_batch_entries_from_a_utf_8_text_file_11f3dd88")
    )
    add_parser.add_argument(
        "--first-start-time",
        type=parse_user_datetime_value,
        help=_("messages.first_quick_batch_start_time_defaults_to_the_latest_acti_5be583c9"),
    )
    add_parser.add_argument(
        "--yes",
        action="store_true",
        help=_("messages.write_quick_batch_timelogs_without_interactive_confirmat_13c4da0c"),
    )
    add_parser.add_argument(
        "--tracking-method", default="manual", help=_("messages.tracking_method_51ed2fd3")
    )
    add_parser.add_argument("--location", help=_("messages.optional_location_52a06657"))
    add_parser.add_argument(
        "--energy-level", type=int, help=_("messages.optional_energy_level_from_1_to_5_aaa249ff")
    )
    add_parser.add_argument("--notes", help=_("messages.optional_notes_410d4818"))
    add_parser.add_argument(
        "--area-id", type=UUID, help=_("messages.optional_linked_area_identifier_a9c6209e")
    )
    add_parser.add_argument(
        "--task-id", type=UUID, help=_("messages.optional_linked_task_identifier_ee0966fa")
    )
    add_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_attach_one_or_more_timelog_tags_823d9b67"),
    )
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_attach_one_or_more_people_381be396"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_timelog_add_async))


def build_timelog_list_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog list command."""
    list_parser = add_documented_parser(
        timelog_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("messages.list_timelogs_30fa2490"),
            description=(
                _("messages.list_timelogs_with_optional_time_window_relation_and_met_3d06b155")
                + "\n\n"
                + _("messages.use_this_command_as_the_primary_query_entrypoint_for_tim_67e6e27a")
            ),
            examples=(
                "lifeos timelog list",
                "lifeos timelog list --date 2026-04-10",
                "lifeos timelog list --date 2026-04-10 --date 2026-04-16",
                "lifeos timelog list --tracking-method manual "
                "--start-time 2026-04-10T00:00:00 "
                "--end-time 2026-04-10T23:59:59",
                "lifeos timelog list --task-id <task-id> --person-id <person-id>",
                'lifeos timelog list --query "deep work" --count',
            ),
            notes=(
                help_message("notes.dateRange.repeatedDate"),
                _("messages.use_query_for_lightweight_text_filtering_across_titles_a_8d129626"),
                _(
                    "messages.when_results_exist_the_list_command_prints_a_header_row_e9bd5ee0"
                ).format(columns=format_summary_column_list(TIMELOG_SUMMARY_COLUMNS)),
                _(
                    "messages.use_with_counts_to_add_relationship_count_columns_column_39685a70"
                ).format(columns=format_summary_column_list(TIMELOG_SUMMARY_COLUMNS_WITH_COUNTS)),
            ),
        ),
    )
    list_parser.add_argument(
        "--title-contains", help=_("messages.filter_by_title_substring_e38c0eef")
    )
    list_parser.add_argument(
        "--notes-contains", help=_("messages.filter_by_notes_substring_94b90860")
    )
    list_parser.add_argument(
        "--query", help=_("messages.search_title_and_notes_by_keyword_01e619a8")
    )
    list_parser.add_argument(
        "--tracking-method", help=_("messages.filter_by_tracking_method_b797bff1")
    )
    list_parser.add_argument(
        "--area-id", type=UUID, help=_("messages.filter_by_linked_area_e5ff3ef1")
    )
    list_parser.add_argument(
        "--area-name", help=_("messages.filter_by_exact_linked_area_name_67ae4b33")
    )
    list_parser.add_argument(
        "--without-area",
        action="store_true",
        help=_("messages.filter_timelogs_without_a_linked_area_7859f87f"),
    )
    list_parser.add_argument(
        "--task-id", type=UUID, help=_("messages.filter_by_linked_task_bc80bbeb")
    )
    list_parser.add_argument(
        "--without-task",
        action="store_true",
        help=_("messages.filter_timelogs_without_a_linked_task_b4f523b5"),
    )
    list_parser.add_argument(
        "--person-id", type=UUID, help=_("messages.filter_by_linked_person_8b21ab5b")
    )
    list_parser.add_argument(
        "--tag-id", type=UUID, help=_("messages.filter_by_linked_tag_c1bc2105")
    )
    list_parser.add_argument(
        "--with-counts",
        action="store_true",
        help=_("messages.include_relationship_count_columns_in_summary_output_f5b275f8"),
    )
    add_date_range_arguments(
        list_parser,
        date_help=help_message("arguments.dateRange.repeatedDate"),
    )
    list_parser.add_argument(
        "--start-time",
        dest="window_start",
        type=parse_datetime_or_date_value,
        help=_("messages.inclusive_time_filter_start_date_only_values_use_the_con_7e5b8ef4"),
    )
    list_parser.add_argument(
        "--end-time",
        dest="window_end",
        type=parse_datetime_or_date_value,
        help=_("messages.inclusive_time_filter_end_date_only_values_use_the_confi_0d238973"),
    )
    list_parser.add_argument(
        "--count", action="store_true", help=_("messages.print_total_matched_count_b60ad049")
    )
    add_include_deleted_argument(list_parser, noun="timelogs")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_timelog_list_async))


def build_timelog_show_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog show command."""
    show_parser = add_documented_parser(
        timelog_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_a_timelog_eacbce65"),
            description=_(
                "messages.show_one_timelog_with_full_metadata_and_derived_note_lin_73ef1e8a"
            ),
            examples=(
                "lifeos timelog show 11111111-1111-1111-1111-111111111111",
                "lifeos timelog show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument(
        "timelog_id", type=UUID, help=_("messages.timelog_identifier_b02fb68f")
    )
    add_include_deleted_argument(show_parser, noun="timelogs", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_timelog_show_async))


def build_timelog_update_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog update command."""
    update_parser = add_documented_parser(
        timelog_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("messages.update_a_timelog_c7249293"),
            description=_("messages.update_mutable_timelog_fields_022ba979"),
            examples=(
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 --energy-level 5",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--start-time 2026-04-10T13:00:00 --end-time 2026-04-10T14:00:00",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--clear-task --clear-area",
                "lifeos timelog update 11111111-1111-1111-1111-111111111111 "
                "--clear-people --clear-tags",
            ),
            notes=(
                help_message("notes.clearFlags.explicitOptionalValues"),
                help_message("notes.clearFlags.valueConflict"),
                help_message("notes.datetime.configuredTimezone"),
                _("messages.use_repeated_person_id_to_keep_actual_human_effort_agent_15baf6c7"),
            ),
        ),
    )
    update_parser.add_argument(
        "timelog_id", type=UUID, help=_("messages.timelog_identifier_b02fb68f")
    )
    update_parser.add_argument("--title", help=_("messages.updated_timelog_title_8551c2a2"))
    update_parser.add_argument(
        "--start-time",
        type=parse_user_datetime_value,
        help=_("messages.updated_start_time_d1e7934a"),
    )
    update_parser.add_argument(
        "--end-time", type=parse_user_datetime_value, help=_("messages.updated_end_time_bacbe83a")
    )
    update_parser.add_argument(
        "--tracking-method", help=_("messages.updated_tracking_method_16fb6c9e")
    )
    update_parser.add_argument("--location", help=_("messages.updated_location_0ce63126"))
    update_parser.add_argument(
        "--clear-location", action="store_true", help=_("messages.clear_location_e088320b")
    )
    update_parser.add_argument(
        "--energy-level", type=int, help=_("messages.updated_energy_level_from_1_to_5_caf58598")
    )
    update_parser.add_argument(
        "--clear-energy-level",
        action="store_true",
        help=_("messages.clear_energy_level_5c8bec94"),
    )
    update_parser.add_argument("--notes", help=_("messages.updated_notes_5143e05e"))
    update_parser.add_argument(
        "--clear-notes", action="store_true", help=_("messages.clear_notes_0a0a8523")
    )
    update_parser.add_argument(
        "--area-id", type=UUID, help=_("messages.updated_linked_area_identifier_41dce28e")
    )
    update_parser.add_argument(
        "--clear-area", action="store_true", help=_("messages.clear_linked_area_58b02385")
    )
    update_parser.add_argument(
        "--task-id", type=UUID, help=_("messages.updated_linked_task_identifier_50e34b5a")
    )
    update_parser.add_argument(
        "--clear-task", action="store_true", help=_("messages.clear_linked_task_6f9bf5d9")
    )
    update_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_replace_tags_with_one_or_more_identifiers_4e3e164c"),
    )
    update_parser.add_argument(
        "--clear-tags", action="store_true", help=_("messages.remove_all_tags_43833702")
    )
    update_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_replace_people_with_one_or_more_identifiers_3ec3c70d"),
    )
    update_parser.add_argument(
        "--clear-people", action="store_true", help=_("messages.remove_all_people_d2c07476")
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_timelog_update_async))


def build_timelog_delete_parser(
    timelog_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the timelog delete command."""
    delete_parser = add_documented_parser(
        timelog_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_a_timelog_9331d336"),
            description=_("messages.delete_one_timelog_7f49fcb7"),
            examples=("lifeos timelog delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument(
        "timelog_id", type=UUID, help=_("messages.timelog_identifier_b02fb68f")
    )
    delete_parser.set_defaults(handler=make_sync_handler(handle_timelog_delete_async))
