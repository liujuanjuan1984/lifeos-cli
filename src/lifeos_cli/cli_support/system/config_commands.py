"""Configuration CLI command definitions."""

from __future__ import annotations

import argparse

from lifeos_cli.application.configuration import SUPPORTED_CONFIG_KEYS
from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.system.config_handlers import (
    handle_config_set,
    handle_config_show,
)
from lifeos_cli.i18n import gettext_message as _


def build_config_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the config command tree."""
    config_parser = add_documented_help_parser(
        subparsers,
        "config",
        help_content=HelpContent(
            summary=_("Inspect runtime configuration"),
            description=(
                _(
                    "Inspect the effective configuration resolved from the config file and "
                    "environment variables."
                )
            ),
            examples=(
                "lifeos config show",
                "lifeos config show --show-secrets",
                "lifeos config set preferences.timezone America/Toronto",
            ),
            notes=(
                _("Use `show` to inspect effective values after config-file and env resolution."),
                _("Use `set` to persist supported keys without re-running the full init flow."),
                _("Use `set` to persist supported keys into the local config file."),
                _("Environment variables still override config-file values at runtime."),
                _(
                    "Agents should inspect `Preference language` before writing human-authored "
                    "titles, descriptions, or note content."
                ),
            ),
        ),
    )
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
            examples=(
                "lifeos config show",
                "lifeos config show --show-secrets",
            ),
            notes=(
                _("Database URLs hide passwords by default. Use --show-secrets when needed."),
                _(
                    "Preferences are resolved from the [preferences] TOML table and optional "
                    "LIFEOS_* overrides."
                ),
                _(
                    "Use `config set` to persist one supported key after reviewing the current "
                    "values."
                ),
                _(
                    "Agents should use the effective language for human-authored payload data "
                    "unless the human explicitly overrides it."
                ),
            ),
        ),
    )
    show_parser.add_argument(
        "--show-secrets",
        action="store_true",
        help=_("Print sensitive values such as database passwords in full"),
    )
    show_parser.set_defaults(handler=handle_config_show)

    set_parser = add_documented_parser(
        config_subparsers,
        "set",
        help_content=HelpContent(
            summary=_("Persist one config value"),
            description=_("Write one supported config key to the local config file."),
            examples=(
                "lifeos config set preferences.timezone America/Toronto",
                "lifeos config set database.echo true",
                "lifeos config set database.url "
                "postgresql+psycopg://<db-user>:<db-password>@localhost:5432/lifeos "
                "--show-secrets",
                "lifeos config set preferences.vision_experience_rate_per_hour 120",
            ),
            notes=(
                _("This command writes the config file, not environment variables."),
                _("Supported keys: {keys}").format(keys=", ".join(SUPPORTED_CONFIG_KEYS)),
                _(
                    "Use `lifeos init` for first-time bootstrap or when changing the schema "
                    "binding."
                ),
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
    set_parser.set_defaults(handler=handle_config_set)
