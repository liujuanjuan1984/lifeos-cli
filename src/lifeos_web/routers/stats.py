"""Frontend-compatible stats endpoints backed by LifeOS timelog area stats."""

from __future__ import annotations

import math
from datetime import date, timedelta
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.services import timelog_stats
from lifeos_web.deps import get_db_session
from lifeos_web.schemas import ListResponse, Pagination

router = APIRouter(prefix="/stats", tags=["stats"])
SessionDep = Annotated[AsyncSession, Depends(get_db_session)]
Granularity = Literal["day", "week", "month", "year"]


def _filter_area(row_area_id: UUID, area_ids: set[UUID] | None) -> bool:
    return area_ids is None or row_area_id in area_ids


def _pagination(*, page: int, size: int, total: int) -> Pagination:
    pages = math.ceil(total / size) if size else 0
    return Pagination(page=page, size=size, total=total, pages=pages)


def _page_items(items: list[dict[str, object]], *, page: int, size: int) -> list[dict[str, object]]:
    start = (page - 1) * size
    return items[start : start + size]


def _parse_area_ids(values: list[UUID] | None) -> set[UUID] | None:
    if not values:
        return None
    return set(values)


def _next_period_start(granularity: Granularity, current: date) -> date:
    if granularity in {"day", "week"}:
        return current + timedelta(days=1 if granularity == "day" else 7)
    if granularity == "month":
        if current.month == 12:
            return date(current.year + 1, 1, 1)
        return date(current.year, current.month + 1, 1)
    return date(current.year + 1, 1, 1)


async def _aggregated_report(
    session: AsyncSession,
    *,
    granularity: Granularity,
    cursor: date,
) -> timelog_stats.TimelogStatsReport:
    if granularity == "day":
        return await timelog_stats.get_timelog_stats_groupby_area_for_day(
            session,
            target_date=cursor,
        )
    if granularity == "week":
        return await timelog_stats.get_timelog_stats_groupby_area_for_period(
            session,
            granularity="week",
            target_date=cursor,
        )
    if granularity == "month":
        return await timelog_stats.get_timelog_stats_groupby_area_for_period(
            session,
            granularity="month",
            month=cursor,
        )
    return await timelog_stats.get_timelog_stats_groupby_area_for_period(
        session,
        granularity="year",
        year=cursor.year,
    )


@router.get("/daily-areas", response_model=ListResponse)
async def list_daily_areas(
    session: SessionDep,
    start: date,
    end: date,
    area_ids: Annotated[list[UUID] | None, Query()] = None,
    timezone: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=1000)] = 1000,
) -> ListResponse:
    """Return daily timelog minutes by LifeOS area."""
    if end < start:
        raise HTTPException(status_code=400, detail="end must be on or after start")
    selected_areas = _parse_area_ids(area_ids)
    rows: list[dict[str, object]] = []
    cursor = start
    while cursor <= end:
        report = await timelog_stats.get_timelog_stats_groupby_area_for_day(
            session,
            target_date=cursor,
        )
        for row in report.rows:
            if _filter_area(row.area_id, selected_areas):
                rows.append(
                    {
                        "date": cursor.isoformat(),
                        "area_id": str(row.area_id),
                        "minutes": row.minutes,
                    }
                )
        cursor += timedelta(days=1)
    return ListResponse(
        items=_page_items(rows, page=page, size=size),
        pagination=_pagination(page=page, size=size, total=len(rows)),
        meta={
            "start": start.isoformat(),
            "end": end.isoformat(),
            "timezone": timezone,
            "area_ids": [str(item) for item in area_ids] if area_ids else None,
        },
    )


@router.get("/day-breakdown", response_model=ListResponse)
async def get_day_breakdown(
    session: SessionDep,
    day: date,
    timezone: str | None = None,
) -> ListResponse:
    """Return one local day's timelog minutes by LifeOS area."""
    report = await timelog_stats.get_timelog_stats_groupby_area_for_day(
        session,
        target_date=day,
    )
    rows = [
        {
            "area_id": str(row.area_id),
            "minutes": row.minutes,
        }
        for row in report.rows
    ]
    return ListResponse(
        items=rows,
        pagination=Pagination(page=1, size=100, total=len(rows), pages=1 if rows else 0),
        meta={"day": day.isoformat(), "timezone": timezone or report.timezone},
    )


@router.get("/aggregated-areas", response_model=ListResponse)
async def list_aggregated_areas(
    session: SessionDep,
    granularity: Granularity,
    start: date,
    end: date,
    area_ids: Annotated[list[UUID] | None, Query()] = None,
    timezone: str | None = None,
    first_day_of_week: int | None = None,
    calendar_system: str | None = None,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=1000)] = 1000,
) -> ListResponse:
    """Return aggregated timelog minutes by LifeOS area."""
    if end < start:
        raise HTTPException(status_code=400, detail="end must be on or after start")
    selected_areas = _parse_area_ids(area_ids)
    rows: list[dict[str, object]] = []
    seen_periods: set[tuple[date, date]] = set()
    cursor = start
    while cursor <= end:
        report = await _aggregated_report(session, granularity=granularity, cursor=cursor)
        period_key = (report.start_date, report.end_date)
        if period_key not in seen_periods:
            seen_periods.add(period_key)
            for row in report.rows:
                if _filter_area(row.area_id, selected_areas):
                    rows.append(
                        {
                            "granularity": granularity,
                            "period_start": report.start_date.isoformat(),
                            "period_end": report.end_date.isoformat(),
                            "area_id": str(row.area_id),
                            "minutes": row.minutes,
                        }
                    )
        cursor = _next_period_start(granularity, cursor)
    return ListResponse(
        items=_page_items(rows, page=page, size=size),
        pagination=_pagination(page=page, size=size, total=len(rows)),
        meta={
            "granularity": granularity,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "timezone": timezone,
            "area_ids": [str(item) for item in area_ids] if area_ids else None,
            "first_day_of_week": first_day_of_week,
            "calendar_system": calendar_system,
        },
    )


@router.post("/daily-areas/recompute")
async def recompute_daily_areas(
    session: SessionDep,
    start: date,
    end: date,
    timezone: str | None = None,
) -> dict[str, object]:
    """Rebuild persisted LifeOS timelog stats for a local date range."""
    del timezone
    if end < start:
        raise HTTPException(status_code=400, detail="end must be on or after start")
    try:
        rebuilt_dates = await timelog_stats.rebuild_timelog_stats_groupby_area(
            session,
            start_date=start,
            end_date=end,
        )
    except timelog_stats.TimelogStatsValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"days_recomputed": len(rebuilt_dates)}
