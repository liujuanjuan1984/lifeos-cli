"""Add structured event recurrence rule details."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260617_1300"
down_revision = "20260617_1200"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def upgrade() -> None:
    schema_name = _schema_name()
    with op.batch_alter_table("events", schema=schema_name) as batch_op:
        batch_op.add_column(sa.Column("recurrence_rule", sa.JSON(), nullable=True))


def downgrade() -> None:
    schema_name = _schema_name()
    with op.batch_alter_table("events", schema=schema_name) as batch_op:
        batch_op.drop_column("recurrence_rule")
