"""Area resource parser construction."""

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
from lifeos_cli.cli_support.resources.area.handlers import (
    AREA_SUMMARY_COLUMNS,
    handle_area_add_async,
    handle_area_batch_delete_async,
    handle_area_delete_async,
    handle_area_list_async,
    handle_area_show_async,
    handle_area_update_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import cli_message as _


def build_area_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the area command tree."""
    area_parser = add_documented_help_parser(
        subparsers,
        "area",
        help_content=HelpContent(
            summary=_("messages.manage_life_areas_79558ab1"),
            description=(
                _("messages.create_and_maintain_high_level_life_areas_such_as_work_h_02c63475")
                + "\n\n"
                + _("messages.areas_provide_one_of_the_top_level_organizing_layers_for_bcd4d05c")
            ),
            examples=(
                "lifeos area add --help",
                "lifeos area list --help",
                "lifeos area batch --help",
            ),
            notes=(
                _("messages.use_list_as_the_primary_query_entrypoint_for_this_resour_6b284135"),
                _("messages.use_areas_to_group_visions_and_other_higher_level_planni_444fb6ba"),
                _("messages.see_lifeos_area_batch_help_for_bulk_delete_operations_1bd2bade"),
            ),
        ),
    )
    area_subparsers = area_parser.add_subparsers(
        dest="area_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    add_parser = add_documented_parser(
        area_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("messages.create_an_area_8e9eb2bc"),
            description=(
                _("messages.create_a_new_area_16c14952")
                + "\n\n"
                + _("messages.areas_usually_represent_stable_parts_of_life_such_as_hea_28f7b0ee")
            ),
            examples=(
                'lifeos area add "Health"',
                'lifeos area add "Deep Work" --color "#2563EB" --icon brain --display-order 10',
                'lifeos area add "Travel" --inactive',
            ),
            notes=(
                _("messages.use_inactive_when_the_area_should_exist_but_not_appear_a_e4cf8899"),
            ),
        ),
    )
    add_parser.add_argument("name", help=_("messages.area_name_01cf5f96"))
    add_parser.add_argument("--description", help=_("messages.optional_area_description_342d6f34"))
    add_parser.add_argument(
        "--color", default="#3B82F6", help=_("messages.hex_color_code_28da3331")
    )
    add_parser.add_argument("--icon", help=_("messages.optional_icon_identifier_0967be8c"))
    add_parser.add_argument(
        "--inactive", action="store_true", help=_("messages.create_the_area_as_inactive_fd747c9b")
    )
    add_parser.add_argument(
        "--display-order", type=int, default=0, help=_("messages.display_order_5f1293a2")
    )
    add_parser.set_defaults(handler=make_sync_handler(handle_area_add_async))

    list_parser = add_documented_parser(
        area_subparsers,
        "list",
        help_content=HelpContent(
            summary=_("messages.list_areas_414f7b36"),
            description=(
                _("messages.list_areas_in_display_order_04c43425")
                + "\n\n"
                + _("messages.use_filters_and_pagination_flags_here_instead_of_expecti_f1312301")
            ),
            examples=(
                "lifeos area list",
                "lifeos area list --include-inactive",
                "lifeos area list --include-deleted --limit 20 --offset 20",
            ),
            notes=(
                _("messages.deleted_areas_are_hidden_unless_include_deleted_is_set_091b5038"),
                _(
                    "messages.when_results_exist_the_list_command_prints_a_header_row_e9bd5ee0"
                ).format(columns=format_summary_column_list(AREA_SUMMARY_COLUMNS)),
                _("messages.use_limit_and_offset_together_for_pagination_b8c6eaa7"),
            ),
        ),
    )
    add_include_deleted_argument(list_parser, noun="areas")
    list_parser.add_argument(
        "--include-inactive",
        action="store_true",
        help=_("messages.include_inactive_areas_7df3e3a6"),
    )
    add_limit_offset_arguments(list_parser)
    list_parser.set_defaults(handler=make_sync_handler(handle_area_list_async))

    show_parser = add_documented_parser(
        area_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("messages.show_an_area_276608fc"),
            description=(
                _("messages.show_one_area_with_full_metadata_38692192")
                + "\n\n"
                + _("messages.use_this_action_when_you_need_exact_field_values_instead_41d4f31d")
            ),
            examples=(
                "lifeos area show 11111111-1111-1111-1111-111111111111",
                "lifeos area show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
            notes=(_("messages.use_include_deleted_to_inspect_a_deleted_area_427ca406"),),
        ),
    )
    show_parser.add_argument("area_id", type=UUID, help=_("messages.area_identifier_923aed3f"))
    add_include_deleted_argument(show_parser, noun="areas", help_prefix="Allow")
    show_parser.set_defaults(handler=make_sync_handler(handle_area_show_async))

    update_parser = add_documented_parser(
        area_subparsers,
        "update",
        help_content=HelpContent(
            summary=_("messages.update_an_area_3016addc"),
            description=(
                _("messages.update_mutable_area_fields_c723e663")
                + "\n\n"
                + _("messages.only_explicitly_provided_flags_are_changed_omitted_field_c49d38d2")
            ),
            examples=(
                'lifeos area update 11111111-1111-1111-1111-111111111111 --name "Fitness"',
                "lifeos area update 11111111-1111-1111-1111-111111111111 "
                "--display-order 20 --active",
                "lifeos area update 11111111-1111-1111-1111-111111111111 --clear-description",
                "lifeos area update 11111111-1111-1111-1111-111111111111 --clear-icon",
            ),
            notes=(
                _("messages.use_clear_description_or_clear_icon_to_remove_optional_v_c2304b73"),
            ),
        ),
    )
    update_parser.add_argument("area_id", type=UUID, help=_("messages.area_identifier_923aed3f"))
    update_parser.add_argument("--name", help=_("messages.updated_area_name_b0f2901a"))
    update_parser.add_argument("--description", help=_("messages.updated_description_ce962f11"))
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("messages.clear_the_optional_area_description_c1e95242"),
    )
    update_parser.add_argument("--color", help=_("messages.updated_hex_color_code_e9130756"))
    update_parser.add_argument("--icon", help=_("messages.updated_icon_identifier_a729fbee"))
    update_parser.add_argument(
        "--clear-icon",
        action="store_true",
        help=_("messages.clear_the_optional_icon_identifier_e99d808f"),
    )
    update_parser.add_argument(
        "--active",
        action=argparse.BooleanOptionalAction,
        default=None,
        help=_("messages.toggle_whether_the_area_is_active_0ca17039"),
    )
    update_parser.add_argument(
        "--display-order", type=int, help=_("messages.updated_display_order_6dbf2e30")
    )
    update_parser.set_defaults(handler=make_sync_handler(handle_area_update_async))

    delete_parser = add_documented_parser(
        area_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_an_area_047b6f5b"),
            description=_("messages.delete_an_area_c0c5df9a"),
            examples=("lifeos area delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument("area_id", type=UUID, help=_("messages.area_identifier_923aed3f"))
    delete_parser.set_defaults(handler=make_sync_handler(handle_area_delete_async))

    batch_parser = add_documented_help_parser(
        area_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("messages.run_batch_area_operations_8e2448fe"),
            description=_("messages.delete_multiple_areas_in_one_command_77375e73"),
            examples=(
                "lifeos area batch delete --help",
                "lifeos area batch delete --ids <area-id-1> <area-id-2>",
            ),
            notes=(
                _("messages.this_namespace_currently_exposes_only_the_delete_workflo_8e17bac4"),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="area_batch_command",
        title=_("messages.batch_actions_fb880b71"),
        metavar=_("messages.batch_action_3c29d393"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_multiple_areas_38acf475"),
            description=_("messages.delete_multiple_areas_by_identifier_a959ff77"),
            examples=("lifeos area batch delete --ids <area-id-1> <area-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="area_ids", noun="area")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_area_batch_delete_async))
