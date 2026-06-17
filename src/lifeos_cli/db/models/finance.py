"""Unified finance tree and snapshot models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import JSON, Boolean, ForeignKey, Index, Integer, Numeric, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifeos_cli.db.base import Base, SoftDeleteMixin, TimestampedMixin, UUIDPrimaryKeyMixin
from lifeos_cli.db.types import UTCDateTime


class FinanceTree(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """Reusable finance tree for balance, cashflow, or custom snapshots."""

    __tablename__ = "finance_trees"
    __table_args__ = (
        Index(
            "uq_finance_trees_purpose_name_active",
            "purpose",
            "name",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("ix_finance_trees_purpose_default", "purpose", "is_default"),
        Index("ix_finance_trees_display_order", "display_order"),
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False, default="custom")
    time_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="instant")
    primary_currency: Mapped[str] = mapped_column(String(16), nullable=False, default="USD")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

    nodes = relationship(
        "FinanceTreeNode",
        back_populates="tree",
        cascade="all, delete-orphan",
        order_by="FinanceTreeNode.path",
    )
    snapshots = relationship(
        "FinanceSnapshot",
        back_populates="tree",
        cascade="all, delete-orphan",
        order_by="FinanceSnapshot.snapshot_ts.desc()",
    )

    def __repr__(self) -> str:
        return f"FinanceTree(id={self.id!s}, purpose={self.purpose!r}, name={self.name!r})"


class FinanceTreeNode(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """Hierarchical finance node shared by balance and cashflow presets."""

    __tablename__ = "finance_tree_nodes"
    __table_args__ = (
        Index("ix_finance_tree_nodes_tree_path", "tree_id", "path", unique=True),
        Index("ix_finance_tree_nodes_parent", "parent_id"),
        Index("ix_finance_tree_nodes_tree_order", "tree_id", "display_order", "created_at"),
    )

    tree_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("finance_trees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    parent_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("finance_tree_nodes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    node_kind: Mapped[str] = mapped_column(String(20), nullable=False, default="regular")
    normal_side: Mapped[str | None] = mapped_column(String(20), nullable=True)
    currency_code: Mapped[str | None] = mapped_column(String(16), nullable=True)
    path: Mapped[str] = mapped_column(String(1200), nullable=False, default="")
    depth: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    children_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

    tree = relationship("FinanceTree", back_populates="nodes")
    parent = relationship(
        "FinanceTreeNode",
        remote_side="FinanceTreeNode.id",
        back_populates="children",
    )
    children = relationship(
        "FinanceTreeNode",
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="FinanceTreeNode.display_order",
    )
    snapshot_entries = relationship(
        "FinanceSnapshotEntry",
        back_populates="node",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"FinanceTreeNode(id={self.id!s}, tree_id={self.tree_id!s}, name={self.name!r})"


class FinanceSnapshot(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """Snapshot for one finance tree at an instant or over a period."""

    __tablename__ = "finance_snapshots"
    __table_args__ = (
        Index("ix_finance_snapshots_tree_ts", "tree_id", "snapshot_ts"),
        Index("ix_finance_snapshots_tree_period", "tree_id", "period_start", "period_end"),
    )

    tree_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("finance_trees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    snapshot_ts: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    period_start: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    primary_currency: Mapped[str] = mapped_column(String(16), nullable=False)
    total_positive: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False, default=0)
    total_negative: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False, default=0)
    net_amount: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False, default=0)
    exchange_rates: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    summary: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    tree = relationship("FinanceTree", back_populates="snapshots")
    entries = relationship(
        "FinanceSnapshotEntry",
        back_populates="snapshot",
        cascade="all, delete-orphan",
        order_by="FinanceSnapshotEntry.created_at",
    )

    def __repr__(self) -> str:
        return f"FinanceSnapshot(id={self.id!s}, tree_id={self.tree_id!s})"


class FinanceSnapshotEntry(UUIDPrimaryKeyMixin, TimestampedMixin, SoftDeleteMixin, Base):
    """One node amount captured inside a finance snapshot."""

    __tablename__ = "finance_snapshot_entries"
    __table_args__ = (
        Index(
            "uq_finance_snapshot_entries_snapshot_node_active",
            "snapshot_id",
            "node_id",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
            sqlite_where=text("deleted_at IS NULL"),
        ),
        Index("ix_finance_snapshot_entries_node", "node_id"),
    )

    snapshot_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("finance_snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    node_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("finance_tree_nodes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(16), nullable=False)
    amount_converted: Mapped[Decimal] = mapped_column(Numeric(20, 8), nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_auto_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    snapshot = relationship("FinanceSnapshot", back_populates="entries")
    node = relationship("FinanceTreeNode", back_populates="snapshot_entries")

    def __repr__(self) -> str:
        return f"FinanceSnapshotEntry(id={self.id!s}, node_id={self.node_id!s})"


__all__ = [
    "FinanceSnapshot",
    "FinanceSnapshotEntry",
    "FinanceTree",
    "FinanceTreeNode",
]
