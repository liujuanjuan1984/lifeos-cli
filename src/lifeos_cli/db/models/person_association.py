"""Generic person association table."""

from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Index, String, Table, UniqueConstraint, Uuid

from lifeos_cli.db.base import Base

person_associations = Table(
    "person_associations",
    Base.metadata,
    Column("entity_type", String(50), nullable=False),
    Column("entity_id", Uuid(as_uuid=True), nullable=False),
    Column(
        "person_id",
        Uuid(as_uuid=True),
        ForeignKey("people.id", ondelete="CASCADE"),
        nullable=False,
    ),
    UniqueConstraint(
        "entity_type",
        "entity_id",
        "person_id",
        name="uq_person_associations_entity_person",
    ),
    Index("ix_person_associations_entity", "entity_type", "entity_id"),
    Index("ix_person_associations_person_id", "person_id"),
)
