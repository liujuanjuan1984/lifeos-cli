"""Database maintenance CLI commands."""

from __future__ import annotations

import argparse

from lifeos_cli.application.database import (
    ping_configured_database,
    upgrade_configured_database,
)
from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_help_parser,
    add_documented_parser,
)
from lifeos_cli.cli_support.runtime_utils import (
    make_sync_handler,
)
from lifeos_cli.i18n import gettext_message as _


async def run_db_ping(_: argparse.Namespace) -> int:
    """Ping the configured database and print a success message."""
    await ping_configured_database()
    print("Database connection succeeded.")
    return 0


def run_db_upgrade(_: argparse.Namespace) -> int:
    """Apply database migrations and print a success message."""
    upgrade_configured_database()
    print("Database migrations are up to date.")
    return 0


def build_db_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the database command tree."""
    db_parser = add_documented_help_parser(
        subparsers,
        "db",
        help_content=HelpContent(
            summary=_("Run database maintenance commands"),
            description=(
                _("Inspect database connectivity and apply migrations.")
                + "\n\n"
                + _(
                    "These commands operate on the database configured through `lifeos init`, "
                    "the config file, or LIFEOS_* environment variables."
                )
            ),
            examples=(
                "lifeos db ping",
                "lifeos db upgrade",
            ),
            notes=(
                _(
                    "Use `ping` to validate the current connection settings without changing "
                    "schema."
                ),
                _(
                    "Use `upgrade` when the configured database schema needs to catch up with "
                    "the code."
                ),
            ),
        ),
    )
    db_subparsers = db_parser.add_subparsers(
        dest="db_command", title=_("actions"), metavar=_("action")
    )

    ping_parser = add_documented_parser(
        db_subparsers,
        "ping",
        help_content=HelpContent(
            summary=_("Check database connectivity"),
            description=_("Open a database connection and run a minimal health check query."),
            examples=("lifeos db ping",),
            notes=(
                _(
                    "Use this before `db upgrade` when you first need to confirm the target "
                    "database."
                ),
            ),
        ),
    )
    ping_parser.set_defaults(handler=make_sync_handler(run_db_ping))

    upgrade_parser = add_documented_parser(
        db_subparsers,
        "upgrade",
        help_content=HelpContent(
            summary=_("Apply migrations"),
            description=_("Apply Alembic migrations to the configured PostgreSQL database."),
            examples=("lifeos db upgrade",),
            notes=(
                _("This updates schema state in the database; it does not rewrite local config."),
                _(
                    "Use `db ping` first if you are unsure the current connection settings are "
                    "correct."
                ),
            ),
        ),
    )
    upgrade_parser.set_defaults(handler=run_db_upgrade)
