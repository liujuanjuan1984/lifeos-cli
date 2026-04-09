"""Habit action model for dated habit execution records."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifeos_cli.db.base import Base, SoftDeleteMixin, TimestampedMixin, UUIDPrimaryKeyMixin
from lifeos_cli.db.services.habit_support import get_default_habit_action_status


class HabitAction(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """One dated execution record for a habit."""

    __tablename__ = "habit_actions"
    __table_args__ = (
        Index("ix_habit_actions_habit_id", "habit_id"),
        Index("ix_habit_actions_action_date", "action_date"),
        Index("ix_habit_actions_status", "status"),
        Index(
            "uq_habit_actions_habit_id_action_date_active",
            "habit_id",
            "action_date",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    habit_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("habits.id", ondelete="CASCADE"),
        nullable=False,
    )
    action_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=get_default_habit_action_status,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    habit = relationship("Habit", back_populates="actions")

    def __repr__(self) -> str:
        return (
            f"HabitAction(id={self.id!s}, habit_id={self.habit_id!s}, "
            f"action_date={self.action_date!s}, status={self.status!r})"
        )
