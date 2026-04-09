"""Interactive prompts for initialization commands."""

from __future__ import annotations

import sys

from lifeos_cli.config import ConfigurationError, validate_database_schema_name, validate_database_url


def prompt_text(label: str, *, default: str | None = None) -> str:
    """Prompt for a text value."""
    suffix = f" [{default}]" if default else ""
    value = input(f"{label}{suffix}: ").strip()
    if value:
        return value
    if default is not None:
        return default
    raise ConfigurationError(f"{label} is required")


def prompt_database_url(*, default: str | None = None) -> str:
    """Prompt until a valid SQLAlchemy PostgreSQL URL is provided."""
    while True:
        candidate = prompt_text("Database URL", default=default)
        try:
            return validate_database_url(candidate)
        except ConfigurationError as exc:
            print(str(exc), file=sys.stderr)
            default = None


def prompt_database_schema(*, default: str | None = None) -> str:
    """Prompt until a valid PostgreSQL schema identifier is provided."""
    while True:
        candidate = prompt_text("Database schema", default=default)
        try:
            return validate_database_schema_name(candidate)
        except ConfigurationError as exc:
            print(str(exc), file=sys.stderr)
            default = None


def prompt_bool(label: str, *, default: bool) -> bool:
    """Prompt for a yes/no value."""
    suffix = "Y/n" if default else "y/N"
    value = input(f"{label} [{suffix}]: ").strip().lower()
    if not value:
        return default
    if value in {"y", "yes"}:
        return True
    if value in {"n", "no"}:
        return False
    raise ConfigurationError(f"{label} must be answered with yes or no")
