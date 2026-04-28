"""Add recurring event support and occurrence exceptions."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260410_1200"
down_revision = "20260410_0900"
branch_labels = None
depends_on = None


def _schema_name() -> str | None:
    context = op.get_context()
    return context.version_table_schema


def _qualified_column(schema_name: str | None, table_name: str, column_name: str) -> str:
    if schema_name is None:
        return f"{table_name}.{column_name}"
    return f"{schema_name}.{table_name}.{column_name}"


def upgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("events", schema=schema_name) as batch_op:
        batch_op.add_column(sa.Column("recurrence_frequency", sa.String(length=16), nullable=True))
        batch_op.add_column(sa.Column("recurrence_interval", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("recurrence_count", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column("recurrence_until", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.add_column(sa.Column("recurrence_parent_event_id", sa.Uuid(), nullable=True))
        batch_op.add_column(
            sa.Column("recurrence_instance_start", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.create_index(
            op.f("ix_events_recurrence_frequency"),
            ["recurrence_frequency"],
            unique=False,
        )
        batch_op.create_index(
            op.f("ix_events_recurrence_until"),
            ["recurrence_until"],
            unique=False,
        )
        batch_op.create_index(
            "ix_events_recurrence_parent_event_id",
            ["recurrence_parent_event_id"],
            unique=False,
        )
        batch_op.create_index(
            "ix_events_recurrence_instance_start",
            ["recurrence_instance_start"],
            unique=False,
        )
        batch_op.create_foreign_key(
            op.f("fk_events_recurrence_parent_event_id_events"),
            "events",
            ["recurrence_parent_event_id"],
            ["id"],
            referent_schema=schema_name,
            ondelete="CASCADE",
        )

    op.create_table(
        "event_occurrence_exceptions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("master_event_id", sa.Uuid(), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("instance_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["master_event_id"],
            [_qualified_column(schema_name, "events", "id")],
            name=op.f("fk_event_occurrence_exceptions_master_event_id_events"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_event_occurrence_exceptions")),
        schema=schema_name,
    )
    op.create_index(
        "ix_event_occurrence_exceptions_master_event_id",
        "event_occurrence_exceptions",
        ["master_event_id"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_event_occurrence_exceptions_instance_start",
        "event_occurrence_exceptions",
        ["instance_start"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "uq_evt_occur_exc_master_id_start_active",
        "event_occurrence_exceptions",
        ["master_event_id", "instance_start"],
        unique=True,
        schema=schema_name,
        postgresql_where=sa.text("deleted_at IS NULL"),
        sqlite_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    schema_name = _schema_name()

    with op.batch_alter_table("events", schema=schema_name) as batch_op:
        batch_op.drop_constraint(
            op.f("fk_events_recurrence_parent_event_id_events"),
            type_="foreignkey",
        )
        batch_op.drop_index("ix_events_recurrence_instance_start")
        batch_op.drop_index("ix_events_recurrence_parent_event_id")
        batch_op.drop_index(op.f("ix_events_recurrence_until"))
        batch_op.drop_index(op.f("ix_events_recurrence_frequency"))
        batch_op.drop_column("recurrence_instance_start")
        batch_op.drop_column("recurrence_parent_event_id")
        batch_op.drop_column("recurrence_until")
        batch_op.drop_column("recurrence_count")
        batch_op.drop_column("recurrence_interval")
        batch_op.drop_column("recurrence_frequency")

    op.drop_index(
        "uq_evt_occur_exc_master_id_start_active",
        table_name="event_occurrence_exceptions",
        schema=schema_name,
    )
    op.drop_index(
        "ix_event_occurrence_exceptions_instance_start",
        table_name="event_occurrence_exceptions",
        schema=schema_name,
    )
    op.drop_index(
        "ix_event_occurrence_exceptions_master_event_id",
        table_name="event_occurrence_exceptions",
        schema=schema_name,
    )
    op.drop_table("event_occurrence_exceptions", schema=schema_name)
