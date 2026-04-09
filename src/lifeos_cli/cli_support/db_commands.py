"""Database maintenance CLI commands."""

from __future__ import annotations

import argparse

from lifeos_cli.cli_support.help_utils import (
    HelpContent,
    add_documented_parser,
    make_help_handler,
)
from lifeos_cli.cli_support.runtime_utils import (
    run_async,
)


async def run_db_ping(_: argparse.Namespace) -> int:
    """Ping the configured database and print a success message."""
    from lifeos_cli.db.maintenance import ping_database

    await ping_database()
    print("Database connection succeeded.")
    return 0


def _handle_db_ping(args: argparse.Namespace) -> int:
    """Ping the configured database."""
    return run_async(run_db_ping(args))


def run_db_upgrade(_: argparse.Namespace) -> int:
    """Apply database migrations and print a success message."""
    from lifeos_cli.db.maintenance import upgrade_database

    upgrade_database()
    print("Database migrations are up to date.")
    return 0


def build_db_parser(subparsers: argparse._SubParsersAction[argparse.ArgumentParser]) -> None:
    """Build the database command tree."""
    db_parser = add_documented_parser(
        subparsers,
        "db",
        help_content=HelpContent(
            summary="Run database maintenance commands",
            description=(
                "Inspect database connectivity and apply migrations.\n\n"
                "These commands operate on the database configured through `lifeos init`,\n"
                "the config file, or LIFEOS_* environment variables."
            ),
            examples=(
                "lifeos db ping",
                "lifeos db upgrade",
            ),
        ),
    )
    db_parser.set_defaults(handler=make_help_handler(db_parser))
    db_subparsers = db_parser.add_subparsers(dest="db_command", title="actions", metavar="action")

    ping_parser = add_documented_parser(
        db_subparsers,
        "ping",
        help_content=HelpContent(
            summary="Check database connectivity",
            description="Open a database connection and run a minimal health check query.",
            examples=("lifeos db ping",),
        ),
    )
    ping_parser.set_defaults(handler=_handle_db_ping)

    upgrade_parser = add_documented_parser(
        db_subparsers,
        "upgrade",
        help_content=HelpContent(
            summary="Apply migrations",
            description="Apply Alembic migrations to the configured PostgreSQL database.",
            examples=("lifeos db upgrade",),
        ),
    )
    upgrade_parser.set_defaults(handler=run_db_upgrade)
