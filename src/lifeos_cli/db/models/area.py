"""Area model for high-level life domains."""

from __future__ import annotations

from sqlalchemy import Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifeos_cli.db.base import Base, SoftDeleteMixin, TimestampedMixin, UUIDPrimaryKeyMixin


class Area(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """High-level area such as health, work, or relationships."""

    __tablename__ = "areas"
    __table_args__ = (
        UniqueConstraint("name", name="uq_areas_name"),
        Index("ix_areas_display_order", "display_order"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str] = mapped_column(String(7), nullable=False, default="#3B82F6")
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(nullable=False, default=0)

    visions = relationship("Vision", back_populates="area")

    def __repr__(self) -> str:
        return f"Area(id={self.id!s}, name={self.name!r}, active={self.is_active!r})"
