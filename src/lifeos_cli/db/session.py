"""Async engine and session helpers for PostgreSQL-backed storage."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from lifeos_cli.config import get_database_settings


@lru_cache(maxsize=1)
def get_async_engine() -> AsyncEngine:
    """Return the process-wide SQLAlchemy async engine."""
    settings = get_database_settings()
    return create_async_engine(
        settings.database_url,
        echo=settings.database_echo,
        future=True,
        pool_pre_ping=True,
    )


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
