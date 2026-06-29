"""Allow multi-asset finance snapshot entries per node.

Revision ID: 20260629_0900
Revises: 20260626_1100
Create Date: 2026-06-29 09:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260629_0900"
down_revision: str | Sequence[str] | None = "20260626_1100"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def upgrade() -> None:
    schema_name = _schema_name()
    op.drop_index(
        "uq_finance_snapshot_entries_snapshot_node_active",
        table_name="finance_snapshot_entries",
        schema=schema_name,
    )
    op.create_index(
        "uq_finance_snapshot_entries_snapshot_node_currency_auto_active",
        "finance_snapshot_entries",
        ["snapshot_id", "node_id", "currency_code", "is_auto_generated"],
        unique=True,
        schema=schema_name,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    schema_name = _schema_name()
    op.drop_index(
        "uq_finance_snapshot_entries_snapshot_node_currency_auto_active",
        table_name="finance_snapshot_entries",
        schema=schema_name,
    )
    op.create_index(
        "uq_finance_snapshot_entries_snapshot_node_active",
        "finance_snapshot_entries",
        ["snapshot_id", "node_id"],
        unique=True,
        schema=schema_name,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )
