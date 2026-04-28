"""Database maintenance helpers for setup and diagnostics."""

from __future__ import annotations

from contextlib import ExitStack
from importlib.resources import as_file, files

from alembic import command
from alembic.config import Config
from sqlalchemy import text

from lifeos_cli.config import ensure_database_url_storage_ready, get_database_settings
from lifeos_cli.db.session import get_async_engine


async def ping_database() -> None:
    """Validate that the configured database is reachable."""
    engine = get_async_engine()
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


def build_alembic_config(*, sqlalchemy_url: str, stack: ExitStack) -> Config:
    """Build an Alembic config backed by packaged migration resources."""
    script_location = stack.enter_context(as_file(files("lifeos_cli.alembic")))
    alembic_config = Config()
    alembic_config.set_main_option("script_location", str(script_location))
    alembic_config.set_main_option("sqlalchemy.url", sqlalchemy_url)
    return alembic_config


def upgrade_database(revision: str = "head") -> None:
    """Apply Alembic migrations to the configured database."""
    settings = get_database_settings()
    database_url = settings.require_database_url()
    ensure_database_url_storage_ready(database_url)
    with ExitStack() as stack:
        alembic_config = build_alembic_config(
            sqlalchemy_url=database_url,
            stack=stack,
        )
        command.upgrade(alembic_config, revision)
