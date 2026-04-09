"""Database maintenance helpers for setup, diagnostics, and guarded purge flows."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast
from uuid import UUID

from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.config import get_database_settings
from lifeos_cli.db.models import Area, Note, Person, Tag, Task, Vision
from lifeos_cli.db.session import get_async_engine

ROOT_DIR = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class PurgeDecision:
    """Purge decision for one resource identifier."""

    status: str
    resource: str
    record_id: UUID


RESOURCE_MODELS: dict[str, Any] = {
    "note": Note,
    "area": Area,
    "tag": Tag,
    "people": Person,
    "vision": Vision,
    "task": Task,
}


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


async def purge_soft_deleted_record(
    session: AsyncSession,
    *,
    resource: str,
    record_id: UUID,
) -> PurgeDecision:
    """Permanently delete one already-soft-deleted record."""
    model = RESOURCE_MODELS[resource]
    record = cast(
        Any, await session.execute(select(model).where(model.id == record_id).limit(1))
    ).scalar_one_or_none()
    if record is None:
        return PurgeDecision(status="missing", resource=resource, record_id=record_id)
    if record.deleted_at is None:
        return PurgeDecision(status="active", resource=resource, record_id=record_id)
    await session.delete(record)
    await session.flush()
    return PurgeDecision(status="purged", resource=resource, record_id=record_id)
