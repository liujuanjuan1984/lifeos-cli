"""Event model for planned schedule blocks."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifeos_cli.db.base import Base, SoftDeleteMixin, TimestampedMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from lifeos_cli.db.models.person import Person
    from lifeos_cli.db.models.tag import Tag


class Event(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """Planned calendar event that may optionally point to a task and area."""

    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_status_start_time", "status", "start_time"),
        Index("ix_events_area_id", "area_id"),
        Index("ix_events_task_id", "task_id"),
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    end_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned", index=True)
    is_all_day: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    area_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("areas.id", ondelete="SET NULL"),
        nullable=True,
    )
    task_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )

    area = relationship("Area", foreign_keys=[area_id])
    task = relationship("Task", foreign_keys=[task_id])

    if TYPE_CHECKING:
        tags: list[Tag]
        people: list[Person]

    def __repr__(self) -> str:
        return f"Event(id={self.id!s}, title={self.title!r}, status={self.status!r})"
