"""Habit model for recurring practices that generate dated actions."""

from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifeos_cli.db.base import Base, SoftDeleteMixin, TimestampedMixin, UUIDPrimaryKeyMixin
from lifeos_cli.time_preferences import get_operational_date


class Habit(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """Recurring habit template that can generate dated action rows."""

    __tablename__ = "habits"
    __table_args__ = (
        Index("ix_habits_title", "title"),
        Index("ix_habits_start_date", "start_date"),
        Index("ix_habits_status", "status"),
        Index("ix_habits_task_id", "task_id"),
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    task_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )

    task = relationship("Task", foreign_keys=[task_id])
    actions = relationship(
        "HabitAction",
        back_populates="habit",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def end_date(self) -> date:
        """Return the computed final date covered by the habit."""
        return self.start_date + timedelta(days=self.duration_days - 1)

    @property
    def is_completed(self) -> bool:
        """Return whether the habit duration has fully elapsed."""
        return get_operational_date() > self.end_date

    @property
    def progress_percentage(self) -> float:
        """Return progress based on the current date and duration."""
        if self.is_completed:
            return 100.0
        days_elapsed = (get_operational_date() - self.start_date).days + 1
        if days_elapsed <= 0:
            return 0.0
        return min(100.0, (days_elapsed / self.duration_days) * 100.0)

    def __repr__(self) -> str:
        return (
            f"Habit(id={self.id!s}, title={self.title!r}, "
            f"status={self.status!r}, duration_days={self.duration_days})"
        )
