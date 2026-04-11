"""Add first-class event type support."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260411_1400"
down_revision = "20260411_0900"
branch_labels = None
depends_on = None


def _schema_name() -> str:
    context = op.get_context()
    return context.version_table_schema or "lifeos"


def upgrade() -> None:
    schema_name = _schema_name()

    op.add_column(
        "events",
        sa.Column(
            "event_type",
            sa.String(length=20),
            nullable=False,
            server_default="appointment",
        ),
        schema=schema_name,
    )
    op.create_index(
        "ix_events_event_type",
        "events",
        ["event_type"],
        unique=False,
        schema=schema_name,
    )
    op.create_check_constraint(
        "ck_events_event_type_valid",
        "events",
        "event_type IN ('appointment', 'timeblock', 'deadline')",
        schema=schema_name,
    )
    op.alter_column(
        "events",
        "event_type",
        server_default=None,
        schema=schema_name,
    )


def downgrade() -> None:
    schema_name = _schema_name()

    op.drop_constraint(
        "ck_events_event_type_valid",
        "events",
        schema=schema_name,
        type_="check",
    )
    op.drop_index("ix_events_event_type", table_name="events", schema=schema_name)
    op.drop_column("events", "event_type", schema=schema_name)
