"""Daily persisted timelog stats grouped by area."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import Date, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifeos_cli.db.base import Base, TimestampedMixin, UUIDPrimaryKeyMixin


class DailyTimelogStatsGroupByArea(UUIDPrimaryKeyMixin, TimestampedMixin, Base):
    """Persisted daily timelog stats for one local date and area."""

    __tablename__ = "daily_timelog_stats_groupby_area"
    __table_args__ = (
        UniqueConstraint(
            "stat_date",
            "timezone",
            "area_id",
            name="uq_daily_timelog_stats_groupby_area_scope",
        ),
        Index("ix_daily_timelog_stats_groupby_area_stat_date", "stat_date"),
        Index("ix_daily_timelog_stats_groupby_area_timezone", "timezone"),
        Index("ix_daily_timelog_stats_groupby_area_area_id", "area_id"),
    )

    stat_date: Mapped[date] = mapped_column(Date, nullable=False)
    timezone: Mapped[str] = mapped_column(String(100), nullable=False)
    area_id: Mapped[UUID] = mapped_column(
        ForeignKey("areas.id", ondelete="CASCADE"),
        nullable=False,
    )
    minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    timelog_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    area = relationship("Area", foreign_keys=[area_id])
