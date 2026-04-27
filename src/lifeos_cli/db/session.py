"""Async engine and session helpers for configured database storage."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import lru_cache

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from lifeos_cli.config import get_database_settings


def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    """Enable SQLite foreign-key enforcement on each new DBAPI connection."""
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


def configure_async_engine(engine: AsyncEngine) -> AsyncEngine:
    """Apply backend-specific engine configuration."""
    if engine.sync_engine.url.get_backend_name() != "sqlite":
        return engine

    event.listen(engine.sync_engine, "connect", _enable_sqlite_foreign_keys)
    return engine


@lru_cache(maxsize=1)
def get_async_engine() -> AsyncEngine:
    """Return the process-wide SQLAlchemy async engine."""
    settings = get_database_settings()
    engine = create_async_engine(
        settings.require_database_url(),
        echo=settings.database_echo,
        future=True,
        pool_pre_ping=True,
    )
    if settings.database_schema is not None:
        engine = engine.execution_options(schema_translate_map={None: settings.database_schema})
    return configure_async_engine(engine)


@lru_cache(maxsize=1)
def get_async_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the configured SQLAlchemy async session factory."""
    return async_sessionmaker(
        bind=get_async_engine(),
        autoflush=False,
        expire_on_commit=False,
        future=True,
    )


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Open an async session and roll back automatically on failure."""
    session = get_async_session_factory()()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


def clear_session_cache() -> None:
    """Clear cached engine and session factories for the current process."""
    get_async_engine.cache_clear()
    get_async_session_factory.cache_clear()
