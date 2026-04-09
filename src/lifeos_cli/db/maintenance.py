"""Database maintenance helpers for setup and diagnostics."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from lifeos_cli.config import get_database_settings
from lifeos_cli.db.session import get_async_engine

ROOT_DIR = Path(__file__).resolve().parents[3]


async def ping_database() -> None:
    """Validate that the configured database is reachable."""
    engine = get_async_engine()
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


def upgrade_database(revision: str = "head") -> None:
    """Apply Alembic migrations to the configured database."""
    alembic_config = Config(str(ROOT_DIR / "alembic.ini"))
    settings = get_database_settings()
    alembic_config.set_main_option("sqlalchemy.url", settings.require_database_url())
    command.upgrade(alembic_config, revision)
