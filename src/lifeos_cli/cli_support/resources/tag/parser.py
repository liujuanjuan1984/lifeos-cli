"""Tag resource parser construction."""

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
from lifeos_cli.cli_support.resources.tag.handlers import (
    TAG_SUMMARY_COLUMNS,
    handle_tag_add_async,
    handle_tag_batch_delete_async,
    handle_tag_delete_async,
    handle_tag_list_async,
    handle_tag_show_async,
    handle_tag_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import cli_message as _


def build_tag_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the tag command tree."""
    tag_parser = add_documented_help_parser(
        subparsers,
        "tag",
        help_content=HelpContent(
            summary=_("messages.manage_tags_b2f3136b"),
            description=(
                _("messages.create_and_maintain_tags_for_notes_people_visions_tasks_aa8183dc")
                + "\n\n"
                + _("messages.tags_provide_cross_cutting_classification_across_otherwi_e6f029e1")
            ),
            examples=(
                "lifeos tag add --help",
                "lifeos tag list --help",
                "lifeos tag batch --help",
            ),
            notes=(
                _("messages.use_list_as_the_primary_query_entrypoint_for_this_resour_6b284135"),
                _("messages.a_tag_is_scoped_by_name_entity_type_and_category_240d9f36"),
                _("messages.see_lifeos_tag_batch_help_for_bulk_delete_operations_42255f0b"),
            ),
        ),
    )
    tag_subparsers = tag_parser.add_subparsers(
        dest="tag_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    add_parser = add_documented_parser(
        tag_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("messages.create_a_tag_c5a7c043"),
            description=(
                _("messages.create_a_new_tag_3f0cd95b")
                + "\n\n"
                + _("messages.tags_are_intended_for_structured_labeling_not_free_form_822763fe")
            ),
            examples=(
                'lifeos tag add "family" --entity-type person --category relation',
                'lifeos tag add "urgent" --entity-type task --color "#DC2626"',
                "lifeos tag add "
                '"coach" --entity-type vision --person-id '
                "11111111-1111-1111-1111-111111111111",
                "lifeos tag add "
                '"shared" --entity-type task --person-id '
                "11111111-1111-1111-1111-111111111111 "
                "--person-id 22222222-2222-2222-2222-222222222222",
            ),
            notes=(
                _("messages.repeat_the_same_person_id_flag_to_associate_multiple_peo_648ea09d"),
            ),
        ),
    )
    add_parser.add_argument("name", help=_("messages.tag_name_fcf2d565"))
    add_parser.add_argument(
        "--entity-type", required=True, help=_("messages.target_entity_type_a187a48c")
    )
    add_parser.add_argument(
        "--category", default="general", help=_("messages.tag_category_29d62659")
    )
    add_parser.add_argument("--description", help=_("messages.optional_tag_description_58ce2a7b"))
    add_parser.add_argument("--color", help=_("messages.optional_hex_color_code_cce62a2d"))
    add_parser.add_argument(
        "--person-id",
        dest="person_ids",
        type=UUID,
        action="append",
        default=None,
        help=_("messages.repeat_to_associate_one_or_more_people_cf6b79d8"),
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_tag_add_async))

    list_parser = add_documented_parser(
        tag_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("messages.list_tags_2ead822e"),
            description=(
                _("messages.list_tags_with_optional_filters_2149f6e3")
                + "\n\n"
                + _("messages.use_entity_type_and_category_to_narrow_the_result_set_be_b2a39b89")
            ),
            examples=(
                "lifeos tag list",
                "lifeos tag list --entity-type person",
                "lifeos tag list --person-id 11111111-1111-1111-1111-111111111111",
                "lifeos tag list --entity-type task --category priority --limit 20",
            ),
            notes=(
                _("messages.use_include_deleted_to_review_previously_deleted_tags_c5c4b67b"),
                _(
                    "messages.when_results_exist_the_list_command_prints_a_header_row_e9bd5ee0"
                ).format(columns=format_summary_column_list(TAG_SUMMARY_COLUMNS)),
            ),
        ),
    )
    list_parser.add_argument("--entity-type", help=_("messages.filter_by_entity_type_3eb1ea0b"))
    list_parser.add_argument("--category", help=_("messages.filter_by_category_459a08e4"))
    list_parser.add_argument(
        "--person-id", type=UUID, help=_("messages.filter_by_linked_person_identifier_8e385113")
    )
    add_include_deleted_argument(list_parser, noun="tags")
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_tag_list_async))

    show_parser = add_documented_parser(
        tag_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_a_tag_aff21f85"),
            description=_("messages.show_one_tag_with_full_metadata_d3b8ed31"),
            examples=(
                "lifeos tag show 11111111-1111-1111-1111-111111111111",
                "lifeos tag show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("tag_id", type=UUID, help=_("messages.tag_identifier_c22630bb"))
    add_include_deleted_argument(show_parser, noun="tags", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_tag_show_async))

    update_parser = add_documented_parser(
        tag_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("messages.update_a_tag_6b3ffdcc"),
            description=(
                _("messages.update_mutable_tag_fields_40039218")
                + "\n\n"
                + _("messages.only_explicitly_provided_flags_are_changed_omitted_value_552bbcfd")
            ),
            examples=(
                'lifeos tag update 11111111-1111-1111-1111-111111111111 --name "urgent"',
                "lifeos tag update 11111111-1111-1111-1111-111111111111 "
                "--person-id 11111111-1111-1111-1111-111111111111",
                "lifeos tag update 11111111-1111-1111-1111-111111111111 "
                "--person-id 11111111-1111-1111-1111-111111111111 "
                "--person-id 22222222-2222-2222-2222-222222222222",
                "lifeos tag update 11111111-1111-1111-1111-111111111111 "
                "--clear-description --clear-people",
                "lifeos tag update 11111111-1111-1111-1111-111111111111 --clear-color",
            ),
            notes=(
                _("messages.use_clear_description_clear_color_or_clear_people_to_rem_6317de8d"),
                _("messages.repeat_the_same_person_id_flag_to_replace_multiple_linke_0f7ca8f3"),
            ),
        ),
    )
    update_parser.add_argument("tag_id", type=UUID, help=_("messages.tag_identifier_c22630bb"))
    update_parser.add_argument("--name", help=_("messages.updated_tag_name_07ce93cc"))
    update_parser.add_argument("--entity-type", help=_("messages.updated_entity_type_ce2779f8"))
    update_parser.add_argument("--category", help=_("messages.updated_tag_category_a81e7385"))
    update_parser.add_argument("--description", help=_("messages.updated_tag_description_a62161b1"))
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("messages.clear_the_optional_tag_description_a94227c3"),
    )
    update_parser.add_argument("--color", help=_("messages.updated_hex_color_code_e9130756"))
    update_parser.add_argument(
        "--clear-color",
        action="store_true",
        help=_("messages.clear_the_optional_tag_color_2ac78569"),
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
    update_parser.set_defaults(handler=make_sync_handler(handle_tag_update_async))

    delete_parser = add_documented_parser(
        tag_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_a_tag_5bb92738"),
            description=_("messages.delete_a_tag_e85ede86"),
            examples=("lifeos tag delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("tag_id", type=UUID, help=_("messages.tag_identifier_c22630bb"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_tag_delete_async))

    batch_parser = add_documented_help_parser(
        tag_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("messages.run_batch_tag_operations_6171641e"),
            description=_("messages.delete_multiple_tags_in_one_command_80e2112c"),
            examples=(
                "lifeos tag batch delete --help",
                "lifeos tag batch delete --ids <tag-id-1> <tag-id-2>",
            ),
            notes=(
                _("messages.this_namespace_currently_exposes_only_the_delete_workflo_8e17bac4"),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="tag_batch_command",
        title=_("messages.batch_actions_fb880b71"),
        metavar=_("messages.batch_action_3c29d393"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_multiple_tags_e69c82f8"),
            description=_("messages.delete_multiple_tags_by_identifier_bcdba42e"),
            examples=("lifeos tag batch delete --ids <tag-id-1> <tag-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="tag_ids", noun="tag")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_tag_batch_delete_async))
