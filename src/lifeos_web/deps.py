"""FastAPI dependencies for the local LifeOS Web service."""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.session import session_scope


async def get_db_session() -> AsyncIterator[AsyncSession]:
    """Yield one transactional session using the configured LifeOS database."""
    async with session_scope() as session:
        yield session
