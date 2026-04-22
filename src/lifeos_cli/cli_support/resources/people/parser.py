"""People resource parser construction."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
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
from lifeos_cli.i18n import cli_message as _


def build_people_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the people command tree."""
    people_parser = add_documented_help_parser(
        subparsers,
        "people",
        help_content=HelpContent(
            summary=_("messages.manage_people_and_relationships_d33e9c4a"),
            description=(
                _("messages.create_and_maintain_people_records_for_your_social_conte_4e509772")
                + "\n\n"
                + _("messages.this_resource_is_for_named_people_relationship_context_a_9831d9d0")
                + "\n\n"
                + _("messages.use_it_for_the_human_partner_and_when_useful_a_named_aut_83fce86b")
            ),
            examples=(
                "lifeos people add --help",
                "lifeos people list --help",
                "lifeos people batch --help",
            ),
            notes=(
                _("messages.people_is_the_intentional_cli_resource_name_for_this_dom_272f3498"),
                _("messages.use_list_as_the_primary_query_entrypoint_for_this_resour_6b284135"),
                _("messages.see_lifeos_people_batch_help_for_bulk_delete_operations_6d70e29b"),
                _("messages.agent_callers_should_keep_the_human_partner_and_the_auto_a71a83ca"),
            ),
        ),
    )
    people_subparsers = people_parser.add_subparsers(
        dest="people_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    add_parser = add_documented_parser(
        people_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("messages.create_a_person_2968351f"),
            description=(
                _("messages.create_a_new_person_c4ba49e5")
                + "\n\n"
                + _("messages.use_tags_nicknames_and_location_to_capture_relationship_85de19f4")
            ),
            examples=(
                'lifeos people add "Human Partner" --nickname ally --location Toronto',
                'lifeos people add "Local Agent" '
                '--description "Automation identity for CLI workflows"',
            ),
            notes=(
                _("messages.create_separate_records_when_the_human_and_the_agent_sho_7090d3b5"),
            ),
        ),
    )
    add_parser.add_argument("name", help=_("messages.person_name_d7359462"))
    add_parser.add_argument(
        "--description", help=_("messages.optional_person_description_b615a798")
    )
    add_parser.add_argument(
        "--nickname", action="append", help=_("messages.nickname_or_alias_repeatable_3f9657cf")
    )
    add_parser.add_argument(
        "--birth-date", help=_("messages.birth_date_in_iso_format_yyyy_mm_dd_220e6f81")
    )
    add_parser.add_argument("--location", help=_("messages.location_label_a69606c0"))
    add_parser.add_argument(
        "--tag-id",
        action="append",
        type=UUID,
        help=_("messages.tag_identifier_repeatable_45bbee7e"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_people_add_async))

    list_parser = add_documented_parser(
        people_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("messages.list_people_b04d9557"),
            description=(
                _("messages.list_people_with_optional_search_or_tag_filters_e2b843ed")
                + "\n\n"
                + _("messages.use_this_as_the_primary_query_entrypoint_for_people_rath_48858586")
            ),
            examples=(
                "lifeos people list",
                "lifeos people list --search ali",
                "lifeos people list --tag-id 11111111-1111-1111-1111-111111111111 --limit 20",
            ),
            notes=(
                _("messages.search_currently_matches_name_nicknames_and_location_2fed7e56"),
                _(
                    "messages.when_results_exist_the_list_command_prints_a_header_row_e9bd5ee0"
                ).format(columns=format_summary_column_list(PERSON_SUMMARY_COLUMNS)),
            ),
        ),
    )
    list_parser.add_argument(
        "--search", help=_("messages.search_by_name_nickname_or_location_f7a0b108")
    )
    list_parser.add_argument(
        "--tag-id", type=UUID, help=_("messages.filter_by_tag_identifier_32ede5f4")
    )
    add_include_deleted_argument(list_parser, noun="people")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_people_list_async))

    show_parser = add_documented_parser(
        people_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_a_person_f956427c"),
            description=_("messages.show_one_person_with_full_metadata_0cb42823"),
            examples=(
                "lifeos people show 11111111-1111-1111-1111-111111111111",
                "lifeos people show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("person_id", type=UUID, help=_("messages.person_identifier_bf1cd8a1"))
    add_include_deleted_argument(show_parser, noun="people", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_people_show_async))

    update_parser = add_documented_parser(
        people_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("messages.update_a_person_b72d2858"),
            description=(
                _("messages.update_mutable_person_fields_f22ff586")
                + "\n\n"
                + _("messages.only_explicitly_supplied_flags_are_changed_omitted_field_9f9e6dd8")
            ),
            examples=(
                'lifeos people update 11111111-1111-1111-1111-111111111111 --location "New York"',
                "lifeos people update 11111111-1111-1111-1111-111111111111 --tag-id "
                "22222222-2222-2222-2222-222222222222",
                "lifeos people update 11111111-1111-1111-1111-111111111111 "
                "--clear-nicknames --clear-tags",
                "lifeos people update 11111111-1111-1111-1111-111111111111 --clear-location",
            ),
            notes=(
                _("messages.use_clear_flags_to_remove_optional_values_instead_of_rep_513a48d5"),
            ),
        ),
    )
    update_parser.add_argument(
        "person_id", type=UUID, help=_("messages.person_identifier_bf1cd8a1")
    )
    update_parser.add_argument("--name", help=_("messages.updated_person_name_c1095f52"))
    update_parser.add_argument("--description", help=_("messages.updated_description_ce962f11"))
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("messages.clear_the_optional_person_description_439d9b1e"),
    )
    update_parser.add_argument(
        "--nickname", action="append", help=_("messages.updated_nicknames_repeatable_fceb85ac")
    )
    update_parser.add_argument(
        "--clear-nicknames",
        action="store_true",
        help=_("messages.clear_all_nicknames_dd3c53a3"),
    )
    update_parser.add_argument(
        "--birth-date", help=_("messages.updated_birth_date_in_iso_format_yyyy_mm_dd_fa173b03")
    )
    update_parser.add_argument(
        "--clear-birth-date",
        action="store_true",
        help=_("messages.clear_the_optional_birth_date_5c002535"),
    )
    update_parser.add_argument("--location", help=_("messages.updated_location_0ce63126"))
    update_parser.add_argument(
        "--clear-location",
        action="store_true",
        help=_("messages.clear_the_optional_location_df32cac8"),
    )
    update_parser.add_argument(
        "--tag-id",
        action="append",
        type=UUID,
        help=_("messages.replacement_tag_identifiers_36c9dc13"),
    )
    update_parser.add_argument(
        "--clear-tags",
        action="store_true",
        help=_("messages.remove_all_tag_associations_from_the_person_d3e66633"),
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_people_update_async))

    delete_parser = add_documented_parser(
        people_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_a_person_8d7a7e79"),
            description=_("messages.delete_a_person_cf7757af"),
            examples=("lifeos people delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument(
        "person_id", type=UUID, help=_("messages.person_identifier_bf1cd8a1")
    )
    delete_parser.set_defaults(handler=make_sync_handler(handle_people_delete_async))

    batch_parser = add_documented_help_parser(
        people_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("messages.run_batch_people_operations_2b832021"),
            description=_("messages.delete_multiple_people_records_in_one_command_92718b1b"),
            examples=(
                "lifeos people batch delete --help",
                "lifeos people batch delete --ids <person-id-1> <person-id-2>",
            ),
            notes=(
                _("messages.this_namespace_currently_exposes_only_the_delete_workflo_8e17bac4"),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="people_batch_command",
        title=_("messages.batch_actions_fb880b71"),
        metavar=_("messages.batch_action_3c29d393"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_multiple_people_f43304f6"),
            description=_("messages.delete_multiple_people_by_identifier_7390aba6"),
            examples=("lifeos people batch delete --ids <person-id-1> <person-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="person_ids", noun="person")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_people_batch_delete_async))
