"""Add cadence fields to habits."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260412_1100"
down_revision = "20260412_0900"
branch_labels = None
depends_on = None


def _schema_name() -> str:
    context = op.get_context()
    return context.version_table_schema or "lifeos"


def upgrade() -> None:
    schema_name = _schema_name()

    op.add_column(
        "habits",
        sa.Column(
            "cadence_frequency",
            sa.String(length=16),
            nullable=False,
            server_default="daily",
        ),
        schema=schema_name,
    )
    op.add_column(
        "habits",
        sa.Column("cadence_weekdays", sa.JSON(), nullable=True),
        schema=schema_name,
    )
    op.add_column(
        "habits",
        sa.Column(
            "target_per_cycle",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_habits_cadence_frequency"),
        "habits",
        ["cadence_frequency"],
        unique=False,
        schema=schema_name,
    )
    op.alter_column("habits", "cadence_frequency", server_default=None, schema=schema_name)
    op.alter_column("habits", "target_per_cycle", server_default=None, schema=schema_name)


def downgrade() -> None:
    schema_name = _schema_name()
    op.drop_index(op.f("ix_habits_cadence_frequency"), table_name="habits", schema=schema_name)
    op.drop_column("habits", "target_per_cycle", schema=schema_name)
    op.drop_column("habits", "cadence_weekdays", schema=schema_name)
    op.drop_column("habits", "cadence_frequency", schema=schema_name)
