"""Async transaction helpers for database services."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


async def commit_or_rollback(session: AsyncSession) -> None:
    """Commit the current transaction or roll it back when the commit fails."""
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise
