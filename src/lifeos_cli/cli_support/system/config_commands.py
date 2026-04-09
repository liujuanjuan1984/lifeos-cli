"""Configuration and initialization CLI commands."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.application.configuration import (
    InitializationPrompts,
    InitializationRequest,
    build_database_settings,
    persist_database_settings,
)
from lifeos_cli.application.database import (
    ping_configured_database,
)
from lifeos_cli.application.database import (
    upgrade_configured_database_in_subprocess as upgrade_configured_database,
)
from lifeos_cli.cli_support import init_prompts
from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_parser,
    make_help_handler,
)
from lifeos_cli.cli_support.runtime_utils import (
    format_config_summary,
    run_async,
)
from lifeos_cli.config import (
    get_database_settings,
)


async def _run_init_ping() -> int:
    """Ping the configured database during init."""
    await ping_configured_database()
    return 0


def _handle_init(args: argparse.Namespace) -> int:
    """Initialize local configuration and verify database connectivity."""
    settings = build_database_settings(
        InitializationRequest(
            database_url=args.database_url,
            schema=args.schema,
            echo=args.echo,
            non_interactive=args.non_interactive,
            is_interactive=sys.stdin.isatty(),
            prompts=InitializationPrompts(
                prompt_database_url=lambda default: init_prompts.prompt_database_url(
                    default=default
                ),
                prompt_database_schema=lambda default: init_prompts.prompt_database_schema(
                    default=default
                ),
                prompt_database_echo=lambda default: init_prompts.prompt_bool(
                    "Enable SQL echo logging",
                    default=default,
                ),
            ),
        )
    )
    config_path = persist_database_settings(settings)

    print(f"Wrote config file: {config_path}")
    print(format_config_summary(settings, show_secrets=False))

    if args.skip_ping:
        print("Skipped database connectivity check.")
    else:
        run_async(_run_init_ping())
        print("Database connection succeeded.")

    if args.skip_migrate:
        print("Skipped database migrations. Run `lifeos db upgrade` when ready.")
    else:
        upgrade_configured_database()
        print("Database migrations are up to date.")

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
