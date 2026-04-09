"""Vision model for high-level task tree containers."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifeos_cli.db.base import Base, SoftDeleteMixin, TimestampedMixin, UUIDPrimaryKeyMixin


class Vision(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """High-level container composed of one or more task trees."""

    __tablename__ = "visions"

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    stage: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    experience_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    experience_rate_per_hour: Mapped[int | None] = mapped_column(Integer, nullable=True)
    area_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("areas.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    area = relationship("Area", back_populates="visions")
    tasks = relationship("Task", back_populates="vision", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"Vision(id={self.id!s}, name={self.name!r}, status={self.status!r})"
