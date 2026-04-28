"""Add first-class event type support."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260411_1400"
down_revision = "20260411_0900"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def upgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("events", schema=schema_name) as batch_op:
        batch_op.add_column(
            sa.Column(
                "event_type",
                sa.String(length=20),
                nullable=False,
                server_default="appointment",
            )
        )
        batch_op.create_index(
            "ix_events_event_type",
            ["event_type"],
            unique=False,
        )
        batch_op.create_check_constraint(
            "ck_events_event_type_valid",
            "event_type IN ('appointment', 'timeblock', 'deadline')",
        )
        batch_op.alter_column(
            "event_type",
            server_default=None,
        )


def downgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("events", schema=schema_name) as batch_op:
        batch_op.drop_constraint(
            "ck_events_event_type_valid",
            type_="check",
        )
        batch_op.drop_index("ix_events_event_type")
        batch_op.drop_column("event_type")
