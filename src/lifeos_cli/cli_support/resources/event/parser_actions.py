"""Builder helpers for event commands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
    help_message,
)
from lifeos_cli.cli_support.output_utils import format_summary_column_list
from lifeos_cli.cli_support.parser_common import (
    add_date_range_arguments,
    add_identifier_list_argument,
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.event.handlers import (
    EVENT_SUMMARY_COLUMNS,
    handle_event_add_async,
    handle_event_batch_delete_async,
    handle_event_delete_async,
    handle_event_list_async,
    handle_event_show_async,
    handle_event_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.cli_support.time_args import parse_datetime_or_date_value, parse_user_datetime_value
from lifeos_cli.i18n import cli_message as _


def build_event_add_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event add command."""
    add_parser = add_documented_parser(
        event_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("messages.create_an_event_89c8eadc"),
            description=_("messages.create_a_planned_schedule_event_fe9bbd9b"),
            examples=(
                'lifeos event add "Doctor appointment" --start-time 2026-04-10T09:00:00 '
                "--end-time 2026-04-10T10:00:00",
                'lifeos event add "Deep work block" --type timeblock '
                "--start-time 2026-04-10T13:00:00 "
                "--task-id <task-id> --area-id <area-id>",
                'lifeos event add "Shared planning session" '
                "--start-time 2026-04-10T15:00:00 "
                "--end-time 2026-04-10T16:00:00 "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
            ),
            notes=(
                _("messages.appointment_is_the_default_type_use_type_for_timeblocks_4ec4b61d"),
                help_message("notes.relations.repeatTagOrPersonAttach"),
                _("messages.if_end_time_is_omitted_the_event_is_treated_as_open_ende_48367370"),
                help_message("notes.datetime.configuredTimezone"),
                _("messages.use_recurrence_flags_to_create_recurring_daily_weekly_mo_a80c6fb8"),
                _("messages.when_an_agent_creates_events_for_a_human_use_person_id_t_7e92ca95"),
            ),
        ),
    )
    add_parser.add_argument("title", help=_("messages.event_title_6315a404"))
    add_parser.add_argument("--description", help=_("messages.optional_event_description_8a62ca2f"))
    add_parser.add_argument(
        "--start-time",
        required=True,
        type=parse_user_datetime_value,
        help=_("messages.start_time_88d8206d"),
    )
    add_parser.add_argument(
        "--end-time", type=parse_user_datetime_value, help=_("messages.optional_end_time_90b27163")
    )
    add_parser.add_argument(
        "--priority", type=int, default=0, help=_("messages.priority_from_0_to_5_9d3acd4c")
    )
    add_parser.add_argument("--status", default="planned", help=_("messages.event_status_ff961022"))
    add_parser.add_argument(
        "--type",
        dest="event_type",
        default="appointment",
        help=_("messages.event_type_appointment_timeblock_or_deadline_e48b2cc5"),
    )
    add_parser.add_argument(
        "--all-day",
        action=argparse.BooleanOptionalAction,
        default=False,
        help=_("messages.mark_the_event_as_all_day_72fdaad7"),
    )
    add_parser.add_argument(
        "--area-id", type=UUID, help=_("messages.optional_linked_area_identifier_a9c6209e")
    )
    add_parser.add_argument(
        "--task-id", type=UUID, help=_("messages.optional_linked_task_identifier_ee0966fa")
    )
    add_parser.add_argument(
        "--recurrence-frequency",
        help=_("messages.optional_recurrence_frequency_daily_weekly_monthly_or_ye_16f821c6"),
    )
    add_parser.add_argument(
        "--recurrence-interval",
        type=int,
        help=_("messages.optional_recurrence_interval_default_1_337ef169"),
    )
    add_parser.add_argument(
        "--recurrence-count",
        type=int,
        help=_("messages.optional_total_occurrence_count_574b755f"),
    )
    add_parser.add_argument(
        "--recurrence-until",
        type=parse_user_datetime_value,
        help=_("messages.optional_final_allowed_occurrence_start_time_44bb7594"),
    )
    add_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_attach_one_or_more_event_tags_c2251a3d"),
    )
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_attach_one_or_more_people_381be396"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_event_add_async))


def build_event_list_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event list command."""
    list_parser = add_documented_parser(
        event_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("messages.list_events_f24627c3"),
            description=(
                _("messages.list_events_with_optional_time_window_and_relation_filte_714de1c4")
                + "\n\n"
                + _("messages.use_this_command_as_the_primary_query_entrypoint_for_sch_cc2f6900")
            ),
            examples=(
                "lifeos event list",
                "lifeos event list --date 2026-04-10",
                "lifeos event list --date 2026-04-10 --date 2026-04-16",
                "lifeos event list --status planned --start-time 2026-04-10T00:00:00 "
                "--end-time 2026-04-10T23:59:59",
                "lifeos event list --type deadline --date 2026-04-10",
                "lifeos event list --task-id <task-id> --person-id <person-id>",
            ),
            notes=(
                help_message("notes.dateRange.repeatedDate"),
                _("messages.when_both_start_time_and_end_time_are_given_overlapping_e0026cde"),
                _("messages.recurring_series_are_expanded_for_bounded_window_queries_2e5b8d5c"),
                _("messages.use_type_to_narrow_results_to_one_event_topology_bc90f929"),
                _("messages.use_title_contains_for_lightweight_text_filtering_instea_7e171696"),
                _(
                    "messages.when_results_exist_the_list_command_prints_a_header_row_e9bd5ee0"
                ).format(columns=format_summary_column_list(EVENT_SUMMARY_COLUMNS)),
            ),
        ),
    )
    list_parser.add_argument(
        "--title-contains", help=_("messages.filter_by_title_substring_e38c0eef")
    )
    list_parser.add_argument("--status", help=_("messages.filter_by_event_status_c4119a07"))
    list_parser.add_argument(
        "--type",
        dest="event_type",
        help=_("messages.filter_by_event_type_appointment_timeblock_or_deadline_7475bd3e"),
    )
    list_parser.add_argument(
        "--area-id", type=UUID, help=_("messages.filter_by_linked_area_e5ff3ef1")
    )
    list_parser.add_argument(
        "--task-id", type=UUID, help=_("messages.filter_by_linked_task_bc80bbeb")
    )
    list_parser.add_argument(
        "--person-id", type=UUID, help=_("messages.filter_by_linked_person_8b21ab5b")
    )
    list_parser.add_argument(
        "--tag-id", type=UUID, help=_("messages.filter_by_linked_tag_c1bc2105")
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
    add_include_deleted_argument(list_parser, noun="events")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_event_list_async))


def build_event_show_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event show command."""
    show_parser = add_documented_parser(
        event_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_an_event_54d23192"),
            description=_("messages.show_one_event_with_full_metadata_3002e83a"),
            examples=(
                "lifeos event show 11111111-1111-1111-1111-111111111111",
                "lifeos event show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("event_id", type=UUID, help=_("messages.event_identifier_34cf5279"))
    add_include_deleted_argument(show_parser, noun="events", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_event_show_async))


def build_event_update_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event update command."""
    update_parser = add_documented_parser(
        event_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("messages.update_an_event_dc70c7a6"),
            description=_("messages.update_mutable_event_fields_156401a5"),
            examples=(
                "lifeos event update 11111111-1111-1111-1111-111111111111 --status completed",
                "lifeos event update 11111111-1111-1111-1111-111111111111 --type deadline",
                "lifeos event update 11111111-1111-1111-1111-111111111111 "
                "--start-time 2026-04-10T09:00:00 --end-time 2026-04-10T10:00:00",
                "lifeos event update 11111111-1111-1111-1111-111111111111 "
                "--scope single --instance-start 2026-04-10T09:00:00 "
                "--clear-end-time",
                "lifeos event update 11111111-1111-1111-1111-111111111111 "
                "--person-id <person-id-1> --person-id <person-id-2> "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
                "lifeos event update 11111111-1111-1111-1111-111111111111 "
                "--clear-task --clear-area",
                "lifeos event update 11111111-1111-1111-1111-111111111111 "
                "--clear-people --clear-tags",
            ),
            notes=(
                _("messages.use_type_to_retag_an_event_as_appointment_timeblock_or_d_771e8247"),
                help_message("notes.clearFlags.explicitOptionalValues"),
                help_message("notes.clearFlags.valueConflict"),
                help_message("notes.datetime.configuredTimezone"),
                help_message("notes.recurringScope.updates"),
                help_message("notes.recurringScope.instanceStartRequired"),
                _("messages.use_repeated_person_id_to_keep_human_only_agent_only_and_659d77e2"),
            ),
        ),
    )
    update_parser.add_argument("event_id", type=UUID, help=_("messages.event_identifier_34cf5279"))
    update_parser.add_argument("--title", help=_("messages.updated_event_title_419657cc"))
    update_parser.add_argument("--description", help=_("messages.updated_description_ce962f11"))
    update_parser.add_argument(
        "--clear-description", action="store_true", help=_("messages.clear_description_47e9b8bd")
    )
    update_parser.add_argument(
        "--start-time",
        type=parse_user_datetime_value,
        help=_("messages.updated_start_time_d1e7934a"),
    )
    update_parser.add_argument(
        "--end-time", type=parse_user_datetime_value, help=_("messages.updated_end_time_bacbe83a")
    )
    update_parser.add_argument(
        "--clear-end-time", action="store_true", help=_("messages.clear_end_time_473a3ac7")
    )
    update_parser.add_argument(
        "--priority", type=int, help=_("messages.updated_priority_from_0_to_5_97845746")
    )
    update_parser.add_argument("--status", help=_("messages.updated_event_status_f676d620"))
    update_parser.add_argument(
        "--type",
        dest="event_type",
        help=_("messages.updated_event_type_appointment_timeblock_or_deadline_e4d78fc0"),
    )
    update_parser.add_argument(
        "--all-day",
        action=argparse.BooleanOptionalAction,
        default=None,
        help=_("messages.toggle_all_day_status_52833d6a"),
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
        "--recurrence-frequency",
        help=_("messages.updated_recurrence_frequency_daily_weekly_monthly_or_yea_7e92df59"),
    )
    update_parser.add_argument(
        "--recurrence-interval",
        type=int,
        help=_("messages.updated_recurrence_interval_7c83c267"),
    )
    update_parser.add_argument(
        "--recurrence-count", type=int, help=_("messages.updated_recurrence_count_24f76f96")
    )
    update_parser.add_argument(
        "--recurrence-until",
        type=parse_user_datetime_value,
        help=_("messages.updated_recurrence_until_datetime_de734b25"),
    )
    update_parser.add_argument(
        "--clear-recurrence",
        action="store_true",
        help=_("messages.remove_recurrence_from_the_event_150176f1"),
    )
    update_parser.add_argument(
        "--scope",
        default="all",
        help=_("messages.update_scope_for_recurring_events_single_all_future_or_a_f2fe788b"),
    )
    update_parser.add_argument(
        "--instance-start",
        type=parse_user_datetime_value,
        help=_("messages.instance_start_time_for_single_or_all_future_recurring_u_1b2105c6"),
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
    update_parser.set_defaults(handler=make_sync_handler(handle_event_update_async))


def build_event_delete_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event delete command."""
    delete_parser = add_documented_parser(
        event_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_an_event_fc389f53"),
            description=_("messages.delete_one_event_45d9c6e6"),
            examples=(
                "lifeos event delete 11111111-1111-1111-1111-111111111111",
                "lifeos event delete 11111111-1111-1111-1111-111111111111 "
                "--scope single --instance-start 2026-04-10T09:00:00",
                "lifeos event delete 11111111-1111-1111-1111-111111111111 "
                "--scope all_future --instance-start 2026-04-10T09:00:00",
            ),
            notes=(
                help_message("notes.recurringScope.deletes"),
                help_message("notes.recurringScope.instanceStartRequired"),
                help_message("notes.datetime.configuredTimezone"),
            ),
        ),
    )
    delete_parser.add_argument("event_id", type=UUID, help=_("messages.event_identifier_34cf5279"))
    delete_parser.add_argument(
        "--scope",
        default="all",
        help=_("messages.delete_scope_for_recurring_events_single_all_future_or_a_2554a852"),
    )
    delete_parser.add_argument(
        "--instance-start",
        type=parse_user_datetime_value,
        help=_("messages.instance_start_time_for_single_or_all_future_recurring_d_683d92f5"),
    )
    delete_parser.set_defaults(handler=make_sync_handler(handle_event_delete_async))


def build_event_batch_parser(
    event_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the event batch command tree."""
    batch_parser = add_documented_help_parser(
        event_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("messages.run_batch_event_operations_05a22620"),
            description=_("messages.delete_multiple_events_in_one_command_abcd32ce"),
            examples=(
                "lifeos event batch delete --help",
                "lifeos event batch delete --ids <event-id-1> <event-id-2>",
            ),
            notes=(
                _("messages.this_namespace_currently_exposes_only_the_delete_workflo_8e17bac4"),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="event_batch_command",
        title=_("messages.batch_actions_fb880b71"),
        metavar=_("messages.batch_action_a7c086fa"),
    )
    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_multiple_events_84930f0b"),
            description=_("messages.delete_multiple_events_by_identifier_3e0435cf"),
            examples=("lifeos event batch delete --ids <event-id-1> <event-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="event_ids", noun="event")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_event_batch_delete_async))
