"""Timelog quick template model."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import ForeignKey, Index, Integer, String, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifeos_cli.db.base import Base, SoftDeleteMixin, TimestampedMixin, UUIDPrimaryKeyMixin
from lifeos_cli.db.types import UTCDateTime


class TimelogTemplate(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """Reusable quick-entry template for creating timelog records."""

    __tablename__ = "timelog_templates"
    __table_args__ = (
        Index(
            "uq_timelog_templates_title_normalized_active",
            "title_normalized",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("ix_timelog_templates_area_id", "area_id"),
        Index("ix_timelog_templates_position", "position"),
        Index("ix_timelog_templates_usage", "usage_count", "last_used_at"),
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    title_normalized: Mapped[str] = mapped_column(String(200), nullable=False)
    area_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("areas.id", ondelete="SET NULL"),
        nullable=True,
    )
    default_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)

    area = relationship("Area", foreign_keys=[area_id])

    def touch_usage(self, *, when: datetime) -> None:
        """Record one use of this template."""
        self.usage_count = (self.usage_count or 0) + 1
        self.last_used_at = when

    def __repr__(self) -> str:
        return f"TimelogTemplate(id={self.id!s}, title={self.title!r}, position={self.position!r})"
