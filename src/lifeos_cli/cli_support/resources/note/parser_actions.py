"""Builder helpers for note subcommands."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.output_utils import (
    NOTE_SUMMARY_COLUMNS,
    NOTE_SUMMARY_COLUMNS_WITH_COUNTS,
    format_summary_column_list,
)
from lifeos_cli.cli_support.parser_common import (
    add_include_deleted_argument,
    add_limit_offset_arguments,
)
from lifeos_cli.cli_support.resources.note.handlers import (
    handle_note_add_async,
    handle_note_batch_delete_async,
    handle_note_batch_update_content_async,
    handle_note_delete_async,
    handle_note_list_async,
    handle_note_search_async,
    handle_note_show_async,
    handle_note_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import cli_message as _


def build_note_add_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    add_parser = add_documented_parser(
        note_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("messages.create_a_note_6c3277da"),
            description=(
                _("messages.create_a_new_note_from_inline_text_stdin_or_a_file_da088bdc")
                + "\n\n"
                + _("messages.use_this_action_to_capture_short_thoughts_prompts_or_raw_35d8228d")
            ),
            examples=(
                'lifeos note add "Capture the sprint retrospective idea"',
                "printf 'line one\\nline two\\n' | lifeos note add --stdin",
                "lifeos note add --file ./note.md",
                'lifeos note add "Review shared feedback" --tag-id <tag-id-1> --tag-id <tag-id-2>',
                'lifeos note add "Review the monthly budget assumptions" --task-id <task-id>',
                'lifeos note add "Prepare the partner sync agenda" --event-id <event-id>',
            ),
            notes=(
                _("messages.wrap_inline_content_in_quotes_when_it_contains_spaces_cec19fa2"),
                _("messages.use_stdin_or_file_for_multi_line_note_content_fc07536b"),
                _("messages.repeat_the_same_relation_flag_to_link_multiple_records_o_d691fed7"),
            ),
        ),
    )
    add_parser.add_argument("content", nargs="?", help=_("messages.inline_note_content_d9202024"))
    add_parser.add_argument(
        "--stdin",
        action="store_true",
        help=_("messages.read_note_content_from_standard_input_bfb8814e"),
    )
    add_parser.add_argument(
        "--file", help=_("messages.read_note_content_from_a_utf_8_text_file_a4c91750")
    )
    add_parser.add_argument(
        "--tag-id",
        dest="tag_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_associate_one_or_more_tags_e5411318"),
    )
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_associate_one_or_more_people_cf6b79d8"),
    )
    add_parser.add_argument(
        "--task-id",
        dest="task_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_associate_one_or_more_tasks_9aa6e7b1"),
    )
    add_parser.add_argument(
        "--vision-id",
        dest="vision_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_associate_one_or_more_visions_74e977b4"),
    )
    add_parser.add_argument(
        "--event-id",
        dest="event_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_associate_one_or_more_events_8c3af0be"),
    )
    add_parser.add_argument(
        "--timelog-id",
        dest="timelog_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_associate_one_or_more_timelogs_ae3cc25a"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_note_add_async))


def build_note_list_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    list_parser = add_documented_parser(
        note_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("messages.list_notes_9a0c8587"),
            description=(
                _("messages.list_notes_in_reverse_creation_order_8ab1cda9")
                + "\n\n"
                + _(
                    "messages.when_results_exist_the_list_command_prints_a_header_row_e9bd5ee0"
                ).format(columns=format_summary_column_list(NOTE_SUMMARY_COLUMNS))
            ),
            examples=(
                "lifeos note list",
                "lifeos note list --tag-id <tag-id>",
                "lifeos note list --person-id <person-id>",
                "lifeos note list --event-id <event-id>",
                "lifeos note list --timelog-id <timelog-id>",
                "lifeos note list --limit 20 --offset 20",
                "lifeos note list --include-deleted",
            ),
            notes=(
                _("messages.use_include_deleted_when_reviewing_deleted_records_f14ea31c"),
                _("messages.use_limit_and_offset_together_for_pagination_9c38907c"),
                _(
                    "messages.use_with_counts_to_add_relationship_count_columns_column_39685a70"
                ).format(columns=format_summary_column_list(NOTE_SUMMARY_COLUMNS_WITH_COUNTS)),
            ),
        ),
    )
    list_parser.add_argument(
        "--tag-id", type=UUID, help=_("messages.filter_by_linked_tag_c1bc2105")
    )
    list_parser.add_argument(
        "--event-id", type=UUID, help=_("messages.filter_by_linked_event_db2564be")
    )
    list_parser.add_argument(
        "--person-id", type=UUID, help=_("messages.filter_by_linked_person_8b21ab5b")
    )
    list_parser.add_argument(
        "--task-id", type=UUID, help=_("messages.filter_by_linked_task_bc80bbeb")
    )
    list_parser.add_argument(
        "--timelog-id", type=UUID, help=_("messages.filter_by_linked_timelog_6d45b661")
    )
    list_parser.add_argument(
        "--vision-id", type=UUID, help=_("messages.filter_by_linked_vision_0cf8f869")
    )
    list_parser.add_argument(
        "--with-counts",
        action="store_true",
        help=_("messages.include_relationship_count_columns_in_summary_output_f5b275f8"),
    )
    add_include_deleted_argument(list_parser, noun="notes")
    add_limit_offset_arguments(list_parser, row_noun="notes")
    list_parser.set_defaults(handler=make_sync_handler(handle_note_list_async))


def build_note_search_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    search_parser = add_documented_parser(
        note_subparsers,
        "search",
        help_content=HelpContent(
            summary=_("messages.search_notes_246ce514"),
            description=(
                _("messages.search_notes_by_keyword_tokens_0dde19c5")
                + "\n\n"
                + _("messages.search_uses_postgresql_backed_ilike_token_matching_each_ea1a013e")
            ),
            examples=(
                'lifeos note search "meeting notes"',
                'lifeos note search "review" --task-id <task-id>',
                'lifeos note search "partner sync" --event-id <event-id>',
                'lifeos note search "budget q2" --limit 20',
                'lifeos note search "archived idea" --include-deleted',
            ),
            notes=(
                _("messages.results_use_the_same_summary_format_as_lifeos_note_list_70496ac6"),
                _(
                    "messages.use_with_counts_to_add_relationship_count_columns_column_39685a70"
                ).format(columns=format_summary_column_list(NOTE_SUMMARY_COLUMNS_WITH_COUNTS)),
                _("messages.multi_word_queries_are_split_into_tokens_and_matched_wit_e8781e98"),
            ),
        ),
    )
    search_parser.add_argument("query", help=_("messages.search_query_string_3dde4fea"))
    search_parser.add_argument(
        "--tag-id", type=UUID, help=_("messages.filter_by_linked_tag_c1bc2105")
    )
    search_parser.add_argument(
        "--event-id", type=UUID, help=_("messages.filter_by_linked_event_db2564be")
    )
    search_parser.add_argument(
        "--person-id", type=UUID, help=_("messages.filter_by_linked_person_8b21ab5b")
    )
    search_parser.add_argument(
        "--task-id", type=UUID, help=_("messages.filter_by_linked_task_bc80bbeb")
    )
    search_parser.add_argument(
        "--timelog-id", type=UUID, help=_("messages.filter_by_linked_timelog_6d45b661")
    )
    search_parser.add_argument(
        "--vision-id", type=UUID, help=_("messages.filter_by_linked_vision_0cf8f869")
    )
    search_parser.add_argument(
        "--with-counts",
        action="store_true",
        help=_("messages.include_relationship_count_columns_in_summary_output_f5b275f8"),
    )
    add_include_deleted_argument(search_parser, noun="notes in the search scope")
    add_limit_offset_arguments(search_parser, row_noun="matching notes")
    search_parser.set_defaults(handler=make_sync_handler(handle_note_search_async))


def build_note_show_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    show_parser = add_documented_parser(
        note_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_full_note_content_0801f676"),
            description=(
                _("messages.show_a_single_note_with_full_metadata_and_the_original_c_fac94dee")
                + "\n\n"
                + _("messages.use_this_action_when_you_need_to_inspect_preserved_line_51d26407")
            ),
            examples=(
                "lifeos note show 11111111-1111-1111-1111-111111111111",
                "lifeos note show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
            notes=(_("messages.use_include_deleted_to_inspect_a_deleted_note_9b4a7e0d"),),
        ),
    )
    show_parser.add_argument("note_id", type=UUID, help=_("messages.note_identifier_45195a2f"))
    add_include_deleted_argument(show_parser, noun="notes", help_prefix="Allow loading")
    show_parser.set_defaults(handler=make_sync_handler(handle_note_show_async))


def build_note_update_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    update_parser = add_documented_parser(
        note_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("messages.update_a_note_922bd82a"),
            description=(
                _("messages.update_note_content_and_weak_associations_in_place_a7f14957")
                + "\n\n"
                + _("messages.omitted_fields_remain_unchanged_use_clear_flags_to_remov_35cb3302")
            ),
            examples=(
                'lifeos note update 11111111-1111-1111-1111-111111111111 "Rewrite the note"',
                "lifeos note update 11111111-1111-1111-1111-111111111111 --task-id <task-id>",
                "lifeos note update 11111111-1111-1111-1111-111111111111 "
                "--tag-id <tag-id-1> --tag-id <tag-id-2>",
                "lifeos note update 11111111-1111-1111-1111-111111111111 "
                "--clear-tags --clear-events",
                "lifeos note update 11111111-1111-1111-1111-111111111111 --clear-timelogs",
            ),
            notes=(
                _("messages.repeat_the_same_relation_flag_to_replace_multiple_linked_5249e52c"),
                _("messages.use_relation_flags_without_content_when_only_links_need_e9644074"),
            ),
        ),
    )
    update_parser.add_argument("note_id", type=UUID, help=_("messages.note_identifier_45195a2f"))
    update_parser.add_argument(
        "content", nargs="?", help=_("messages.replacement_note_content_2bd846c4")
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
    update_parser.add_argument(
        "--task-id",
        dest="task_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_replace_tasks_with_one_or_more_identifiers_e9ad6137"),
    )
    update_parser.add_argument(
        "--clear-tasks",
        dest="clear_tasks",
        action="store_true",
        help=_("messages.remove_all_linked_tasks_3dabf39b"),
    )
    update_parser.add_argument(
        "--vision-id",
        dest="vision_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_replace_visions_with_one_or_more_identifiers_897b6843"),
    )
    update_parser.add_argument(
        "--clear-visions",
        action="store_true",
        help=_("messages.remove_all_linked_visions_638d3c34"),
    )
    update_parser.add_argument(
        "--event-id",
        dest="event_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_replace_events_with_one_or_more_identifiers_8156f328"),
    )
    update_parser.add_argument(
        "--clear-events",
        action="store_true",
        help=_("messages.remove_all_linked_events_484c72c8"),
    )
    update_parser.add_argument(
        "--timelog-id",
        dest="timelog_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_replace_timelogs_with_one_or_more_identifiers_223cf4fd"),
    )
    update_parser.add_argument(
        "--clear-timelogs",
        action="store_true",
        help=_("messages.remove_all_linked_timelogs_5f2ce15d"),
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_note_update_async))


def build_note_delete_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    delete_parser = add_documented_parser(
        note_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_a_note_feec9616"),
            description=_("messages.delete_a_note_by_identifier_a50f7cab"),
            examples=("lifeos note delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("note_id", type=UUID, help=_("messages.note_identifier_45195a2f"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_note_delete_async))


def build_note_batch_parser(
    note_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    batch_parser = add_documented_help_parser(
        note_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("messages.run_batch_note_operations_821fd597"),
            description=_(
                "messages.run_note_operations_that_target_multiple_records_in_one_d9de2136"
            ),
            examples=(
                "lifeos note batch update-content --help",
                "lifeos note batch delete --help",
            ),
            notes=(
                _("messages.use_update_content_for_bulk_find_replace_across_active_n_fb4cfbc0"),
                _("messages.use_delete_to_remove_multiple_notes_by_identifier_a1ee2b5f"),
                _("messages.batch_commands_currently_accept_note_ids_directly_f30c29ea"),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="note_batch_command",
        title=_("messages.operations_e8c39c4d"),
        metavar=_("messages.operation_fcb60bc5"),
    )

    batch_update_parser = add_documented_parser(
        batch_subparsers,
        "update-content",
        help_content=HelpContent(
            summary=_("messages.find_and_replace_note_content_in_bulk_594215fe"),
            description=(
                _("messages.apply_a_find_replace_operation_across_multiple_active_no_3ea77fbb")
                + "\n\n"
                + _("messages.this_is_the_first_batch_editing_primitive_for_notes_and_494db2ef")
            ),
            examples=(
                "lifeos note batch update-content --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222 "
                '--find-text "draft" --replace-text "final"',
                "lifeos note batch update-content --ids "
                "11111111-1111-1111-1111-111111111111 "
                '--find-text "TODO" --replace-text "DONE" --case-sensitive',
            ),
            notes=(
                _("messages.only_active_notes_are_updated_by_this_command_9e7f92dd"),
                _("messages.failed_note_ids_are_printed_to_stderr_while_successful_u_2b981ab2"),
            ),
        ),
    )
    batch_update_parser.add_argument(
        "--ids",
        dest="note_ids",
        metavar="note-id",
        nargs="+",
        required=True,
        type=UUID,
        help=_("messages.one_or_more_note_identifiers_to_update_e210092e"),
    )
    batch_update_parser.add_argument(
        "--find-text", required=True, help=_("messages.text_to_find_in_each_target_note_e147da50")
    )
    batch_update_parser.add_argument(
        "--replace-text",
        default="",
        help=_("messages.replacement_text_for_matched_content_dc465d57"),
    )
    batch_update_parser.add_argument(
        "--case-sensitive",
        action="store_true",
        help=_("messages.use_a_case_sensitive_find_replace_instead_of_case_insens_de32e20b"),
    )
    batch_update_parser.set_defaults(
        handler=make_sync_handler(handle_note_batch_update_content_async)
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_multiple_notes_328b9065"),
            description=(
                _("messages.delete_multiple_notes_in_one_command_be81a022")
                + "\n\n"
                + _("messages.this_command_mirrors_lifeos_note_delete_but_works_across_782b1718")
            ),
            examples=(
                "lifeos note batch delete --ids "
                "11111111-1111-1111-1111-111111111111 "
                "22222222-2222-2222-2222-222222222222",
            ),
            notes=(
                _("messages.failed_note_ids_are_printed_to_stderr_while_successful_d_95db6a31"),
            ),
        ),
    )
    batch_delete_parser.add_argument(
        "--ids",
        dest="note_ids",
        metavar="note-id",
        nargs="+",
        required=True,
        type=UUID,
        help=_("messages.one_or_more_note_identifiers_to_delete_34bbc196"),
    )
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_note_batch_delete_async))
