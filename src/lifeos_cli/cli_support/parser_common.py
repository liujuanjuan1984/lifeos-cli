"""Reusable argument builders for resource parsers."""

from __future__ import annotations

import argparse
from uuid import UUID

from lifeos_cli.cli_support.time_args import parse_date_value
from lifeos_cli.i18n import gettext_message as _


def add_include_deleted_argument(
    parser: argparse.ArgumentParser,
    *,
    noun: str,
    help_prefix: str = "Include",
) -> None:
    """Add a standard include-deleted flag."""
    parser.add_argument(
        "--include-deleted",
        action="store_true",
        help=_("{help_prefix} soft-deleted {noun}").format(help_prefix=help_prefix, noun=noun),
    )


def add_limit_offset_arguments(
    parser: argparse.ArgumentParser,
    *,
    row_noun: str = "rows",
) -> None:
    """Add standard pagination flags."""
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help=_("Maximum number of {row_noun}").format(row_noun=row_noun),
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help=_("Number of {row_noun} to skip").format(row_noun=row_noun),
    )


def add_identifier_list_argument(
    parser: argparse.ArgumentParser,
    *,
    dest: str,
    noun: str,
) -> None:
    """Add a standard repeated UUID identifier argument."""
    parser.add_argument(
        "--ids",
        dest=dest,
        metavar=f"{noun}-id",
        type=UUID,
        nargs="+",
        required=True,
        help=_("{noun} identifiers to delete").format(noun=noun.capitalize()),
    )


def add_date_range_arguments(
    parser: argparse.ArgumentParser,
    *,
    date_help: str,
) -> None:
    """Add a shared repeated-date argument for inclusive local-date intervals."""
    parser.add_argument(
        "--date",
        dest="date_values",
        action="append",
        default=None,
        type=parse_date_value,
        help=date_help,
    )
