"""Create area, tag, people, vision, task, and tag association tables."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260409_1200"
down_revision = "20260409_0600"
branch_labels = None
depends_on = None


def _schema_name() -> str:
    context = op.get_context()
    return context.version_table_schema or "lifeos"


def upgrade() -> None:
    schema_name = _schema_name()

    op.create_table(
        "areas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=7), nullable=False),
        sa.Column("icon", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_areas")),
        sa.UniqueConstraint("name", name=op.f("uq_areas_name")),
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_areas_display_order"),
        "areas",
        ["display_order"],
        unique=False,
        schema=schema_name,
    )

    op.create_table(
        "tags",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(length=7), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tags")),
        sa.UniqueConstraint("name", "entity_type", "category", name=op.f("uq_tags_name_type_category")),
        schema=schema_name,
    )
    op.create_index(
        "ix_tags_name_entity_type_category",
        "tags",
        ["name", "entity_type", "category"],
        unique=False,
        schema=schema_name,
    )

    op.create_table(
        "people",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("nicknames", sa.JSON(), nullable=True),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.Column("location", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_people")),
        schema=schema_name,
    )
    op.create_index(op.f("ix_people_name"), "people", ["name"], unique=False, schema=schema_name)
    op.create_index(
        op.f("ix_people_location"),
        "people",
        ["location"],
        unique=False,
        schema=schema_name,
    )

    op.create_table(
        "visions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("stage", sa.Integer(), nullable=False),
        sa.Column("experience_points", sa.Integer(), nullable=False),
        sa.Column("experience_rate_per_hour", sa.Integer(), nullable=True),
        sa.Column("area_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["area_id"],
            [f"{schema_name}.areas.id"],
            name=op.f("fk_visions_area_id_areas"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_visions")),
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_visions_name"),
        "visions",
        ["name"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_visions_status"),
        "visions",
        ["status"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_visions_area_id"),
        "visions",
        ["area_id"],
        unique=False,
        schema=schema_name,
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("vision_id", sa.Uuid(), nullable=False),
        sa.Column("parent_task_id", sa.Uuid(), nullable=True),
        sa.Column("content", sa.String(length=500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("estimated_effort", sa.Integer(), nullable=True),
        sa.Column("planning_cycle_type", sa.String(length=10), nullable=True),
        sa.Column("planning_cycle_days", sa.Integer(), nullable=True),
        sa.Column("planning_cycle_start_date", sa.Date(), nullable=True),
        sa.Column("actual_effort_self", sa.Integer(), nullable=False),
        sa.Column("actual_effort_total", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_task_id"],
            [f"{schema_name}.tasks.id"],
            name=op.f("fk_tasks_parent_task_id_tasks"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["vision_id"],
            [f"{schema_name}.visions.id"],
            name=op.f("fk_tasks_vision_id_visions"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
        schema=schema_name,
    )
    op.create_index(op.f("ix_tasks_vision_id"), "tasks", ["vision_id"], unique=False, schema=schema_name)
    op.create_index(
        op.f("ix_tasks_parent_task_id"),
        "tasks",
        ["parent_task_id"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(op.f("ix_tasks_content"), "tasks", ["content"], unique=False, schema=schema_name)
    op.create_index(op.f("ix_tasks_status"), "tasks", ["status"], unique=False, schema=schema_name)
    op.create_index(op.f("ix_tasks_priority"), "tasks", ["priority"], unique=False, schema=schema_name)
    op.create_index(
        op.f("ix_tasks_planning_cycle_type"),
        "tasks",
        ["planning_cycle_type"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        op.f("ix_tasks_planning_cycle_start_date"),
        "tasks",
        ["planning_cycle_start_date"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_tasks_vision_display_order_created",
        "tasks",
        ["vision_id", "display_order", "created_at"],
        unique=False,
        schema=schema_name,
    )

    op.create_table(
        "tag_associations",
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("tag_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            [f"{schema_name}.tags.id"],
            name=op.f("fk_tag_associations_tag_id_tags"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("entity_id", "entity_type", "tag_id", name=op.f("pk_tag_associations")),
        schema=schema_name,
    )
    op.create_index(
        "ix_tag_associations_entity",
        "tag_associations",
        ["entity_type", "entity_id"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_tag_associations_tag_id",
        "tag_associations",
        ["tag_id"],
        unique=False,
        schema=schema_name,
    )


def downgrade() -> None:
    schema_name = _schema_name()
    op.drop_index("ix_tag_associations_tag_id", table_name="tag_associations", schema=schema_name)
    op.drop_index("ix_tag_associations_entity", table_name="tag_associations", schema=schema_name)
    op.drop_table("tag_associations", schema=schema_name)

    op.drop_index("ix_tasks_vision_display_order_created", table_name="tasks", schema=schema_name)
    op.drop_index(op.f("ix_tasks_planning_cycle_start_date"), table_name="tasks", schema=schema_name)
    op.drop_index(op.f("ix_tasks_planning_cycle_type"), table_name="tasks", schema=schema_name)
    op.drop_index(op.f("ix_tasks_priority"), table_name="tasks", schema=schema_name)
    op.drop_index(op.f("ix_tasks_status"), table_name="tasks", schema=schema_name)
    op.drop_index(op.f("ix_tasks_content"), table_name="tasks", schema=schema_name)
    op.drop_index(op.f("ix_tasks_parent_task_id"), table_name="tasks", schema=schema_name)
    op.drop_index(op.f("ix_tasks_vision_id"), table_name="tasks", schema=schema_name)
    op.drop_table("tasks", schema=schema_name)

    op.drop_index(op.f("ix_visions_area_id"), table_name="visions", schema=schema_name)
    op.drop_index(op.f("ix_visions_status"), table_name="visions", schema=schema_name)
    op.drop_index(op.f("ix_visions_name"), table_name="visions", schema=schema_name)
    op.drop_table("visions", schema=schema_name)

    op.drop_index(op.f("ix_people_location"), table_name="people", schema=schema_name)
    op.drop_index(op.f("ix_people_name"), table_name="people", schema=schema_name)
    op.drop_table("people", schema=schema_name)

    op.drop_index("ix_tags_name_entity_type_category", table_name="tags", schema=schema_name)
    op.drop_table("tags", schema=schema_name)

    op.drop_index(op.f("ix_areas_display_order"), table_name="areas", schema=schema_name)
    op.drop_table("areas", schema=schema_name)
