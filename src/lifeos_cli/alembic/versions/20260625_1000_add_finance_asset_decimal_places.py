"""Add finance asset decimal-place precision."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260625_1000"
down_revision = "20260625_0900"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def upgrade() -> None:
    schema_name = _schema_name()
    with op.batch_alter_table("finance_assets", schema=schema_name) as batch_op:
        batch_op.add_column(
            sa.Column(
                "decimal_places",
                sa.Integer(),
                nullable=False,
                server_default="2",
            )
        )
    with op.batch_alter_table("finance_assets", schema=schema_name) as batch_op:
        batch_op.alter_column("decimal_places", server_default=None)


def downgrade() -> None:
    schema_name = _schema_name()
    with op.batch_alter_table("finance_assets", schema=schema_name) as batch_op:
        batch_op.drop_column("decimal_places")
