"""Declassify finance tree indexes.

Revision ID: 20260626_1100
Revises: 20260625_1000
Create Date: 2026-06-26 11:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text


revision: str = "20260626_1100"
down_revision: str | Sequence[str] | None = "20260625_1000"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index("ix_finance_trees_purpose_default", table_name="finance_trees")
    op.drop_index("uq_finance_trees_purpose_name_active", table_name="finance_trees")
    op.create_index(
        "uq_finance_trees_name_active",
        "finance_trees",
        ["name"],
        unique=True,
        postgresql_where=text("deleted_at IS NULL"),
        sqlite_where=text("deleted_at IS NULL"),
    )
    op.create_index("ix_finance_trees_default", "finance_trees", ["is_default"])


def downgrade() -> None:
    op.drop_index("ix_finance_trees_default", table_name="finance_trees")
    op.drop_index("uq_finance_trees_name_active", table_name="finance_trees")
    op.create_index(
        "uq_finance_trees_purpose_name_active",
        "finance_trees",
        ["purpose", "name"],
        unique=True,
        postgresql_where=text("deleted_at IS NULL"),
        sqlite_where=text("deleted_at IS NULL"),
    )
    op.create_index(
        "ix_finance_trees_purpose_default",
        "finance_trees",
        ["purpose", "is_default"],
    )
