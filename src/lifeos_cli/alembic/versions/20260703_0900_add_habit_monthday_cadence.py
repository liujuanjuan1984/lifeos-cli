"""Add monthday cadence selectors to habits."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260703_0900"
down_revision = "20260629_1000"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def upgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("habits", schema=schema_name) as batch_op:
        batch_op.add_column(sa.Column("cadence_monthdays", sa.JSON(), nullable=True))


def downgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("habits", schema=schema_name) as batch_op:
        batch_op.drop_column("cadence_monthdays")
