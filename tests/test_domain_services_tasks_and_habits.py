from __future__ import annotations

import asyncio
from datetime import date
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, Mock
from uuid import UUID

import pytest

from lifeos_cli.db.services import (
    habit_mutations,
    habit_queries,
    habits,
    task_mutations,
    task_queries,
    task_support,
    tasks,
)


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
        child_task_id: UUID | None = None,
    ) -> None:
        assert vision_id == UUID("11111111-1111-1111-1111-111111111111")
        assert parent_task_id is None
        assert child_task_id is None

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
        child_task_id: UUID | None = None,
    ) -> None:
        assert vision_id == UUID("11111111-1111-1111-1111-111111111111")
        assert parent_task_id is None
        assert child_task_id == task.id

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


def test_move_task_updates_parent_vision_and_descendants(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    task = SimpleNamespace(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        vision_id=UUID("22222222-2222-2222-2222-222222222222"),
        parent_task_id=UUID("33333333-3333-3333-3333-333333333333"),
        display_order=0,
    )
    descendant = SimpleNamespace(
        id=UUID("44444444-4444-4444-4444-444444444444"),
        vision_id=UUID("55555555-5555-5555-5555-555555555555"),
    )
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock(), commit=AsyncMock())

    async def fake_get_task(
        _: object,
        *,
        task_id: UUID,
        include_deleted: bool = False,
    ) -> object:
        assert task_id == task.id
        assert include_deleted is False
        return task

    async def fake_ensure_vision_exists(_: object, vision_id: UUID) -> None:
        assert vision_id == UUID("55555555-5555-5555-5555-555555555555")

    async def fake_validate_parent_task(_: object, **kwargs: object) -> None:
        assert kwargs["vision_id"] == UUID("55555555-5555-5555-5555-555555555555")
        assert kwargs["parent_task_id"] == UUID("66666666-6666-6666-6666-666666666666")
        assert kwargs["child_task_id"] == task.id

    async def fake_update_descendant_visions(_: object, **kwargs: object) -> tuple[object, ...]:
        assert kwargs["root_task_id"] == task.id
        assert kwargs["new_vision_id"] == UUID("55555555-5555-5555-5555-555555555555")
        return (descendant,)

    recompute_subtree = AsyncMock()
    recompute_upwards = AsyncMock()
    monkeypatch.setattr(task_mutations, "get_task", fake_get_task)
    monkeypatch.setattr(task_mutations, "ensure_vision_exists", fake_ensure_vision_exists)
    monkeypatch.setattr(task_mutations, "validate_parent_task", fake_validate_parent_task)
    monkeypatch.setattr(
        task_mutations,
        "_update_descendant_visions",
        fake_update_descendant_visions,
    )
    monkeypatch.setattr(task_mutations, "recompute_subtree_totals", recompute_subtree)
    monkeypatch.setattr(task_mutations, "recompute_totals_upwards", recompute_upwards)
    monkeypatch.setattr(
        task_mutations,
        "load_people_for_entities",
        AsyncMock(return_value={task.id: []}),
    )

    result = asyncio.run(
        tasks.move_task(
            cast(Any, session),
            task_id=task.id,
            old_parent_task_id=task.parent_task_id,
            new_parent_task_id=UUID("66666666-6666-6666-6666-666666666666"),
            new_vision_id=UUID("55555555-5555-5555-5555-555555555555"),
            new_display_order=7,
        )
    )

    assert result.task is task
    assert result.updated_descendants == (descendant,)
    assert task.parent_task_id == UUID("66666666-6666-6666-6666-666666666666")
    assert task.vision_id == UUID("55555555-5555-5555-5555-555555555555")
    assert task.display_order == 7
    recompute_subtree.assert_awaited_once_with(cast(Any, session), task.id)
    recompute_upwards.assert_any_await(
        cast(Any, session),
        UUID("33333333-3333-3333-3333-333333333333"),
    )
    recompute_upwards.assert_any_await(
        cast(Any, session),
        UUID("66666666-6666-6666-6666-666666666666"),
    )
    recompute_upwards.assert_any_await(cast(Any, session), task.id)
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(task)
    session.commit.assert_not_called()


def test_move_task_preserves_parent_when_parent_change_is_not_requested(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    task = SimpleNamespace(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        vision_id=UUID("22222222-2222-2222-2222-222222222222"),
        parent_task_id=UUID("33333333-3333-3333-3333-333333333333"),
        display_order=5,
    )
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock(), commit=AsyncMock())

    async def fake_get_task(
        _: object,
        *,
        task_id: UUID,
        include_deleted: bool = False,
    ) -> object:
        assert task_id == task.id
        assert include_deleted is False
        return task

    async def fake_validate_parent_task(_: object, **kwargs: object) -> None:
        assert kwargs["vision_id"] == task.vision_id
        assert kwargs["parent_task_id"] == task.parent_task_id
        assert kwargs["child_task_id"] == task.id

    recompute_subtree = AsyncMock()
    recompute_upwards = AsyncMock()
    monkeypatch.setattr(task_mutations, "get_task", fake_get_task)
    monkeypatch.setattr(task_mutations, "validate_parent_task", fake_validate_parent_task)
    monkeypatch.setattr(task_mutations, "recompute_subtree_totals", recompute_subtree)
    monkeypatch.setattr(task_mutations, "recompute_totals_upwards", recompute_upwards)
    monkeypatch.setattr(
        task_mutations,
        "load_people_for_entities",
        AsyncMock(return_value={task.id: []}),
    )

    result = asyncio.run(
        tasks.move_task(
            cast(Any, session),
            task_id=task.id,
            new_display_order=7,
        )
    )

    assert result.task is task
    assert task.parent_task_id == UUID("33333333-3333-3333-3333-333333333333")
    assert task.display_order == 7
    recompute_subtree.assert_awaited_once_with(cast(Any, session), task.id)
    recompute_upwards.assert_any_await(
        cast(Any, session),
        UUID("33333333-3333-3333-3333-333333333333"),
    )
    recompute_upwards.assert_any_await(cast(Any, session), task.id)
    assert recompute_upwards.await_count == 2
    session.flush.assert_awaited_once()
    session.refresh.assert_awaited_once_with(task)
    session.commit.assert_not_called()


def test_reorder_tasks_updates_display_order_without_committing() -> None:
    task_1 = SimpleNamespace(id=UUID("11111111-1111-1111-1111-111111111111"), display_order=3)
    task_2 = SimpleNamespace(id=UUID("22222222-2222-2222-2222-222222222222"), display_order=4)
    result = SimpleNamespace(scalars=lambda: [task_1, task_2])
    session = SimpleNamespace(execute=AsyncMock(return_value=result), flush=AsyncMock())

    asyncio.run(
        tasks.reorder_tasks(
            cast(Any, session),
            task_orders=[(task_1.id, 0), (task_2.id, 1)],
        )
    )

    assert task_1.display_order == 0
    assert task_2.display_order == 1
    session.flush.assert_awaited_once()


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
        child_task_id: UUID | None = None,
    ) -> None:
        assert vision_id == UUID("11111111-1111-1111-1111-111111111111")
        assert parent_task_id is None
        assert child_task_id == task.id

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
        child_task_id: UUID | None = None,
    ) -> None:
        assert vision_id == UUID("11111111-1111-1111-1111-111111111111")
        assert parent_task_id is None
        assert child_task_id == task.id

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


def test_validate_parent_task_rejects_circular_reference(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root_id = UUID("11111111-1111-1111-1111-111111111111")
    child_id = UUID("22222222-2222-2222-2222-222222222222")
    vision_id = UUID("33333333-3333-3333-3333-333333333333")
    root_task = SimpleNamespace(id=root_id, vision_id=vision_id, parent_task_id=None)
    child_task = SimpleNamespace(id=child_id, vision_id=vision_id, parent_task_id=root_id)

    async def fake_load_parent_task(_: object, parent_task_id: UUID | None) -> object | None:
        if parent_task_id is None:
            return None
        return {
            root_id: root_task,
            child_id: child_task,
        }.get(parent_task_id)

    monkeypatch.setattr(task_support, "load_parent_task", fake_load_parent_task)

    with pytest.raises(tasks.CircularTaskReferenceError):
        asyncio.run(
            task_support.validate_parent_task(
                cast(Any, object()),
                vision_id=vision_id,
                parent_task_id=child_id,
                child_task_id=root_id,
            )
        )


def test_validate_task_status_change_rejects_done_with_incomplete_children() -> None:
    task = SimpleNamespace(id=UUID("11111111-1111-1111-1111-111111111111"), status="todo")
    result = SimpleNamespace(scalars=lambda: ["done", "todo"])
    session = SimpleNamespace(execute=AsyncMock(return_value=result))

    with pytest.raises(tasks.TaskCannotBeCompletedError):
        asyncio.run(
            tasks.validate_task_status_change(
                cast(Any, session),
                task=cast(Any, task),
                new_status="done",
            )
        )


def test_delete_task_soft_deletes_subtree_without_committing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root_task = SimpleNamespace(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        parent_task_id=UUID("22222222-2222-2222-2222-222222222222"),
        soft_delete=Mock(),
    )
    child_task = SimpleNamespace(
        id=UUID("33333333-3333-3333-3333-333333333333"),
        parent_task_id=root_task.id,
        soft_delete=Mock(),
    )
    session = SimpleNamespace(flush=AsyncMock(), commit=AsyncMock())

    async def fake_get_task(
        _: object,
        *,
        task_id: UUID,
        include_deleted: bool = False,
    ) -> object:
        assert task_id == root_task.id
        assert include_deleted is False
        return root_task

    monkeypatch.setattr(task_mutations, "get_task", fake_get_task)
    monkeypatch.setattr(
        task_mutations,
        "load_task_subtree",
        AsyncMock(return_value=[root_task, child_task]),
    )
    recompute_upwards = AsyncMock()
    monkeypatch.setattr(task_mutations, "recompute_totals_upwards", recompute_upwards)

    asyncio.run(task_mutations.delete_task(cast(Any, session), task_id=root_task.id))

    root_task.soft_delete.assert_called_once_with()
    child_task.soft_delete.assert_called_once_with()
    recompute_upwards.assert_awaited_once_with(cast(Any, session), root_task.parent_task_id)
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_get_task_with_subtasks_builds_tree(monkeypatch: pytest.MonkeyPatch) -> None:
    root_task = SimpleNamespace(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        vision_id=UUID("22222222-2222-2222-2222-222222222222"),
        parent_task_id=None,
        content="Root task",
        description=None,
        status="todo",
        priority=0,
        display_order=0,
        estimated_effort=60,
        planning_cycle_type=None,
        planning_cycle_days=None,
        planning_cycle_start_date=None,
        actual_effort_self=30,
        actual_effort_total=60,
        created_at=None,
        updated_at=None,
        deleted_at=None,
    )
    child_task = SimpleNamespace(
        id=UUID("33333333-3333-3333-3333-333333333333"),
        vision_id=root_task.vision_id,
        parent_task_id=root_task.id,
        content="Child task",
        description=None,
        status="done",
        priority=0,
        display_order=0,
        estimated_effort=30,
        planning_cycle_type=None,
        planning_cycle_days=None,
        planning_cycle_start_date=None,
        actual_effort_self=30,
        actual_effort_total=30,
        created_at=None,
        updated_at=None,
        deleted_at=None,
    )

    monkeypatch.setattr(
        task_queries,
        "load_task_subtree",
        AsyncMock(return_value=[root_task, child_task]),
    )
    monkeypatch.setattr(
        task_queries,
        "load_people_for_entities",
        AsyncMock(return_value={root_task.id: [], child_task.id: []}),
    )

    result = asyncio.run(tasks.get_task_with_subtasks(cast(Any, object()), task_id=root_task.id))

    assert result is not None
    assert result.id == root_task.id
    assert result.depth == 0
    assert result.completion_percentage == 1.0
    assert len(result.subtasks) == 1
    assert result.subtasks[0].id == child_task.id
    assert result.subtasks[0].depth == 1


def test_get_task_stats_summarizes_subtree(monkeypatch: pytest.MonkeyPatch) -> None:
    root_task = SimpleNamespace(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        parent_task_id=None,
        status="todo",
        estimated_effort=60,
        actual_effort_self=30,
    )
    child_task_1 = SimpleNamespace(
        id=UUID("22222222-2222-2222-2222-222222222222"),
        parent_task_id=root_task.id,
        status="done",
        estimated_effort=30,
        actual_effort_self=20,
    )
    child_task_2 = SimpleNamespace(
        id=UUID("33333333-3333-3333-3333-333333333333"),
        parent_task_id=root_task.id,
        status="todo",
        estimated_effort=45,
        actual_effort_self=10,
    )
    monkeypatch.setattr(
        task_queries,
        "load_task_subtree",
        AsyncMock(return_value=[root_task, child_task_1, child_task_2]),
    )

    stats = asyncio.run(tasks.get_task_stats(cast(Any, object()), task_id=root_task.id))

    assert stats.total_subtasks == 2
    assert stats.completed_subtasks == 1
    assert stats.completion_percentage == 0.5
    assert stats.total_estimated_effort == 135
    assert stats.total_actual_effort == 60


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


def test_habit_task_associations_require_active_tasks(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    statements: list[object] = []

    class Result:
        def scalars(self) -> list[object]:
            return []

    session = SimpleNamespace()

    async def fake_execute(statement: object) -> Result:
        statements.append(statement)
        return Result()

    async def fake_refresh_habit_expiration(_: object) -> int:
        return 0

    session.execute = fake_execute
    monkeypatch.setattr(habit_queries, "refresh_habit_expiration", fake_refresh_habit_expiration)

    associations = asyncio.run(habits.get_habit_task_associations(cast(Any, session)))

    assert associations == {}
    assert statements
    compiled = str(statements[-1])
    assert "tasks.deleted_at IS NULL" in compiled
    assert "habits.status =" not in compiled


def test_update_habit_action_by_date_uses_existing_update_rules(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    habit_id = UUID("77777777-7777-7777-7777-777777777777")
    action_id = UUID("88888888-8888-8888-8888-888888888888")
    action_date = date(2026, 4, 9)
    action = SimpleNamespace(id=action_id, action_date=action_date)
    session = SimpleNamespace()

    class Result:
        def scalar_one_or_none(self) -> object:
            return action

    async def fake_get_habit(_: object, *, habit_id: UUID, include_deleted: bool = False) -> object:
        assert include_deleted is False
        return SimpleNamespace(id=habit_id)

    async def fake_execute(statement: object) -> Result:
        return Result()

    async def fake_update_habit_action(_: object, **kwargs: object) -> object:
        assert kwargs == {
            "action_id": action_id,
            "status": "done",
            "notes": "Completed",
            "clear_notes": False,
        }
        return action

    session.execute = fake_execute
    monkeypatch.setattr(habit_mutations, "get_habit", fake_get_habit)
    monkeypatch.setattr(habit_mutations, "update_habit_action", fake_update_habit_action)

    updated_action = asyncio.run(
        habits.update_habit_action_by_date(
            cast(Any, session),
            habit_id=habit_id,
            action_date=action_date,
            status="done",
            notes="Completed",
        )
    )

    assert updated_action is action
