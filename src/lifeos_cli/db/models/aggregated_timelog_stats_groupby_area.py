"""Aggregated persisted timelog stats grouped by area."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifeos_cli.db.base import Base, TimestampedMixin, UUIDPrimaryKeyMixin


class AggregatedTimelogStatsGroupByArea(UUIDPrimaryKeyMixin, TimestampedMixin, Base):
    """Persisted aggregated timelog stats for one period and area."""

    __tablename__ = "aggregated_timelog_stats_groupby_area"
    __table_args__ = (
        UniqueConstraint(
            "granularity",
            "period_start",
            "period_end",
            "timezone",
            "area_id",
            name="uq_aggregated_timelog_stats_groupby_area_scope",
        ),
        Index("ix_aggregated_timelog_stats_groupby_area_granularity", "granularity"),
        Index("ix_aggregated_timelog_stats_groupby_area_period_start", "period_start"),
        Index("ix_aggregated_timelog_stats_groupby_area_timezone", "timezone"),
        Index("ix_aggregated_timelog_stats_groupby_area_area_id", "area_id"),
    )

    granularity: Mapped[str] = mapped_column(String(16), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(String(100), nullable=False)
    area_id: Mapped[UUID] = mapped_column(
        ForeignKey("areas.id", ondelete="CASCADE"),
        nullable=False,
    )
    minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    timelog_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    area = relationship("Area", foreign_keys=[area_id])
