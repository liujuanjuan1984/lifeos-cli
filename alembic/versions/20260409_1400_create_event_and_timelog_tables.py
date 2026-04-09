"""Create event, timelog, and person association tables."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260409_1400"
down_revision = "20260409_1300"
branch_labels = None
depends_on = None


def _schema_name() -> str:
    context = op.get_context()
    return context.version_table_schema or "lifeos"


def upgrade() -> None:
    schema_name = _schema_name()

    op.create_table(
        "person_associations",
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("person_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["person_id"],
            [f"{schema_name}.people.id"],
            name=op.f("fk_person_associations_person_id_people"),
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "entity_type",
            "entity_id",
            "person_id",
            name="uq_person_associations_entity_person",
        ),
        schema=schema_name,
    )
    op.create_index(
        "ix_person_associations_entity",
        "person_associations",
        ["entity_type", "entity_id"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_person_associations_person_id",
        "person_associations",
        ["person_id"],
        unique=False,
        schema=schema_name,
    )

    op.create_table(
        "events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("is_all_day", sa.Boolean(), nullable=False),
        sa.Column("area_id", sa.Uuid(), nullable=True),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["area_id"],
            [f"{schema_name}.areas.id"],
            name=op.f("fk_events_area_id_areas"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            [f"{schema_name}.tasks.id"],
            name=op.f("fk_events_task_id_tasks"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_events")),
        schema=schema_name,
    )
    op.create_index(op.f("ix_events_title"), "events", ["title"], unique=False, schema=schema_name)
    op.create_index(
        op.f("ix_events_start_time"),
        "events",
        ["start_time"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_events_end_time"),
        "events",
        ["end_time"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_events_status_start_time",
        "events",
        ["status", "start_time"],
        unique=False,
        schema=schema_name,
    )
    op.create_index("ix_events_area_id", "events", ["area_id"], unique=False, schema=schema_name)
    op.create_index("ix_events_task_id", "events", ["task_id"], unique=False, schema=schema_name)
    op.create_index(op.f("ix_events_status"), "events", ["status"], unique=False, schema=schema_name)
    op.create_index(
        op.f("ix_events_priority"),
        "events",
        ["priority"],
        unique=False,
        schema=schema_name,
    )

    op.create_table(
        "timelogs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tracking_method", sa.String(length=20), nullable=False),
        sa.Column("location", sa.String(length=200), nullable=True),
        sa.Column("energy_level", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("area_id", sa.Uuid(), nullable=True),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["area_id"],
            [f"{schema_name}.areas.id"],
            name=op.f("fk_timelogs_area_id_areas"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["task_id"],
            [f"{schema_name}.tasks.id"],
            name=op.f("fk_timelogs_task_id_tasks"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_timelogs")),
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_timelogs_title"),
        "timelogs",
        ["title"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_timelogs_start_time"),
        "timelogs",
        ["start_time"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_timelogs_end_time"),
        "timelogs",
        ["end_time"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_timelogs_tracking_method",
        "timelogs",
        ["tracking_method"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_timelogs_area_id",
        "timelogs",
        ["area_id"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_timelogs_task_id",
        "timelogs",
        ["task_id"],
        unique=False,
        schema=schema_name,
    )


def downgrade() -> None:
    schema_name = _schema_name()

    op.drop_index("ix_timelogs_task_id", table_name="timelogs", schema=schema_name)
    op.drop_index("ix_timelogs_area_id", table_name="timelogs", schema=schema_name)
    op.drop_index(
        "ix_timelogs_tracking_method",
        table_name="timelogs",
        schema=schema_name,
    )
    op.drop_index(op.f("ix_timelogs_end_time"), table_name="timelogs", schema=schema_name)
    op.drop_index(op.f("ix_timelogs_start_time"), table_name="timelogs", schema=schema_name)
    op.drop_index(op.f("ix_timelogs_title"), table_name="timelogs", schema=schema_name)
    op.drop_table("timelogs", schema=schema_name)

    op.drop_index(op.f("ix_events_priority"), table_name="events", schema=schema_name)
    op.drop_index(op.f("ix_events_status"), table_name="events", schema=schema_name)
    op.drop_index("ix_events_task_id", table_name="events", schema=schema_name)
    op.drop_index("ix_events_area_id", table_name="events", schema=schema_name)
    op.drop_index("ix_events_status_start_time", table_name="events", schema=schema_name)
    op.drop_index(op.f("ix_events_end_time"), table_name="events", schema=schema_name)
    op.drop_index(op.f("ix_events_start_time"), table_name="events", schema=schema_name)
    op.drop_index(op.f("ix_events_title"), table_name="events", schema=schema_name)
    op.drop_table("events", schema=schema_name)

    op.drop_index(
        "ix_person_associations_person_id",
        table_name="person_associations",
        schema=schema_name,
    )
    op.drop_index(
        "ix_person_associations_entity",
        table_name="person_associations",
        schema=schema_name,
    )
    op.drop_table("person_associations", schema=schema_name)
