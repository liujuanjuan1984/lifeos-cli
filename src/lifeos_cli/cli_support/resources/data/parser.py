"""Data resource parser construction."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser, make_help_handler
from lifeos_cli.cli_support.resources.data.handlers import (
    handle_data_batch_delete_async,
    handle_data_batch_update_async,
    handle_data_export_async,
    handle_data_import_async,
)
from lifeos_cli.cli_support.runtime_utils import make_sync_handler
from lifeos_cli.db.services.data_ops import SUPPORTED_DATA_RESOURCES
from lifeos_cli.i18n import gettext_message as _

DATA_RESOURCE_CHOICES = tuple(SUPPORTED_DATA_RESOURCES)
EXPORT_TARGET_CHOICES = (*DATA_RESOURCE_CHOICES, "all")
IMPORT_TARGET_CHOICES = (*DATA_RESOURCE_CHOICES, "bundle")


def build_data_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the data command tree."""
    data_parser = add_documented_parser(
        subparsers,
        "data",
        help_content=HelpContent(
            summary=_("Run unified data import/export and batch commands"),
            description=(
                _("Run canonical data operations across LifeOS resources.")
                + "\n\n"
                + _(
                    "Use this namespace for machine-oriented bulk workflows such as export, "
                    "import, "
                    "batch update, batch delete, and full bundle backup or restore."
                )
            ),
            examples=(
                "lifeos data export --help",
                "lifeos data import --help",
                "lifeos data batch-update --help",
            ),
            notes=(
                _(
                    "This namespace uses canonical JSON/JSONL snapshot rows instead of ad-hoc "
                    "CLI flags."
                ),
                _(
                    "Use `export` output as the round-trip contract for later `import` or "
                    "`batch-update`."
                ),
                _(
                    "Bundle import/export preserves record identifiers and relationships across "
                    "resources."
                ),
                _(
                    "Use resource-specific commands for higher-level behaviors such as recurring "
                    "event occurrence scopes."
                ),
                _("Use `--dry-run` before applying large imports or batch changes."),
            ),
        ),
    )
    data_parser.set_defaults(handler=make_help_handler(data_parser))
    data_subparsers = data_parser.add_subparsers(
        dest="data_command", title=_("actions"), metavar=_("action")
    )

    export_parser = add_documented_parser(
        data_subparsers,
        "export",
        help_content=HelpContent(
            summary=_("Export one resource or a full bundle"),
            description=(
                _(
                    "Export canonical snapshot rows for one resource, or create a full bundle "
                    "zip covering all supported resources."
                )
                + " "
                + _("Bundle export is implied when the target is `all`.")
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
        help=_("Export format for one resource; bundle is implied for `all`"),
    )
    export_parser.add_argument(
        "--output", help=_("Write exported data to a file instead of stdout")
    )
    export_parser.add_argument(
        "--exclude-deleted",
        action="store_true",
        help=_("Exclude soft-deleted rows from exported snapshots"),
    )
    export_parser.set_defaults(handler=make_sync_handler(handle_data_export_async))

    import_parser = add_documented_parser(
        data_subparsers,
        "import",
        help_content=HelpContent(
            summary=_("Import one resource or a full bundle"),
            description=(
                _(
                    "Import canonical snapshot rows for one resource, or restore a full bundle "
                    "zip containing multiple resources."
                )
                + " "
                + _("Bundle import is implied when the target is `bundle`.")
            ),
            examples=(
                "lifeos data import timelog --file timelog.jsonl --format jsonl",
                "lifeos data import note --stdin --format json",
                "lifeos data import bundle --file lifeos-bundle.zip --replace-existing",
            ),
            notes=(
                _(
                    "Use `import bundle` for full backup restore. Bundle restore is atomic and "
                    "restores base rows before relation links."
                ),
                _("Single-resource imports expect referenced foreign rows to already exist."),
            ),
        ),
    )
    import_parser.add_argument("target", choices=IMPORT_TARGET_CHOICES)
    import_parser.add_argument("--file", help=_("Read input data from a file"))
    import_parser.add_argument("--stdin", action="store_true", help=_("Read input data from stdin"))
    import_parser.add_argument(
        "--format",
        choices=("jsonl", "json", "bundle"),
        default="jsonl",
        help=_("Input format for one resource; bundle is implied for `import bundle`"),
    )
    import_parser.add_argument(
        "--dry-run",
        action="store_true",
        help=_("Validate input without committing"),
    )
    import_parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help=_("Continue processing later rows after a failure"),
    )
    import_parser.add_argument(
        "--replace-existing",
        action="store_true",
        help=_("For bundle imports, truncate supported data before restoring the bundle"),
    )
    import_parser.add_argument("--error-file", help=_("Write row-level failures to a JSONL file"))
    import_parser.set_defaults(handler=make_sync_handler(handle_data_import_async))

    batch_update_parser = add_documented_parser(
        data_subparsers,
        "batch-update",
        help_content=HelpContent(
            summary=_("Batch-update one resource from canonical patch rows"),
            description=(
                _(
                    "Apply patch rows to one resource using the same canonical record shape "
                    "used by data export."
                )
                + " "
                + _("Omitted fields stay unchanged; explicit null clears clearable fields.")
            ),
            examples=(
                "lifeos data batch-update timelog --file timelog-patch.jsonl --format jsonl",
                "lifeos data batch-update people --stdin --format json",
            ),
            notes=(
                _(
                    "Batch-update operates on stored records. Use public resource commands "
                    "when you need domain-specific verbs or scopes."
                ),
            ),
        ),
    )
    batch_update_parser.add_argument("target", choices=DATA_RESOURCE_CHOICES)
    batch_update_parser.add_argument("--file", help=_("Read patch rows from a file"))
    batch_update_parser.add_argument(
        "--stdin",
        action="store_true",
        help=_("Read patch rows from stdin"),
    )
    batch_update_parser.add_argument("--format", choices=("jsonl", "json"), default="jsonl")
    batch_update_parser.add_argument(
        "--dry-run",
        action="store_true",
        help=_("Validate without committing"),
    )
    batch_update_parser.add_argument(
        "--continue-on-error",
        action="store_true",
        help=_("Continue processing later rows after a failure"),
    )
    batch_update_parser.add_argument(
        "--error-file",
        help=_("Write row-level failures to a JSONL file"),
    )
    batch_update_parser.set_defaults(handler=make_sync_handler(handle_data_batch_update_async))

    batch_delete_parser = add_documented_parser(
        data_subparsers,
        "batch-delete",
        help_content=HelpContent(
            summary=_("Batch-delete one resource by identifiers"),
            description=(
                _(
                    "Soft-delete multiple rows for one resource using repeated IDs, an IDs "
                    "file, or JSON/JSONL input containing row IDs."
                )
            ),
            examples=(
                "lifeos data batch-delete task --id <task-id-1> --id <task-id-2>",
                "lifeos data batch-delete event --ids-file event-ids.txt",
                "lifeos data batch-delete timelog --file timelog-export.jsonl --format jsonl",
            ),
        ),
    )
    batch_delete_parser.add_argument("target", choices=DATA_RESOURCE_CHOICES)
    batch_delete_parser.add_argument(
        "--id",
        dest="record_ids",
        action="append",
        help=_("Repeat to delete one or more record identifiers"),
    )
    batch_delete_parser.add_argument("--ids-file", help=_("Read one UUID per line from a file"))
    batch_delete_parser.add_argument(
        "--file", help=_("Read identifiers or resource rows from a file")
    )
    batch_delete_parser.add_argument(
        "--stdin",
        action="store_true",
        help=_("Read identifiers from stdin"),
    )
    batch_delete_parser.add_argument(
        "--format",
        choices=("plain", "jsonl", "json"),
        default="plain",
    )
    batch_delete_parser.add_argument(
        "--dry-run",
        action="store_true",
        help=_("Validate without committing"),
    )
    batch_delete_parser.add_argument(
        "--error-file",
        help=_("Write row-level failures to a JSONL file"),
    )
    batch_delete_parser.set_defaults(handler=make_sync_handler(handle_data_batch_delete_async))
