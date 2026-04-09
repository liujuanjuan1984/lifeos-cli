from __future__ import annotations

import asyncio
from datetime import date
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from lifeos_cli.db.services import people, tasks


def test_create_person_flushes_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        add=None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
        execute=AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None)),
    )

    def fake_add(person: object) -> None:
        session.added_person = person

    async def fake_attach_tags(session_: object, person: object) -> object:
        return person

    session.add = fake_add
    monkeypatch.setattr(people, "_attach_tags", fake_attach_tags)

    person = asyncio.run(people.create_person(cast(Any, session), name="Alice"))

    assert person.name == "Alice"
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_validate_planning_cycle_requires_complete_fields() -> None:
    with pytest.raises(tasks.InvalidPlanningCycleError):
        tasks.validate_planning_cycle(
            planning_cycle_type="week",
            planning_cycle_days=None,
            planning_cycle_start_date=date(2026, 4, 9),
        )


def test_create_task_flushes_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        add=None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )

    async def fake_ensure_vision_exists(_: object, vision_id: UUID) -> None:
        assert vision_id == UUID("11111111-1111-1111-1111-111111111111")

    async def fake_validate_parent_task(
        _: object,
        *,
        vision_id: UUID,
        parent_task_id: UUID | None,
    ) -> None:
        assert vision_id == UUID("11111111-1111-1111-1111-111111111111")
        assert parent_task_id is None

    def fake_add(task: object) -> None:
        session.added_task = task

    monkeypatch.setattr(tasks, "_ensure_vision_exists", fake_ensure_vision_exists)
    monkeypatch.setattr(tasks, "_validate_parent_task", fake_validate_parent_task)
    session.add = fake_add

    task = asyncio.run(
        tasks.create_task(
            cast(Any, session),
            vision_id=UUID("11111111-1111-1111-1111-111111111111"),
            content="Draft release checklist",
        )
    )

    assert task.content == "Draft release checklist"
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()
