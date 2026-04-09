"""Tag model for lightweight categorization."""

from __future__ import annotations

from sqlalchemy import Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from lifeos_cli.db.base import Base, SoftDeleteMixin, TimestampedMixin, UUIDPrimaryKeyMixin


class Tag(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """Tag that can later be linked to notes, people, tasks, or visions."""

    __tablename__ = "tags"
    __table_args__ = (
        UniqueConstraint("name", "entity_type", "category", name="uq_tags_name_type_category"),
        Index("ix_tags_name_entity_type_category", "name", "entity_type", "category"),
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, default="note")
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)

    def __repr__(self) -> str:
        return (
            f"Tag(id={self.id!s}, name={self.name!r}, entity_type={self.entity_type!r}, "
            f"category={self.category!r})"
        )
