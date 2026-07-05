"""Add habit status change date."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260704_1100"
down_revision = "20260703_0900"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def upgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("habits", schema=schema_name) as batch_op:
        batch_op.add_column(sa.Column("status_changed_date", sa.Date(), nullable=True))

    habits_table = sa.table(
        "habits",
        sa.column("status", sa.String()),
        sa.column("start_date", sa.Date()),
        sa.column("updated_at", sa.DateTime(timezone=True)),
        sa.column("status_changed_date", sa.Date()),
        schema=schema_name,
    )
    op.execute(
        habits_table.update()
        .where(habits_table.c.status == "active")
        .values(status_changed_date=habits_table.c.start_date)
    )
    op.execute(
        habits_table.update()
        .where(habits_table.c.status != "active")
        .values(status_changed_date=sa.func.date(habits_table.c.updated_at))
    )


def downgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("habits", schema=schema_name) as batch_op:
        batch_op.drop_column("status_changed_date")
