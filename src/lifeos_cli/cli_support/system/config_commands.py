"""Configuration and initialization CLI commands."""

from __future__ import annotations

import argparse
import sys

from lifeos_cli.application.configuration import (
    SUPPORTED_CONFIG_KEYS,
    InitializationPrompts,
    InitializationRequest,
    build_database_settings,
    build_preferences_settings,
    persist_runtime_settings,
    set_runtime_config_value,
)
from lifeos_cli.application.database import (
    ping_configured_database_in_subprocess as ping_configured_database,
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
)
from lifeos_cli.config import (
    get_database_settings,
    get_preferences_settings,
)
from lifeos_cli.i18n import gettext_message as _


def _handle_init(args: argparse.Namespace) -> int:
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
            prompt_database_url=lambda default: init_prompts.prompt_database_url(default=default),
            prompt_database_schema=lambda default: init_prompts.prompt_database_schema(
                default=default
            ),
            prompt_language=lambda default: init_prompts.prompt_language(default=default),
            prompt_database_echo=lambda default: init_prompts.prompt_bool(
                _("Enable SQL echo logging"),
                default=default,
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
        ping_configured_database()
        print("Database connection succeeded.")

    if args.skip_migrate:
        print("Skipped database migrations. Run `lifeos db upgrade` when ready.")
    else:
        upgrade_configured_database()
        print("Database migrations are up to date.")

    return 0


def _handle_config_show(args: argparse.Namespace) -> int:
    """Show the effective runtime configuration."""
    print(
        format_config_summary(
            get_database_settings(),
            get_preferences_settings(),
            show_secrets=args.show_secrets,
        )
    )
    return 0


def _handle_config_set(args: argparse.Namespace) -> int:
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


def build_init_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the init command."""
    init_parser = add_documented_parser(
        subparsers,
        "init",
        help_content=HelpContent(
            summary=_("Initialize local configuration"),
            description=(
                _("Create or update the local LifeOS config file and verify that the database")
                + "\n"
                + _("is reachable.")
                + "\n\n"
                + _("This command is the recommended first step after installing lifeos-cli.")
            ),
            examples=(
                "lifeos init",
                "lifeos init --database-url "
                "postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos",
                "lifeos init --non-interactive --database-url "
                "postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos "
                "--timezone America/Toronto --language zh-Hans --skip-migrate",
            ),
            notes=(
                _("Configuration is written to ~/.config/lifeos/config.toml by default."),
                _("Environment variables still override config file values at runtime."),
                _("Database credentials may be stored in plain text in the config file."),
                _("Preference values are also stored in the config file under [preferences]."),
                _(
                    "Interactive init explicitly confirms the language preference because agents "
                    "should use it for human-authored payload data."
                ),
                _("Re-run `lifeos init` at any time to update stored preferences."),
            ),
        ),
    )
    init_parser.add_argument(
        "--database-url",
        help=_("PostgreSQL connection URL to persist in the config file"),
    )
    init_parser.add_argument(
        "--schema",
        default=None,
        help=_("PostgreSQL schema name to use for application tables"),
    )
    init_parser.add_argument(
        "--echo",
        action=argparse.BooleanOptionalAction,
        default=None,
        help=_("Enable SQLAlchemy SQL echo logging in the config file"),
    )
    init_parser.add_argument(
        "--timezone",
        default=None,
        help=_("Default IANA timezone for local day boundaries and time-based summaries"),
    )
    init_parser.add_argument(
        "--language",
        default=None,
        help=_("Preferred language tag, for example en, en-CA, or zh-Hans"),
    )
    init_parser.add_argument(
        "--day-starts-at",
        default=None,
        help=_("Local day boundary in HH:MM, used for future time-based grouping logic"),
    )
    init_parser.add_argument(
        "--week-starts-on",
        default=None,
        help=_("Preferred first day of week: monday or sunday"),
    )
    init_parser.add_argument(
        "--vision-experience-rate-per-hour",
        type=int,
        default=None,
        help=_("Default vision experience points gained per hour of actual effort"),
    )
    init_parser.add_argument(
        "--non-interactive",
        action="store_true",
        help=_("Do not prompt for missing values; require flags or existing config values"),
    )
    init_parser.add_argument(
        "--skip-ping",
        action="store_true",
        help=_("Do not check database connectivity after writing the config file"),
    )
    init_parser.add_argument(
        "--skip-migrate",
        action="store_true",
        help=_("Do not run database migrations after writing the config file"),
    )
    init_parser.set_defaults(handler=_handle_init)


def build_config_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the config command tree."""
    config_parser = add_documented_parser(
        subparsers,
        "config",
        help_content=HelpContent(
            summary=_("Inspect runtime configuration"),
            description=(
                _("Inspect the effective configuration resolved from the config file and")
                + "\n"
                + _("environment variables.")
            ),
            examples=(
                "lifeos config show",
                "lifeos config show --show-secrets",
                "lifeos config set preferences.timezone America/Toronto",
            ),
            notes=(
                _("Use `set` to persist supported keys into the local config file."),
                _("Environment variables still override config-file values at runtime."),
                _(
                    "Agents should inspect `Preference language` before writing human-authored "
                    "titles, descriptions, or note content."
                ),
            ),
        ),
    )
    config_parser.set_defaults(handler=make_help_handler(config_parser))
    config_subparsers = config_parser.add_subparsers(
        dest="config_command",
        title=_("actions"),
        metavar=_("action"),
    )

    show_parser = add_documented_parser(
        config_subparsers,
        "show",
        help_content=HelpContent(
            summary=_("Show effective configuration"),
            description=_("Print the effective config values used by the current process."),
            examples=("lifeos config show",),
            notes=(
                _("Database URLs hide passwords by default. Use --show-secrets when needed."),
                _(
                    "Preferences are resolved from the [preferences] TOML table and optional "
                    "LIFEOS_* overrides."
                ),
                _(
                    "Agents should read the effective language and use it for human-authored "
                    "payload data unless the human explicitly overrides it."
                ),
            ),
        ),
    )
    show_parser.add_argument(
        "--show-secrets",
        action="store_true",
        help=_("Print sensitive values such as database passwords in full"),
    )
    show_parser.set_defaults(handler=_handle_config_show)

    set_parser = add_documented_parser(
        config_subparsers,
        "set",
        help_content=HelpContent(
            summary=_("Persist one config value"),
            description=_("Write one supported config key to the local config file."),
            examples=(
                "lifeos config set preferences.timezone America/Toronto",
                "lifeos config set database.echo true",
                "lifeos config set preferences.vision_experience_rate_per_hour 120",
            ),
            notes=(
                _("This command writes the config file, not environment variables."),
                _("Supported keys: {keys}").format(keys=", ".join(SUPPORTED_CONFIG_KEYS)),
                _("Use `lifeos init --schema <name>` to change the database schema binding."),
                _("Use `config show` to inspect the effective values after environment overrides."),
            ),
        ),
    )
    set_parser.add_argument("key", help=_("Supported config key to update"))
    set_parser.add_argument("value", help=_("New value to persist for the selected key"))
    set_parser.add_argument(
        "--show-secrets",
        action="store_true",
        help=_("Print sensitive values such as database passwords in full after writing"),
    )
    set_parser.set_defaults(handler=_handle_config_set)
