"""Database maintenance helpers for setup, diagnostics, and guarded purge flows."""

from __future__ import annotations

from contextlib import ExitStack
from dataclasses import dataclass
from importlib.resources import as_file, files
from typing import Any, cast
from uuid import UUID

from alembic import command
from alembic.config import Config
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.config import get_database_settings
from lifeos_cli.db.models import (
    Area,
    Event,
    Habit,
    HabitAction,
    Note,
    Person,
    Tag,
    Task,
    Timelog,
    Vision,
)
from lifeos_cli.db.models.person_association import person_associations
from lifeos_cli.db.models.tag_association import tag_associations
from lifeos_cli.db.session import get_async_engine


@dataclass(frozen=True)
class PurgeDecision:
    """Purge decision for one resource identifier."""

    status: str
    resource: str
    record_id: UUID


RESOURCE_MODELS: dict[str, Any] = {
    "note": Note,
    "area": Area,
    "event": Event,
    "habit": Habit,
    "habit-action": HabitAction,
    "tag": Tag,
    "people": Person,
    "vision": Vision,
    "task": Task,
    "timelog": Timelog,
}

RESOURCE_TAG_ENTITY_TYPES: dict[str, str] = {
    "people": "person",
    "event": "event",
    "timelog": "timelog",
}

RESOURCE_PERSON_ENTITY_TYPES: dict[str, str] = {
    "event": "event",
    "tag": "tag",
    "timelog": "timelog",
    "vision": "vision",
    "task": "task",
}


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
    with ExitStack() as stack:
        alembic_config = build_alembic_config(
            sqlalchemy_url=settings.require_database_url(),
            stack=stack,
        )
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
    tag_entity_type = RESOURCE_TAG_ENTITY_TYPES.get(resource)
    if tag_entity_type is not None:
        await session.execute(
            delete(tag_associations).where(
                tag_associations.c.entity_type == tag_entity_type,
                tag_associations.c.entity_id == record_id,
            )
        )
    person_entity_type = RESOURCE_PERSON_ENTITY_TYPES.get(resource)
    if person_entity_type is not None:
        await session.execute(
            delete(person_associations).where(
                person_associations.c.entity_type == person_entity_type,
                person_associations.c.entity_id == record_id,
            )
        )
    await session.delete(record)
    await session.flush()
    return PurgeDecision(status="purged", resource=resource, record_id=record_id)
