"""Add optional finance snapshot title."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260625_0900"
down_revision = "20260617_1400"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def upgrade() -> None:
    schema_name = _schema_name()
    with op.batch_alter_table("finance_snapshots", schema=schema_name) as batch_op:
        batch_op.add_column(sa.Column("title", sa.String(length=200), nullable=True))


def downgrade() -> None:
    schema_name = _schema_name()
    with op.batch_alter_table("finance_snapshots", schema=schema_name) as batch_op:
        batch_op.drop_column("title")
