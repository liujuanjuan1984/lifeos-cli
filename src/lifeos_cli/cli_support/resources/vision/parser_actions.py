"""Builder helpers for core vision commands."""

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
from lifeos_cli.cli_support.resources.vision.handlers import (
    VISION_SUMMARY_COLUMNS,
    VISION_WITH_TASKS_COLUMNS,
    handle_vision_add_async,
    handle_vision_add_experience_async,
    handle_vision_batch_delete_async,
    handle_vision_delete_async,
    handle_vision_harvest_async,
    handle_vision_list_async,
    handle_vision_show_async,
    handle_vision_stats_async,
    handle_vision_sync_experience_async,
    handle_vision_update_async,
    handle_vision_with_tasks_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.i18n import cli_message as _


def build_vision_add_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision add command."""
    add_parser = add_documented_parser(
        vision_subparsers,
        "add",
        help_content=HelpContent(
            summary=_("messages.create_a_vision_ccac1771"),
            description=(
                _("messages.create_a_new_vision_7a830924")
                + "\n\n"
                + _("messages.visions_usually_represent_medium_or_long_running_themes_a00bbf01")
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
                _("messages.repeat_the_same_person_id_flag_to_associate_multiple_peo_648ea09d"),
            ),
        ),
    )
    add_parser.add_argument("name", help=_("messages.vision_name_4762f26a"))
    add_parser.add_argument(
        "--description", help=_("messages.optional_vision_description_4e953afa")
    )
    add_parser.add_argument("--status", default="active", help=_("messages.vision_status_c0b5ee3d"))
    add_parser.add_argument(
        "--area-id", type=UUID, help=_("messages.owning_area_identifier_77f31997")
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
        "--experience-rate-per-hour",
        type=int,
        help=_("messages.optional_experience_rate_3d5fc5d5"),
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
            summary=_("messages.list_visions_27359c11"),
            description=(
                _("messages.list_visions_with_optional_status_or_area_filters_644e5a7c")
                + "\n\n"
                + _("messages.use_this_as_the_primary_query_entrypoint_for_visions_e3f6feb6")
            ),
            examples=(
                "lifeos vision list",
                "lifeos vision list --status active",
                "lifeos vision list --person-id 11111111-1111-1111-1111-111111111111",
                "lifeos vision list --area-id 11111111-1111-1111-1111-111111111111 --limit 20",
            ),
            notes=(
                _(
                    "messages.when_results_exist_the_list_command_prints_a_header_row_e9bd5ee0"
                ).format(columns=format_summary_column_list(VISION_SUMMARY_COLUMNS)),
            ),
        ),
    )
    list_parser.add_argument("--status", help=_("messages.filter_by_status_f43653d7"))
    list_parser.add_argument(
        "--area-id", type=UUID, help=_("messages.filter_by_area_identifier_00c6b36e")
    )
    list_parser.add_argument(
        "--person-id", type=UUID, help=_("messages.filter_by_linked_person_identifier_8e385113")
    )
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
            summary=_("messages.show_a_vision_85f76298"),
            description=_("messages.show_one_vision_with_full_metadata_1a7b0f13"),
            examples=(
                "lifeos vision show 11111111-1111-1111-1111-111111111111",
                "lifeos vision show 11111111-1111-1111-1111-111111111111 --include-deleted",
            ),
        ),
    )
    show_parser.add_argument("vision_id", type=UUID, help=_("messages.vision_identifier_6ecf0a78"))
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
            summary=_("messages.update_a_vision_41c2c4ef"),
            description=(
                _("messages.update_mutable_vision_fields_c922951d")
                + "\n\n"
                + _("messages.only_explicitly_provided_flags_are_changed_omitted_value_552bbcfd")
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
                _("messages.valid_statuses_currently_include_active_archived_and_fru_b6d79280"),
                _("messages.use_clear_flags_to_remove_optional_values_including_peop_51e64d1c"),
                _("messages.repeat_the_same_person_id_flag_to_replace_multiple_linke_0f7ca8f3"),
            ),
        ),
    )
    update_parser.add_argument(
        "vision_id", type=UUID, help=_("messages.vision_identifier_6ecf0a78")
    )
    update_parser.add_argument("--name", help=_("messages.updated_vision_name_470542e4"))
    update_parser.add_argument(
        "--description", help=_("messages.updated_vision_description_d290f91c")
    )
    update_parser.add_argument(
        "--clear-description",
        action="store_true",
        help=_("messages.clear_the_optional_vision_description_99499062"),
    )
    update_parser.add_argument("--status", help=_("messages.updated_status_22e160b6"))
    update_parser.add_argument(
        "--area-id", type=UUID, help=_("messages.updated_area_identifier_9dd5fa89")
    )
    update_parser.add_argument(
        "--clear-area",
        action="store_true",
        help=_("messages.clear_the_optional_area_reference_41a1597e"),
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
        "--experience-rate-per-hour", type=int, help=_("messages.updated_experience_rate_8456bdcd")
    )
    update_parser.add_argument(
        "--clear-experience-rate",
        action="store_true",
        help=_("messages.clear_the_optional_experience_rate_621221b1"),
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
            summary=_("messages.delete_a_vision_6dbec190"),
            description=_("messages.delete_a_vision_37e30f6b"),
            examples=("lifeos vision delete 11111111-1111-1111-1111-111111111111",),
        ),
    )
    delete_parser.add_argument(
        "vision_id", type=UUID, help=_("messages.vision_identifier_6ecf0a78")
    )
    delete_parser.set_defaults(handler=make_sync_handler(handle_vision_delete_async))


def build_vision_with_tasks_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision with-tasks command."""
    with_tasks_parser = add_documented_parser(
        vision_subparsers,
        "with-tasks",
        help_content=HelpContent(
            summary=_("messages.show_a_vision_task_tree_0b33c8e2"),
            description=_("messages.show_one_vision_with_its_active_tasks_a0fb8058"),
            examples=("lifeos vision with-tasks 11111111-1111-1111-1111-111111111111",),
            notes=(
                _(
                    "messages.when_the_vision_has_tasks_the_tasks_section_prints_a_hea_94b38260"
                ).format(columns=format_summary_column_list(VISION_WITH_TASKS_COLUMNS)),
            ),
        ),
    )
    with_tasks_parser.add_argument(
        "vision_id", type=UUID, help=_("messages.vision_identifier_6ecf0a78")
    )
    with_tasks_parser.set_defaults(handler=make_sync_handler(handle_vision_with_tasks_async))


def build_vision_stats_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision stats command."""
    stats_parser = add_documented_parser(
        vision_subparsers,
        "stats",
        help_content=HelpContent(
            summary=_("messages.show_vision_stats_9f59d17f"),
            description=_("messages.show_task_counts_and_effort_totals_for_one_vision_bd791182"),
            examples=("lifeos vision stats 11111111-1111-1111-1111-111111111111",),
            notes=(
                _("messages.counts_and_effort_totals_aggregate_all_active_tasks_link_d6dfe4a0"),
                _("messages.use_with_tasks_when_you_need_the_row_level_task_list_ins_9fe6c946"),
            ),
        ),
    )
    stats_parser.add_argument("vision_id", type=UUID, help=_("messages.vision_identifier_6ecf0a78"))
    stats_parser.set_defaults(handler=make_sync_handler(handle_vision_stats_async))


def build_vision_add_experience_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision add-experience command."""
    add_experience_parser = add_documented_parser(
        vision_subparsers,
        "add-experience",
        help_content=HelpContent(
            summary=_("messages.add_vision_experience_2a0c55bc"),
            description=_("messages.add_manual_experience_points_to_an_active_vision_9b95545c"),
            examples=(
                "lifeos vision add-experience 11111111-1111-1111-1111-111111111111 --points 120",
            ),
            notes=(
                _("messages.use_this_for_explicit_manual_credit_rather_than_for_task_561cad36"),
                _("messages.use_sync_experience_when_experience_should_be_recomputed_75c420e1"),
            ),
        ),
    )
    add_experience_parser.add_argument(
        "vision_id", type=UUID, help=_("messages.vision_identifier_6ecf0a78")
    )
    add_experience_parser.add_argument(
        "--points",
        dest="experience_points",
        type=int,
        required=True,
        help=_("messages.experience_points_to_add_9301f02c"),
    )
    add_experience_parser.set_defaults(
        handler=make_sync_handler(handle_vision_add_experience_async)
    )


def build_vision_sync_experience_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision sync-experience command."""
    sync_experience_parser = add_documented_parser(
        vision_subparsers,
        "sync-experience",
        help_content=HelpContent(
            summary=_("messages.sync_vision_experience_54f35591"),
            description=_(
                "messages.synchronize_experience_points_from_root_task_actual_effo_f678572e"
            ),
            examples=("lifeos vision sync-experience 11111111-1111-1111-1111-111111111111",),
            notes=(
                _("messages.use_this_after_task_effort_changes_when_vision_experienc_cf3862ed"),
                _("messages.the_effective_hourly_rate_comes_from_the_vision_override_7b5da9f1"),
            ),
        ),
    )
    sync_experience_parser.add_argument(
        "vision_id", type=UUID, help=_("messages.vision_identifier_6ecf0a78")
    )
    sync_experience_parser.set_defaults(
        handler=make_sync_handler(handle_vision_sync_experience_async)
    )


def build_vision_harvest_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision harvest command."""
    harvest_parser = add_documented_parser(
        vision_subparsers,
        "harvest",
        help_content=HelpContent(
            summary=_("messages.harvest_a_vision_46968ed0"),
            description=_("messages.convert_a_mature_active_vision_to_fruit_status_c856d9c4"),
            examples=("lifeos vision harvest 11111111-1111-1111-1111-111111111111",),
            notes=(
                _("messages.this_command_succeeds_only_when_the_vision_is_active_and_7ae5db8e"),
                _("messages.a_successful_harvest_changes_the_vision_status_from_acti_86c8d2d6"),
            ),
        ),
    )
    harvest_parser.add_argument(
        "vision_id", type=UUID, help=_("messages.vision_identifier_6ecf0a78")
    )
    harvest_parser.set_defaults(handler=make_sync_handler(handle_vision_harvest_async))


def build_vision_batch_parser(
    vision_subparsers: argparse._SubParsersAction[argparse.ArgumentParser],
) -> None:
    """Build the vision batch command tree."""
    batch_parser = add_documented_help_parser(
        vision_subparsers,
        "batch",
        help_content=HelpContent(
            summary=_("messages.run_batch_vision_operations_87df7c45"),
            description=_("messages.delete_multiple_visions_in_one_command_39749616"),
            examples=(
                "lifeos vision batch delete --help",
                "lifeos vision batch delete --ids <vision-id-1> <vision-id-2>",
            ),
            notes=(
                _("messages.this_namespace_currently_exposes_only_the_delete_workflo_8e17bac4"),
            ),
        ),
    )
    batch_subparsers = batch_parser.add_subparsers(
        dest="vision_batch_command",
        title=_("messages.batch_actions_fb880b71"),
        metavar=_("messages.batch_action_3c29d393"),
    )

    batch_delete_parser = add_documented_parser(
        batch_subparsers,
        "delete",
        help_content=HelpContent(
            summary=_("messages.delete_multiple_visions_d26efe41"),
            description=_("messages.delete_multiple_visions_by_identifier_e3e3b941"),
            examples=("lifeos vision batch delete --ids <vision-id-1> <vision-id-2>",),
        ),
    )
    add_identifier_list_argument(batch_delete_parser, dest="vision_ids", noun="vision")
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_vision_batch_delete_async))
