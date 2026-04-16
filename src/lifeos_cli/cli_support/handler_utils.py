"""Shared helpers for CLI handler error rendering and validation."""

from __future__ import annotations

import sys
from collections.abc import Iterable


def print_cli_error(exc: BaseException) -> int:
    """Print one user-facing CLI error message to stderr."""
    print(str(exc), file=sys.stderr)
    return 1


def print_missing_record_error(record_label: str, record_id: object) -> int:
    """Print a consistent missing-record error message."""
    print(f"{record_label} {record_id} was not found", file=sys.stderr)
    return 1


def print_mutually_exclusive_options(left: str, right: str) -> int:
    """Print a consistent mutually-exclusive-option error message."""
    print(f"Use either {left} or {right}, not both.", file=sys.stderr)
    return 1


def validate_mutually_exclusive_pairs(
    conflicts: Iterable[tuple[bool, str, str]],
) -> int | None:
    """Validate one or more mutually-exclusive CLI option pairs."""
    for is_conflict, left, right in conflicts:
        if is_conflict:
            return print_mutually_exclusive_options(left, right)
    return None
