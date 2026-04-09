from __future__ import annotations

import asyncio
from datetime import date
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from lifeos_cli.db.services import people, task_mutations, tasks


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

    monkeypatch.setattr(task_mutations, "ensure_vision_exists", fake_ensure_vision_exists)
    monkeypatch.setattr(task_mutations, "validate_parent_task", fake_validate_parent_task)
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


def test_update_task_can_clear_parent_without_committing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    task = SimpleNamespace(
        id=UUID("77777777-7777-7777-7777-777777777777"),
        vision_id=UUID("11111111-1111-1111-1111-111111111111"),
        parent_task_id=UUID("22222222-2222-2222-2222-222222222222"),
        content="Existing task",
        description=None,
        status="todo",
        priority=0,
        display_order=0,
        estimated_effort=None,
        planning_cycle_type=None,
        planning_cycle_days=None,
        planning_cycle_start_date=None,
    )
    session = SimpleNamespace(
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )

    async def fake_get_task(
        _: object,
        *,
        task_id: UUID,
        include_deleted: bool = False,
    ) -> object:
        assert task_id == UUID("77777777-7777-7777-7777-777777777777")
        assert include_deleted is False
        return task

    async def fake_validate_parent_task(
        _: object,
        *,
        vision_id: UUID,
        parent_task_id: UUID | None,
    ) -> None:
        assert vision_id == UUID("11111111-1111-1111-1111-111111111111")
        assert parent_task_id is None

    monkeypatch.setattr(task_mutations, "get_task", fake_get_task)
    monkeypatch.setattr(task_mutations, "validate_parent_task", fake_validate_parent_task)

    updated_task = asyncio.run(
        task_mutations.update_task(
            cast(Any, session),
            task_id=UUID("77777777-7777-7777-7777-777777777777"),
            clear_parent=True,
        )
    )

    assert updated_task.parent_task_id is None
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(task)
    session.commit.assert_not_called()
