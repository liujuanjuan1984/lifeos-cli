"""Shared SQLAlchemy base classes and mixins."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import DateTime, MetaData, Uuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from lifeos_cli.config import get_database_settings

DATABASE_SCHEMA = get_database_settings().database_schema

NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def utc_now() -> datetime:
    """Return the current timestamp in UTC."""
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    """Base class for all ORM models."""

    metadata = MetaData(schema=DATABASE_SCHEMA, naming_convention=NAMING_CONVENTION)
    type_annotation_map: dict[Any, Any] = {
        UUID: Uuid,
    }


class UUIDPrimaryKeyMixin:
    """Reusable UUID primary key field."""

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)


class TimestampedMixin:
    """Reusable created/updated timestamp fields."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class SoftDeleteMixin:
    """Reusable soft-delete field."""

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    def soft_delete(self) -> None:
        """Mark a record as soft-deleted."""
        self.deleted_at = utc_now()
