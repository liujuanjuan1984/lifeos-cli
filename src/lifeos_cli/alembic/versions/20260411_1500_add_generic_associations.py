"""Add generic weak association support."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260411_1500"
down_revision = "20260411_1400"
branch_labels = None
depends_on = None


def _schema_name() -> str:
    context = op.get_context()
    return context.version_table_schema or "lifeos"


def upgrade() -> None:
    schema_name = _schema_name()

    op.create_table(
        "associations",
        sa.Column("source_model", sa.String(length=50), nullable=False),
        sa.Column("source_id", sa.Uuid(), nullable=False),
        sa.Column("target_model", sa.String(length=50), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=False),
        sa.Column("link_type", sa.String(length=50), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "source_model IN ('note', 'person', 'task', 'timelog')",
            name="ck_associations_source_model_valid",
        ),
        sa.CheckConstraint(
            "target_model IN ('note', 'person', 'task', 'timelog')",
            name="ck_associations_target_model_valid",
        ),
        sa.CheckConstraint(
            "link_type IN ('captured_from', 'is_about', 'relates_to')",
            name="ck_associations_link_type_valid",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source_model",
            "source_id",
            "target_model",
            "target_id",
            "link_type",
            name="uq_associations_source_target_type",
        ),
        schema=schema_name,
    )
    op.create_index(
        "ix_associations_link_type",
        "associations",
        ["link_type"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_associations_source_id",
        "associations",
        ["source_id"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_associations_source_model",
        "associations",
        ["source_model"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_associations_source_model_id_type",
        "associations",
        ["source_model", "source_id", "link_type"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_associations_target_id",
        "associations",
        ["target_id"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_associations_target_model",
        "associations",
        ["target_model"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_associations_target_model_id_type",
        "associations",
        ["target_model", "target_id", "link_type"],
        unique=False,
        schema=schema_name,
    )


def downgrade() -> None:
    schema_name = _schema_name()

    op.drop_index(
        "ix_associations_target_model_id_type",
        table_name="associations",
        schema=schema_name,
    )
    op.drop_index("ix_associations_target_model", table_name="associations", schema=schema_name)
    op.drop_index("ix_associations_target_id", table_name="associations", schema=schema_name)
    op.drop_index(
        "ix_associations_source_model_id_type",
        table_name="associations",
        schema=schema_name,
    )
    op.drop_index("ix_associations_source_model", table_name="associations", schema=schema_name)
    op.drop_index("ix_associations_source_id", table_name="associations", schema=schema_name)
    op.drop_index("ix_associations_link_type", table_name="associations", schema=schema_name)
    op.drop_table("associations", schema=schema_name)
