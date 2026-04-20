"""Initialization CLI command definitions."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import HelpContent, add_documented_parser
from lifeos_cli.cli_support.system.config_handlers import handle_init
from lifeos_cli.i18n import gettext_message as _


def build_init_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the init command."""
    init_parser = add_documented_parser(
        subparsers,
        "init",
        help_content=HelpContent(
            summary=_("Initialize local configuration"),
            description=(
                _(
                    "Create or update the local LifeOS config file and verify that the database "
                    "is reachable."
                )
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
                    "Use `config set` for supported follow-up edits when you do not need to "
                    "re-run the full bootstrap flow."
                ),
                _(
                    "Interactive init confirms the language preference because agents should use "
                    "it for human-authored payload data."
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
    init_parser.set_defaults(handler=handle_init)
