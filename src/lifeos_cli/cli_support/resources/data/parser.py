"""Data resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.resources.data.handlers import (
    handle_data_batch_delete_async,
    handle_data_batch_update_async,
    handle_data_export_async,
    handle_data_import_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.db.services.data_ops import SUPPORTED_DATA_RESOURCES
from lifeos_cli.i18n import cli_message as _

DATA_RESOURCE_CHOICES = tuple(SUPPORTED_DATA_RESOURCES)
EXPORT_TARGET_CHOICES = (*DATA_RESOURCE_CHOICES, "all")
IMPORT_TARGET_CHOICES = (*DATA_RESOURCE_CHOICES, "bundle")


def build_data_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the data command tree."""
    data_parser = add_documented_help_parser(
        subparsers,
        "data",
        help_content=HelpContent(
            summary=_("messages.run_unified_data_import_export_and_batch_commands_d8edd05d"),
            description=(
                _("messages.run_canonical_data_operations_across_lifeos_resources_004d5874")
                + "\n\n"
                + _("messages.use_this_namespace_for_machine_oriented_bulk_workflows_s_2a4ebcf1")
            ),
            examples=(
                "lifeos data export --help",
                "lifeos data import --help",
                "lifeos data batch-update --help",
            ),
            notes=(
                _("messages.this_namespace_uses_canonical_json_jsonl_snapshot_rows_i_93839840"),
                _("messages.use_export_output_as_the_round_trip_contract_for_later_i_80e382c1"),
                _("messages.bundle_import_export_preserves_record_identifiers_and_re_e73020e0"),
                _("messages.use_resource_specific_commands_for_higher_level_behavior_3efbe2e4"),
                _("messages.use_dry_run_before_applying_large_imports_or_batch_chang_02f7b3b5"),
            ),
        ),
    )
    data_subparsers = data_parser.add_subparsers(
        dest="data_command",
        title=_("messages.actions_326b426f"),
        metavar=_("messages.action_34eb4c4e"),
    )

    export_parser = add_documented_parser(
        data_subparsers,
        "export",
        help_content=HelpContent(
            summary=_("messages.export_one_resource_or_a_full_bundle_d4636f1c"),
            description=(
                _("messages.export_canonical_snapshot_rows_for_one_resource_or_creat_bddebae1")
                + " "
                + _("messages.bundle_export_is_implied_when_the_target_is_all_320aa071")
            ),
            examples=(
                "lifeos data export task --format jsonl",
                "lifeos data export people --format json --output people.json",
                "lifeos data export all --output lifeos-bundle.zip",
            ),
        ),
    )
    export_parser.add_argument("target", choices=EXPORT_TARGET_CHOICES)
    export_parser.add_argument(
        "--format",
        choices=("jsonl", "json", "bundle"),
        default="jsonl",
        help=_("messages.export_format_for_one_resource_bundle_is_implied_for_all_b06717a7"),
    )
    export_parser.add_argument(
        "--output", help=_("messages.write_exported_data_to_a_file_instead_of_stdout_2c8a427b")
    )
    export_parser.add_argument(
        "--exclude-deleted",
        action="store_true",
        help=_("messages.exclude_deleted_rows_from_exported_snapshots_4b7838c9"),
    )
    export_parser.set_defaults(handler=make_sync_handler(handle_data_export_async))

    import_parser = add_documented_parser(
        data_subparsers,
        "import",
        help_content=HelpContent(
            summary=_("messages.import_one_resource_or_a_full_bundle_efc44b7e"),
            description=(
                _("messages.import_canonical_snapshot_rows_for_one_resource_or_resto_eea26ee9")
                + " "
                + _("messages.bundle_import_is_implied_when_the_target_is_bundle_c4c2622b")
            ),
            examples=(
                "lifeos data import timelog --file timelog.jsonl --format jsonl",
                "lifeos data import note --stdin --format json",
                "lifeos data import bundle --file lifeos-bundle.zip --replace-existing",
            ),
            notes=(
                _("messages.use_import_bundle_for_full_backup_restore_bundle_restore_957d578b"),
                _("messages.single_resource_imports_expect_referenced_foreign_rows_t_fc35cf01"),
                _("messages.use_dry_run_before_applying_a_large_file_or_a_full_bundl_82b591fe"),
            ),
        ),
    )
    import_parser.add_argument("target", choices=IMPORT_TARGET_CHOICES)
    import_parser.add_argument("--file", help=_("messages.read_input_data_from_a_file_5cf0402f"))
    import_parser.add_argument(
        "--stdin", action="store_true", help=_("messages.read_input_data_from_stdin_cf996286")
    )
    import_parser.add_argument(
        "--format",
        choices=("jsonl", "json", "bundle"),
        default="jsonl",
        help=_("messages.input_format_for_one_resource_bundle_is_implied_for_impo_f7840b78"),
    )
    import_parser.add_argument(
        "--dry-run",
        action="store_true",
        help=_("messages.validate_input_without_committing_1341e3f6"),
    )
    import_parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help=_("messages.continue_processing_later_rows_after_a_failure_38a2cc47"),
    )
    import_parser.add_argument(
        "--replace-existing",
        action="store_true",
        help=_("messages.for_bundle_imports_truncate_supported_data_before_restor_35fdf1d0"),
    )
    import_parser.add_argument(
        "--error-file", help=_("messages.write_row_level_failures_to_a_jsonl_file_42e8339d")
    )
    import_parser.set_defaults(handler=make_sync_handler(handle_data_import_async))

    batch_update_parser = add_documented_parser(
        data_subparsers,
        "batch-update",
        help_content=HelpContent(
            summary=_("messages.batch_update_one_resource_from_canonical_patch_rows_df6d0e83"),
            description=(
                _("messages.apply_patch_rows_to_one_resource_using_the_same_canonica_a5f4d924")
                + " "
                + _("messages.omitted_fields_stay_unchanged_explicit_null_clears_clear_8fc2d646")
            ),
            examples=(
                "lifeos data batch-update timelog --file timelog-patch.jsonl --format jsonl",
                "lifeos data batch-update people --stdin --format json",
                "lifeos data batch-update event --file event-patch.jsonl --format jsonl "
                "--dry-run --error-file event-errors.jsonl",
            ),
            notes=(
                _("messages.batch_update_operates_on_stored_records_use_public_resou_b8a77862"),
                _("messages.start_from_data_export_output_when_preparing_machine_gen_c318245a"),
            ),
        ),
    )
    batch_update_parser.add_argument("target", choices=DATA_RESOURCE_CHOICES)
    batch_update_parser.add_argument(
        "--file", help=_("messages.read_patch_rows_from_a_file_6feac3a2")
    )
    batch_update_parser.add_argument(
        "--stdin",
        action="store_true",
        help=_("messages.read_patch_rows_from_stdin_c9181a84"),
    )
    batch_update_parser.add_argument("--format", choices=("jsonl", "json"), default="jsonl")
    batch_update_parser.add_argument(
        "--dry-run",
        action="store_true",
        help=_("messages.validate_without_committing_37c8796c"),
    )
    batch_update_parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help=_("messages.continue_processing_later_rows_after_a_failure_38a2cc47"),
    )
    batch_update_parser.add_argument(
        "--error-file",
        help=_("messages.write_row_level_failures_to_a_jsonl_file_42e8339d"),
    )
    batch_update_parser.set_defaults(handler=make_sync_handler(handle_data_batch_update_async))

    batch_delete_parser = add_documented_parser(
        data_subparsers,
        "batch-delete",
        help_content=HelpContent(
            summary=_("messages.batch_delete_one_resource_by_identifiers_4bc971be"),
            description=(
                _("messages.delete_multiple_rows_for_one_resource_using_repeated_ids_294cda00")
            ),
            examples=(
                "lifeos data batch-delete task --id <task-id-1> --id <task-id-2>",
                "lifeos data batch-delete event --ids-file event-ids.txt",
                "lifeos data batch-delete timelog --file timelog-export.jsonl --format jsonl",
            ),
            notes=(
                _("messages.use_this_command_for_file_driven_or_machine_generated_cl_d16a0d93"),
                _("messages.use_resource_specific_delete_commands_when_you_want_narr_5d634a3a"),
            ),
        ),
    )
    batch_delete_parser.add_argument("target", choices=DATA_RESOURCE_CHOICES)
    batch_delete_parser.add_argument(
        "--id",
        dest="record_ids",
        action="append",
        help=_("messages.repeat_to_delete_one_or_more_record_identifiers_77b6fcfa"),
    )
    batch_delete_parser.add_argument(
        "--ids-file", help=_("messages.read_one_uuid_per_line_from_a_file_37bbd563")
    )
    batch_delete_parser.add_argument(
        "--file", help=_("messages.read_identifiers_or_resource_rows_from_a_file_62aea967")
    )
    batch_delete_parser.add_argument(
        "--stdin",
        action="store_true",
        help=_("messages.read_identifiers_from_stdin_7c52ef0a"),
    )
    batch_delete_parser.add_argument(
        "--format",
        choices=("plain", "jsonl", "json"),
        default="plain",
    )
    batch_delete_parser.add_argument(
        "--dry-run",
        action="store_true",
        help=_("messages.validate_without_committing_37c8796c"),
    )
    batch_delete_parser.add_argument(
        "--error-file",
        help=_("messages.write_row_level_failures_to_a_jsonl_file_42e8339d"),
    )
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_data_batch_delete_async))
