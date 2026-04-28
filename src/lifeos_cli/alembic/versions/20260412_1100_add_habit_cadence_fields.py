"""Add cadence fields to habits."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260412_1100"
down_revision = "20260412_0900"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def upgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("habits", schema=schema_name) as batch_op:
        batch_op.add_column(
            sa.Column(
                "cadence_frequency",
                sa.String(length=16),
                nullable=False,
                server_default="daily",
            )
        )
        batch_op.add_column(sa.Column("cadence_weekdays", sa.JSON(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "target_per_cycle",
                sa.Integer(),
                nullable=False,
                server_default="1",
            )
        )
        batch_op.create_index(
            op.f("ix_habits_cadence_frequency"),
            ["cadence_frequency"],
            unique=False,
        )
        batch_op.alter_column("cadence_frequency", server_default=None)
        batch_op.alter_column("target_per_cycle", server_default=None)


def downgrade() -> None:
    schema_name = _schema_name()
    with op.batch_alter_table("habits", schema=schema_name) as batch_op:
        batch_op.drop_index(op.f("ix_habits_cadence_frequency"))
        batch_op.drop_column("target_per_cycle")
        batch_op.drop_column("cadence_weekdays")
        batch_op.drop_column("cadence_frequency")
