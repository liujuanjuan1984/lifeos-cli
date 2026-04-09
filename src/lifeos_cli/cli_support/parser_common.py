"""Reusable argument builders for resource parsers."""

from __future__ import annotations

import argparse
from uuid import UUID


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
        help=f"{help_prefix} soft-deleted {noun}",
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
        help=f"Maximum number of {row_noun}",
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=0,
        help=f"Number of {row_noun} to skip",
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
        help=f"{noun.capitalize()} identifiers to delete",
    )
