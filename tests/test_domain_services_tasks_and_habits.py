from __future__ import annotations

import asyncio
from datetime import date
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from lifeos_cli.db.services import habit_mutations, habits, task_mutations, tasks


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

    async def fake_load_people(_: object, **kwargs: object) -> dict[UUID, list[object]]:
        task_id = cast(Any, session.added_task).id
        return {task_id: []} if task_id is not None else {}

    monkeypatch.setattr(task_mutations, "ensure_vision_exists", fake_ensure_vision_exists)
    monkeypatch.setattr(task_mutations, "validate_parent_task", fake_validate_parent_task)
    monkeypatch.setattr(task_mutations, "load_people_for_entities", fake_load_people)
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
    monkeypatch.setattr(
        task_mutations,
        "load_people_for_entities",
        AsyncMock(return_value={task.id: []}),
    )
    recompute_subtree = AsyncMock()
    recompute_upwards = AsyncMock()
    monkeypatch.setattr(task_mutations, "recompute_subtree_totals", recompute_subtree)
    monkeypatch.setattr(task_mutations, "recompute_totals_upwards", recompute_upwards)

    updated_task = asyncio.run(
        task_mutations.update_task(
            cast(Any, session),
            task_id=UUID("77777777-7777-7777-7777-777777777777"),
            clear_parent=True,
        )
    )

    assert updated_task.parent_task_id is None
    recompute_subtree.assert_awaited_once_with(cast(Any, session), task.id)
    recompute_upwards.assert_any_await(
        cast(Any, session),
        UUID("22222222-2222-2222-2222-222222222222"),
    )
    recompute_upwards.assert_any_await(cast(Any, session), task.id)
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(task)
    session.commit.assert_not_called()


def test_update_task_can_clear_optional_fields_without_committing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    task = SimpleNamespace(
        id=UUID("88888888-8888-8888-8888-888888888888"),
        vision_id=UUID("11111111-1111-1111-1111-111111111111"),
        parent_task_id=None,
        content="Existing task",
        description="Write details",
        status="todo",
        priority=0,
        display_order=0,
        estimated_effort=45,
        planning_cycle_type="week",
        planning_cycle_days=7,
        planning_cycle_start_date=date(2026, 4, 9),
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
        assert task_id == UUID("88888888-8888-8888-8888-888888888888")
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
    monkeypatch.setattr(
        task_mutations,
        "load_people_for_entities",
        AsyncMock(return_value={task.id: []}),
    )

    updated_task = asyncio.run(
        task_mutations.update_task(
            cast(Any, session),
            task_id=UUID("88888888-8888-8888-8888-888888888888"),
            clear_description=True,
            clear_estimated_effort=True,
            clear_planning_cycle=True,
        )
    )

    assert updated_task.description is None
    assert updated_task.estimated_effort is None
    assert updated_task.planning_cycle_type is None
    assert updated_task.planning_cycle_days is None
    assert updated_task.planning_cycle_start_date is None
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(task)
    session.commit.assert_not_called()


def test_update_task_can_clear_people_without_committing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    task = SimpleNamespace(
        id=UUID("99999999-9999-9999-9999-999999999999"),
        vision_id=UUID("11111111-1111-1111-1111-111111111111"),
        parent_task_id=None,
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
        assert task_id == UUID("99999999-9999-9999-9999-999999999999")
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

    async def fake_sync_people(_: object, **kwargs: object) -> None:
        assert kwargs["entity_type"] == "task"
        assert kwargs["desired_person_ids"] == []

    async def fake_load_people(_: object, **kwargs: object) -> dict[UUID, list[object]]:
        return {task.id: []}

    monkeypatch.setattr(task_mutations, "get_task", fake_get_task)
    monkeypatch.setattr(task_mutations, "validate_parent_task", fake_validate_parent_task)
    monkeypatch.setattr(task_mutations, "sync_entity_people", fake_sync_people)
    monkeypatch.setattr(task_mutations, "load_people_for_entities", fake_load_people)

    updated_task = asyncio.run(
        task_mutations.update_task(
            cast(Any, session),
            task_id=UUID("99999999-9999-9999-9999-999999999999"),
            clear_people=True,
        )
    )

    assert updated_task.people == []
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(task)
    session.commit.assert_not_called()


def test_create_habit_generates_actions_without_committing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = SimpleNamespace(
        add=None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )
    added_records: list[object] = []

    def fake_add(record: object) -> None:
        if getattr(record, "id", None) is None:
            cast(Any, record).id = UUID("99999999-9999-9999-9999-999999999999")
        added_records.append(record)

    async def fake_ensure_active_capacity(_: object, **__: object) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_refresh_habit_expiration(_: object, *, habit_id: UUID | None = None) -> int:
        assert habit_id == UUID("99999999-9999-9999-9999-999999999999")
        return 0

    session.add = fake_add
    monkeypatch.setattr(habit_mutations, "ensure_active_capacity", fake_ensure_active_capacity)
    monkeypatch.setattr(habit_mutations, "ensure_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(habit_mutations, "refresh_habit_expiration", fake_refresh_habit_expiration)

    habit = asyncio.run(
        habits.create_habit(
            cast(Any, session),
            title="Daily Exercise",
            start_date=date(2026, 4, 9),
            duration_days=7,
        )
    )

    assert habit.title == "Daily Exercise"
    assert len(added_records) == 8
    session.flush.assert_awaited()
    session.commit.assert_not_called()


def test_update_habit_can_clear_task_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    habit = SimpleNamespace(
        id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        title="Daily Exercise",
        description="Move every day",
        start_date=date(2026, 4, 9),
        duration_days=21,
        status="active",
        task_id=UUID("11111111-1111-1111-1111-111111111111"),
    )
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock(), commit=AsyncMock())

    async def fake_get_habit(_: object, *, habit_id: UUID, include_deleted: bool = False) -> object:
        assert habit_id == UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        assert include_deleted is False
        return habit

    async def fake_refresh_habit_expiration(_: object, *, habit_id: UUID | None = None) -> int:
        assert habit_id == UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        return 0

    monkeypatch.setattr(habit_mutations, "get_habit", fake_get_habit)
    monkeypatch.setattr(habit_mutations, "refresh_habit_expiration", fake_refresh_habit_expiration)

    updated_habit = asyncio.run(
        habits.update_habit(
            cast(Any, session),
            habit_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            clear_task=True,
        )
    )

    assert updated_habit.task_id is None
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(habit)
    session.commit.assert_not_called()
