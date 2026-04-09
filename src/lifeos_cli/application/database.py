"""Database workflows shared by CLI entrypoints."""

from __future__ import annotations

from lifeos_cli.db.maintenance import ping_database, upgrade_database


async def ping_configured_database() -> None:
    """Ping the configured database."""
    await ping_database()


def upgrade_configured_database() -> None:
    """Apply database migrations to the configured database."""
    upgrade_database()
