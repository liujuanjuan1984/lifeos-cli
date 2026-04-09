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


def upgrade_configured_database_in_subprocess() -> None:
    """Apply database migrations in a fresh process after config changes.

    This avoids using already-imported modules that may still carry a stale
    schema value from before `lifeos init` rewrote the local config.
    """
    executable = shutil.which("lifeos")
    command = (
        [executable, "db", "upgrade"]
        if executable is not None
        else [sys.executable, "-m", "lifeos_cli.cli", "db", "upgrade"]
    )
    result = subprocess.run(
        command,
        env=os.environ.copy(),
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip() or "Database migrations failed."
        raise ConfigurationError(message)
