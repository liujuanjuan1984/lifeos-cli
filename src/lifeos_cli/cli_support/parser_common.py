"""Reusable argument builders for resource parsers."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.time_args import parse_date_value
from lifeos_cli.i18n import cli_message as _


def add_include_deleted_argument(
    parser: argparse.ArgumentParser,
    *,
    noun: str,
    help_prefix: str = "Include",
) -> None:
    """Add a standard include-deleted flag."""
    del noun
    help_message = (
        _("common.parser.allow_loading_deleted_records")
        if help_prefix.startswith("Allow")
        else _("common.parser.include_deleted_records")
    )
    parser.add_argument(
        "--include-deleted",
        action="store_true",
        help=help_message,
    )


def add_limit_offset_arguments(
    parser: argparse.ArgumentParser,
    *,
    row_noun: str = "rows",
) -> None:
    """Add standard pagination flags."""
    del row_noun
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help=_("common.parser.maximum_number_of_results_to_return"),
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help=_("common.parser.number_of_results_to_skip"),
    )


def add_identifier_list_argument(
    parser: argparse.ArgumentParser,
    *,
    dest: str,
    noun: str,
    action_verb: str = "delete",
) -> None:
    """Add a standard repeated UUID identifier argument."""
    parser.add_argument(
        "--ids",
        dest=dest,
        metavar=f"{noun}-id",
        type=UUID,
        nargs="+",
        required=True,
        help=_("common.parser.noun_identifiers_to_action_verb").format(
            noun=noun.capitalize(),
            action_verb=action_verb,
        ),
    )


def add_date_range_arguments(
    parser: argparse.ArgumentParser,
    *,
    date_help: str,
) -> None:
    """Add a shared repeated-date argument for discrete local-date filters."""
    parser.add_argument(
        "--date",
        dest="date_values",
        action="append",
        default=None,
        type=parse_date_value,
        help=date_help,
    )


def add_start_end_date_arguments(
    parser: argparse.ArgumentParser,
    *,
    start_date_help: str,
    end_date_help: str,
) -> None:
    """Add shared explicit inclusive local-date range arguments."""
    parser.add_argument(
        "--start-date",
        dest="start_date",
        type=parse_date_value,
        help=start_date_help,
    )
    parser.add_argument(
        "--end-date",
        dest="end_date",
        type=parse_date_value,
        help=end_date_help,
    )
