"""Add persisted timelog stats grouped by area tables."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260411_0900"
down_revision = "20260410_1200"
branch_labels = None
depends_on = None


def _schema_name() -> str:
    context = op.get_context()
    return context.version_table_schema or "lifeos"


def upgrade() -> None:
    schema_name = _schema_name()

    op.create_table(
        "daily_timelog_stats_groupby_area",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("stat_date", sa.Date(), nullable=False),
        sa.Column("timezone", sa.String(length=100), nullable=False),
        sa.Column("area_id", sa.Uuid(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("timelog_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["area_id"],
            [f"{schema_name}.areas.id"],
            name=op.f("fk_daily_timelog_stats_groupby_area_area_id_areas"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_daily_timelog_stats_groupby_area")),
        sa.UniqueConstraint(
            "stat_date",
            "timezone",
            "area_id",
            name="uq_daily_timelog_stats_groupby_area_scope",
        ),
        schema=schema_name,
    )
    op.create_index(
        "ix_daily_timelog_stats_groupby_area_stat_date",
        "daily_timelog_stats_groupby_area",
        ["stat_date"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_daily_timelog_stats_groupby_area_timezone",
        "daily_timelog_stats_groupby_area",
        ["timezone"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_daily_timelog_stats_groupby_area_area_id",
        "daily_timelog_stats_groupby_area",
        ["area_id"],
        unique=False,
        schema=schema_name,
    )

    op.create_table(
        "aggregated_timelog_stats_groupby_area",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("granularity", sa.String(length=16), nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("timezone", sa.String(length=100), nullable=False),
        sa.Column("area_id", sa.Uuid(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("timelog_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["area_id"],
            [f"{schema_name}.areas.id"],
            name=op.f("fk_aggregated_timelog_stats_groupby_area_area_id_areas"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_aggregated_timelog_stats_groupby_area")),
        sa.UniqueConstraint(
            "granularity",
            "period_start",
            "period_end",
            "timezone",
            "area_id",
            name="uq_aggregated_timelog_stats_groupby_area_scope",
        ),
        schema=schema_name,
    )
    op.create_index(
        "ix_aggregated_timelog_stats_groupby_area_granularity",
        "aggregated_timelog_stats_groupby_area",
        ["granularity"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_aggregated_timelog_stats_groupby_area_period_start",
        "aggregated_timelog_stats_groupby_area",
        ["period_start"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_aggregated_timelog_stats_groupby_area_timezone",
        "aggregated_timelog_stats_groupby_area",
        ["timezone"],
        unique=False,
        schema=schema_name,
    )
    op.create_index(
        "ix_aggregated_timelog_stats_groupby_area_area_id",
        "aggregated_timelog_stats_groupby_area",
        ["area_id"],
        unique=False,
        schema=schema_name,
    )


def downgrade() -> None:
    schema_name = _schema_name()

    op.drop_index(
        "ix_aggregated_timelog_stats_groupby_area_area_id",
        table_name="aggregated_timelog_stats_groupby_area",
        schema=schema_name,
    )
    op.drop_index(
        "ix_aggregated_timelog_stats_groupby_area_timezone",
        table_name="aggregated_timelog_stats_groupby_area",
        schema=schema_name,
    )
    op.drop_index(
        "ix_aggregated_timelog_stats_groupby_area_period_start",
        table_name="aggregated_timelog_stats_groupby_area",
        schema=schema_name,
    )
    op.drop_index(
        "ix_aggregated_timelog_stats_groupby_area_granularity",
        table_name="aggregated_timelog_stats_groupby_area",
        schema=schema_name,
    )
    op.drop_table("aggregated_timelog_stats_groupby_area", schema=schema_name)

    op.drop_index(
        "ix_daily_timelog_stats_groupby_area_area_id",
        table_name="daily_timelog_stats_groupby_area",
        schema=schema_name,
    )
    op.drop_index(
        "ix_daily_timelog_stats_groupby_area_timezone",
        table_name="daily_timelog_stats_groupby_area",
        schema=schema_name,
    )
    op.drop_index(
        "ix_daily_timelog_stats_groupby_area_stat_date",
        table_name="daily_timelog_stats_groupby_area",
        schema=schema_name,
    )
    op.drop_table("daily_timelog_stats_groupby_area", schema=schema_name)
