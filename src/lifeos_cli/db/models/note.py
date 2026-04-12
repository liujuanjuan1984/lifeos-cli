"""Note model for low-friction personal capture."""

from __future__ import annotations

from sqlalchemy import Index, Text
from sqlalchemy.orm import Mapped, mapped_column

from lifeos_cli.db.base import Base, SoftDeleteMixin, TimestampedMixin, UUIDPrimaryKeyMixin


class Note(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """Persisted note content."""

    __tablename__ = "notes"
    __table_args__ = (
        Index("ix_notes_created_at", "created_at"),
        Index("ix_notes_deleted_at", "deleted_at"),
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    def __repr__(self) -> str:
        preview = self.content[:40]
        if len(self.content) > 40:
            preview += "..."
        return f"Note(id={self.id!s}, content={preview!r})"
