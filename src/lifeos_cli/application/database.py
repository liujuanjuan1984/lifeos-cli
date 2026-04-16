"""Database workflows shared by CLI entrypoints."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

from lifeos_cli.config import ConfigurationError
from lifeos_cli.db.maintenance import ping_database, upgrade_database


async def ping_configured_database() -> None:
    """Ping the configured database."""
    await ping_database()


def upgrade_configured_database() -> None:
    """Apply database migrations to the configured database."""
    upgrade_database()


def _run_database_command_in_subprocess(*, subcommand: str, failure_message: str) -> None:
    """Run one database CLI command in a fresh process after config changes.

    This keeps post-init database actions aligned with the newly written
    schema binding without mutating already-imported ORM metadata in-process.
    """
    executable = shutil.which("lifeos")
    command = (
        [executable, "db", subcommand]
        if executable is not None
        else [sys.executable, "-m", "lifeos_cli.cli", "db", subcommand]
    )
    result = subprocess.run(
        command,
        env=os.environ.copy(),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip() or failure_message
        raise ConfigurationError(message)


def ping_configured_database_in_subprocess() -> None:
    """Ping the configured database in a fresh process after config changes."""
    _run_database_command_in_subprocess(
        subcommand="ping",
        failure_message="Database connectivity check failed.",
    )


def upgrade_configured_database_in_subprocess() -> None:
    """Apply database migrations in a fresh process after config changes."""
    _run_database_command_in_subprocess(
        subcommand="upgrade",
        failure_message="Database migrations failed.",
    )
