"""Unit tests for person activity read queries."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import cast
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from lifeos_cli.db.services import person_activity_queries


def test_list_person_activities_paginates_and_calculates_timelog_metadata(
    monkeypatch,
) -> None:
    person_id = UUID("11111111-1111-1111-1111-111111111111")
    timestamp = datetime(2026, 7, 2, 9, 0, tzinfo=timezone.utc)
    person = SimpleNamespace(id=person_id, name="Helen")
    activities: list[person_activity_queries.PersonActivityItem] = [
        person_activity_queries.PersonActivityItem(
            id=UUID("22222222-2222-2222-2222-222222222222"),
            activity_type="timelog",
            title="Deep work",
            description=None,
            activity_date=timestamp,
            start_time=timestamp,
            end_time=datetime(2026, 7, 2, 9, 30, tzinfo=timezone.utc),
        ),
        person_activity_queries.PersonActivityItem(
            id=UUID("33333333-3333-3333-3333-333333333333"),
            activity_type="timelog",
            title="Review",
            description=None,
            activity_date=timestamp,
            start_time=timestamp,
            end_time=datetime(2026, 7, 2, 10, 0, tzinfo=timezone.utc),
        ),
    ]

    async def fake_get_person(_session: object, *, person_id: UUID) -> object:
        assert person_id == person.id
        return person

    async def fake_load_activity_items(
        _session: object,
        **_kwargs: object,
    ) -> list[person_activity_queries.PersonActivityItem]:
        return activities

    monkeypatch.setattr(person_activity_queries, "get_person", fake_get_person)
    monkeypatch.setattr(person_activity_queries, "_load_activity_items", fake_load_activity_items)

    result = asyncio.run(
        person_activity_queries.list_person_activities(
            cast(AsyncSession, object()),
            person_id=person_id,
            activity_filter="timelog",
            limit=1,
            offset=1,
        )
    )

    assert result is not None
    assert result.items == (activities[1],)
    assert result.total == 2
    assert result.timelog_count == 2
    assert result.timelog_total_minutes == 90


def test_person_activity_and_anniversary_queries_return_none_for_missing_person(
    monkeypatch,
) -> None:
    person_id = UUID("11111111-1111-1111-1111-111111111111")

    async def fake_get_person(_session: object, *, person_id: UUID) -> None:
        assert person_id == UUID("11111111-1111-1111-1111-111111111111")
        return None

    monkeypatch.setattr(person_activity_queries, "get_person", fake_get_person)

    activities = asyncio.run(
        person_activity_queries.list_person_activities(
            cast(AsyncSession, object()),
            person_id=person_id,
            activity_filter=None,
            limit=50,
            offset=0,
        )
    )
    anniversaries = asyncio.run(
        person_activity_queries.list_person_anniversaries(
            cast(AsyncSession, object()),
            person_id=person_id,
        )
    )

    assert activities is None
    assert anniversaries is None
