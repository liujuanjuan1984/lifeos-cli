"""Generic weak association model for cross-entity links."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import CheckConstraint, Index, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from lifeos_cli.db.base import Base, TimestampedMixin, UUIDPrimaryKeyMixin

VALID_ASSOCIATION_MODELS = ("note", "person", "task", "timelog")
VALID_ASSOCIATION_LINK_TYPES = ("captured_from", "is_about", "relates_to")


class Association(UUIDPrimaryKeyMixin, TimestampedMixin, Base):
    """Directional weak link between two domain entities."""

    __tablename__ = "associations"
    __table_args__ = (
        CheckConstraint(
            "source_model IN ('note', 'person', 'task', 'timelog')",
            name="ck_associations_source_model_valid",
        ),
        CheckConstraint(
            "target_model IN ('note', 'person', 'task', 'timelog')",
            name="ck_associations_target_model_valid",
        ),
        CheckConstraint(
            "link_type IN ('captured_from', 'is_about', 'relates_to')",
            name="ck_associations_link_type_valid",
        ),
        UniqueConstraint(
            "source_model",
            "source_id",
            "target_model",
            "target_id",
            "link_type",
            name="uq_associations_source_target_type",
        ),
        Index(
            "ix_associations_source_model_id_type",
            "source_model",
            "source_id",
            "link_type",
        ),
        Index(
            "ix_associations_target_model_id_type",
            "target_model",
            "target_id",
            "link_type",
        ),
    )

    source_model: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    source_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    target_model: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    target_id: Mapped[UUID] = mapped_column(Uuid, nullable=False, index=True)
    link_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    def __repr__(self) -> str:
        return (
            "Association("
            f"id={self.id!s}, "
            f"{self.source_model}:{self.source_id!s} -> "
            f"{self.target_model}:{self.target_id!s}, "
            f"link_type={self.link_type!r})"
        )
