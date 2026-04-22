"""Execution handlers for initialization and configuration commands."""

from __future__ import annotations

import argparse
import sys
from functools import partial

from lifeos_cli.application.configuration import (
    InitializationPrompts,
    InitializationRequest,
    build_database_settings,
    build_preferences_settings,
    persist_runtime_settings,
    set_runtime_config_value,
)
from lifeos_cli.application.database import run_configured_database_subcommand_in_subprocess
from lifeos_cli.cli_support import init_prompts
from lifeos_cli.cli_support.runtime_utils import format_config_summary
from lifeos_cli.config import (
    get_database_settings,
    get_preferences_settings,
    validate_database_schema_name,
    validate_database_url,
    validate_language,
)
from lifeos_cli.i18n import cli_message as _


def handle_init(args: argparse.Namespace) -> int:
    """Initialize local configuration and verify database connectivity."""
    request = InitializationRequest(
        database_url=args.database_url,
        schema=args.schema,
        echo=args.echo,
        timezone=args.timezone,
        language=args.language,
        day_starts_at=args.day_starts_at,
        week_starts_on=args.week_starts_on,
        vision_experience_rate_per_hour=args.vision_experience_rate_per_hour,
        non_interactive=args.non_interactive,
        is_interactive=sys.stdin.isatty(),
        prompts=InitializationPrompts(
            prompt_database_url=partial(
                init_prompts.prompt_validated_text,
                "Database URL",
                validator=validate_database_url,
            ),
            prompt_database_schema=partial(
                init_prompts.prompt_validated_text,
                "Database schema",
                validator=validate_database_schema_name,
            ),
            prompt_language=partial(
                init_prompts.prompt_validated_text,
                "Preferred language tag for human-authored payloads",
                validator=validate_language,
            ),
            prompt_database_echo=partial(
                init_prompts.prompt_bool,
                _("messages.enable_sql_echo_logging_47e24c6b"),
            ),
        ),
    )
    database_settings = build_database_settings(request)
    preferences_settings = build_preferences_settings(request)
    config_path = persist_runtime_settings(database_settings, preferences_settings)

    print(f"Wrote config file: {config_path}")
    print(
        format_config_summary(
            database_settings,
            preferences_settings,
            show_secrets=False,
        )
    )

    if args.skip_ping:
        print("Skipped database connectivity check.")
    else:
        run_configured_database_subcommand_in_subprocess(subcommand="ping")
        print("Database connection succeeded.")

    if args.skip_migrate:
        print("Skipped database migrations. Run `lifeos db upgrade` when ready.")
    else:
        run_configured_database_subcommand_in_subprocess(subcommand="upgrade")
        print("Database migrations are up to date.")

    return 0


def handle_config_show(args: argparse.Namespace) -> int:
    """Show the effective runtime configuration."""
    print(
        format_config_summary(
            get_database_settings(),
            get_preferences_settings(),
            show_secrets=args.show_secrets,
        )
    )
    return 0


def handle_config_set(args: argparse.Namespace) -> int:
    """Persist one supported config key to the local config file."""
    result = set_runtime_config_value(key=args.key, value=args.value)
    print(f"Updated config file: {result.config_path}")
    print(f"Updated key: {result.key}")
    print(
        format_config_summary(
            result.database_settings,
            result.preferences_settings,
            show_secrets=args.show_secrets,
        )
    )
    return 0
