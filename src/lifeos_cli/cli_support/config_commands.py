"""Configuration and initialization CLI commands."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.cli_support.db_commands import _handle_db_ping_async, _handle_db_upgrade
from lifeos_cli.cli_support.shared import (
    HelpContent,
    add_documented_parser,
    format_config_summary,
    make_help_handler,
    refresh_runtime_configuration,
    run_async,
)
from lifeos_cli.config import (
    DEFAULT_DATABASE_SCHEMA,
    ConfigurationError,
    DatabaseSettings,
    get_database_settings,
    resolve_config_path,
    validate_database_schema_name,
    validate_database_url,
    write_database_settings,
)


def _prompt_text(label: str, *, default: str | None = None) -> str:
    """Prompt for a text value."""
    suffix = f" [{default}]" if default else ""
    value = input(f"{label}{suffix}: ").strip()
    if value:
        return value
    if default is not None:
        return default
    raise ConfigurationError(f"{label} is required")


def _prompt_database_url(*, default: str | None = None) -> str:
    """Prompt until a valid SQLAlchemy PostgreSQL URL is provided."""
    while True:
        candidate = _prompt_text("Database URL", default=default)
        try:
            return validate_database_url(candidate)
        except ConfigurationError as exc:
            print(str(exc), file=sys.stderr)
            default = None


def _prompt_database_schema(*, default: str | None = None) -> str:
    """Prompt until a valid PostgreSQL schema identifier is provided."""
    while True:
        candidate = _prompt_text("Database schema", default=default)
        try:
            return validate_database_schema_name(candidate)
        except ConfigurationError as exc:
            print(str(exc), file=sys.stderr)
            default = None


def _prompt_bool(label: str, *, default: bool) -> bool:
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


def _build_settings_from_args(args: argparse.Namespace) -> DatabaseSettings:
    """Build settings from CLI arguments and current defaults."""
    config_path = resolve_config_path()
    try:
        current = get_database_settings()
    except (ConfigurationError, ValueError):
        current = DatabaseSettings(
            database_url=None,
            database_schema=DEFAULT_DATABASE_SCHEMA,
            database_echo=False,
            config_file=config_path,
        )
    database_url = args.database_url or current.database_url
    database_schema = args.schema or current.database_schema
    database_echo = current.database_echo if args.echo is None else args.echo

    if not args.non_interactive and sys.stdin.isatty():
        if args.database_url is None:
            database_url = _prompt_database_url(default=database_url)
        if args.schema is None:
            database_schema = _prompt_database_schema(default=database_schema)
        if args.echo is None:
            database_echo = _prompt_bool("Enable SQL echo logging", default=database_echo)

    if database_url is None:
        raise ConfigurationError(
            "Database URL is required. Provide --database-url or run `lifeos init` interactively."
        )

    return DatabaseSettings(
        database_url=validate_database_url(database_url),
        database_schema=validate_database_schema_name(database_schema),
        database_echo=database_echo,
        config_file=config_path,
    )


def _handle_init(args: argparse.Namespace) -> int:
    """Initialize local configuration and verify database connectivity."""
    settings = _build_settings_from_args(args)
    config_path = write_database_settings(settings)
    refresh_runtime_configuration()

    print(f"Wrote config file: {config_path}")
    print(format_config_summary(settings, show_secrets=False))

    if args.skip_ping:
        print("Skipped database connectivity check.")
    else:
        run_async(_handle_db_ping_async(args))

    if args.skip_migrate:
        print("Skipped database migrations. Run `lifeos db upgrade` when ready.")
    else:
        _handle_db_upgrade(args)

    return 0


def _handle_config_show(args: argparse.Namespace) -> int:
    """Show the effective runtime configuration."""
    settings = get_database_settings()
    print(format_config_summary(settings, show_secrets=args.show_secrets))
    return 0


def build_init_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the init command."""
    init_parser = add_documented_parser(
        subparsers,
        "init",
        help_content=HelpContent(
            summary="Initialize local configuration",
            description=(
                "Create or update the local LifeOS config file and verify that the database\n"
                "is reachable.\n\n"
                "This command is the recommended first step after installing lifeos-cli."
            ),
            examples=(
                "lifeos init",
                "lifeos init --database-url "
                "postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos",
                "lifeos init --non-interactive --database-url "
                "postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos "
                "--skip-migrate",
            ),
            notes=(
                "Configuration is written to ~/.config/lifeos/config.toml by default.",
                "Environment variables still override config file values at runtime.",
                "Database credentials may be stored in plain text in the config file.",
            ),
        ),
    )
    init_parser.add_argument(
        "--database-url",
        help="PostgreSQL connection URL to persist in the config file",
    )
    init_parser.add_argument(
        "--schema",
        default=None,
        help="PostgreSQL schema name to use for application tables",
    )
    init_parser.add_argument(
        "--echo",
        action=argparse.BooleanOptionalAction,
        default=None,
        help="Enable SQLAlchemy SQL echo logging in the config file",
    )
    init_parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Do not prompt for missing values; require flags or existing config values",
    )
    init_parser.add_argument(
        "--skip-ping",
        action="store_true",
        help="Do not check database connectivity after writing the config file",
    )
    init_parser.add_argument(
        "--skip-migrate",
        action="store_true",
        help="Do not run database migrations after writing the config file",
    )
    init_parser.set_defaults(handler=_handle_init)


def build_config_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the config command tree."""
    config_parser = add_documented_parser(
        subparsers,
        "config",
        help_content=HelpContent(
            summary="Inspect runtime configuration",
            description=(
                "Inspect the effective configuration resolved from the config file and\n"
                "environment variables."
            ),
            examples=(
                "lifeos config show",
                "lifeos config show --show-secrets",
            ),
        ),
    )
    config_parser.set_defaults(handler=make_help_handler(config_parser))
    config_subparsers = config_parser.add_subparsers(
        dest="config_command",
        title="actions",
        metavar="action",
    )

    show_parser = add_documented_parser(
        config_subparsers,
        "show",
        help_content=HelpContent(
            summary="Show effective configuration",
            description="Print the effective config values used by the current process.",
            examples=("lifeos config show",),
            notes=("Database URLs hide passwords by default. Use --show-secrets when needed.",),
        ),
    )
    show_parser.add_argument(
        "--show-secrets",
        action="store_true",
        help="Print sensitive values such as database passwords in full",
    )
    show_parser.set_defaults(handler=_handle_config_show)
