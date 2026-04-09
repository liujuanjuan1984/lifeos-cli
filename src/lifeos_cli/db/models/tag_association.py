"""Generic tag association table."""

from __future__ import annotations

from sqlalchemy import Column, ForeignKey, Index, String, Table, Uuid

from lifeos_cli.db.base import Base

tag_associations = Table(
    "tag_associations",
    Base.metadata,
    Column("entity_id", Uuid, primary_key=True, nullable=False),
    Column("entity_type", String(50), primary_key=True, nullable=False),
    Column(
        "tag_id",
        Uuid,
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
        nullable=False,
    ),
    Index("ix_tag_associations_entity", "entity_type", "entity_id"),
    Index("ix_tag_associations_tag_id", "tag_id"),
)
