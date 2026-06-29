"""Drop stale legacy finance tree columns.

Revision ID: 20260629_1000
Revises: 20260629_0900
Create Date: 2026-06-29 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260629_1000"
down_revision: str | Sequence[str] | None = "20260629_0900"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def _finance_tree_columns() -> set[str]:
    bind = op.get_bind()
    return {
        column["name"]
        for column in sa.inspect(bind).get_columns("finance_trees", schema=_schema_name())
    }


def upgrade() -> None:
    stale_columns = _finance_tree_columns().intersection({"purpose", "time_mode"})
    if not stale_columns:
        return

    with op.batch_alter_table("finance_trees", schema=_schema_name()) as batch_op:
        for column_name in ("purpose", "time_mode"):
            if column_name in stale_columns:
                batch_op.drop_column(column_name)


def downgrade() -> None:
    existing_columns = _finance_tree_columns()
    with op.batch_alter_table("finance_trees", schema=_schema_name()) as batch_op:
        if "purpose" not in existing_columns:
            batch_op.add_column(
                sa.Column("purpose", sa.String(length=20), nullable=False, server_default="custom")
            )
        if "time_mode" not in existing_columns:
            batch_op.add_column(
                sa.Column(
                    "time_mode",
                    sa.String(length=20),
                    nullable=False,
                    server_default="instant",
                )
            )
    with op.batch_alter_table("finance_trees", schema=_schema_name()) as batch_op:
        if "purpose" not in existing_columns:
            batch_op.alter_column("purpose", server_default=None)
        if "time_mode" not in existing_columns:
            batch_op.alter_column("time_mode", server_default=None)
