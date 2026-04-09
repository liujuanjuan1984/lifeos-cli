"""Task model for hierarchical execution work."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifeos_cli.db.base import Base, SoftDeleteMixin, TimestampedMixin, UUIDPrimaryKeyMixin


class Task(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """Hierarchical task node that belongs to a vision."""

    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_vision_display_order_created", "vision_id", "display_order", "created_at"),
    )

    vision_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("visions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_task_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    content: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="todo", index=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    estimated_effort: Mapped[int | None] = mapped_column(Integer, nullable=True)
    planning_cycle_type: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)
    planning_cycle_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    planning_cycle_start_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    actual_effort_self: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    actual_effort_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    vision = relationship("Vision", back_populates="tasks")
    parent_task = relationship("Task", remote_side="Task.id", back_populates="subtasks")
    subtasks = relationship("Task", back_populates="parent_task", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"Task(id={self.id!s}, content={self.content!r}, status={self.status!r})"
