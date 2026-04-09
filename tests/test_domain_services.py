from __future__ import annotations

import asyncio
from datetime import date
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from lifeos_cli.db.services import (
    areas,
    events,
    habits,
    people,
    tags,
    task_mutations,
    tasks,
    timelogs,
    visions,
)
from tests.support import utc_datetime


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


def test_create_event_flushes_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        add=None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )

    def fake_add(event: object) -> None:
        session.added_event = event

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_attach_event_links(_: object, event: object) -> object:
        return event

    session.add = fake_add
    monkeypatch.setattr(events, "ensure_event_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(events, "ensure_event_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(events, "_attach_event_links", fake_attach_event_links)

    event = asyncio.run(
        events.create_event(
            cast(Any, session),
            title="Doctor appointment",
            start_time=utc_datetime(2026, 4, 10, 13, 0),
        )
    )

    assert event.title == "Doctor appointment"
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_create_timelog_flushes_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        add=None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )

    def fake_add(timelog: object) -> None:
        session.added_timelog = timelog

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_ensure_task_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_attach_timelog_links(_: object, timelog: object) -> object:
        return timelog

    session.add = fake_add
    monkeypatch.setattr(timelogs, "ensure_timelog_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(timelogs, "ensure_timelog_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(timelogs, "_attach_timelog_links", fake_attach_timelog_links)

    timelog = asyncio.run(
        timelogs.create_timelog(
            cast(Any, session),
            title="Deep work",
            start_time=utc_datetime(2026, 4, 10, 13, 0),
            end_time=utc_datetime(2026, 4, 10, 14, 0),
        )
    )

    assert timelog.title == "Deep work"
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


def test_update_area_can_clear_optional_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    area = SimpleNamespace(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        name="Health",
        description="Focus",
        color="#3B82F6",
        icon="heart",
        is_active=True,
        display_order=1,
    )
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock(), commit=AsyncMock())

    async def fake_get_area(_: object, *, area_id: UUID, include_deleted: bool = False) -> object:
        assert area_id == UUID("11111111-1111-1111-1111-111111111111")
        assert include_deleted is False
        return area

    monkeypatch.setattr(areas, "get_area", fake_get_area)
    monkeypatch.setattr(
        areas,
        "load_people_for_entities",
        AsyncMock(return_value={area.id: []}),
    )

    updated_area = asyncio.run(
        areas.update_area(
            cast(Any, session),
            area_id=UUID("11111111-1111-1111-1111-111111111111"),
            clear_description=True,
            clear_icon=True,
        )
    )

    assert updated_area.description is None
    assert updated_area.icon is None
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_create_area_syncs_people_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        add=None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
        execute=AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None)),
    )

    def fake_add(area: object) -> None:
        session.added_area = area

    async def fake_sync_people(_: object, **kwargs: object) -> None:
        assert kwargs["entity_type"] == "area"
        assert kwargs["desired_person_ids"] == [UUID("11111111-1111-1111-1111-111111111111")]

    async def fake_load_people(_: object, **kwargs: object) -> dict[UUID, list[object]]:
        area_id = cast(Any, session.added_area).id
        return {area_id: [SimpleNamespace(name="Alice")]}

    session.add = fake_add
    monkeypatch.setattr(areas, "sync_entity_people", fake_sync_people)
    monkeypatch.setattr(areas, "load_people_for_entities", fake_load_people)

    area = asyncio.run(
        areas.create_area(
            cast(Any, session),
            name="Health",
            person_ids=[UUID("11111111-1111-1111-1111-111111111111")],
        )
    )

    assert len(area.people) == 1
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_update_tag_can_clear_optional_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    tag = SimpleNamespace(
        id=UUID("22222222-2222-2222-2222-222222222222"),
        name="urgent",
        entity_type="task",
        category="general",
        description="High priority",
        color="#DC2626",
    )
    session = SimpleNamespace(
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
        execute=AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None)),
    )

    async def fake_get_tag(_: object, *, tag_id: UUID, include_deleted: bool = False) -> object:
        assert tag_id == UUID("22222222-2222-2222-2222-222222222222")
        assert include_deleted is False
        return tag

    monkeypatch.setattr(tags, "get_tag", fake_get_tag)
    monkeypatch.setattr(
        tags,
        "load_people_for_entities",
        AsyncMock(return_value={tag.id: []}),
    )

    updated_tag = asyncio.run(
        tags.update_tag(
            cast(Any, session),
            tag_id=UUID("22222222-2222-2222-2222-222222222222"),
            clear_description=True,
            clear_color=True,
        )
    )

    assert updated_tag.description is None
    assert updated_tag.color is None
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_update_tag_can_clear_people(monkeypatch: pytest.MonkeyPatch) -> None:
    tag = SimpleNamespace(
        id=UUID("22222222-2222-2222-2222-222222222222"),
        name="urgent",
        entity_type="task",
        category="general",
        description=None,
        color=None,
    )
    session = SimpleNamespace(
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
        execute=AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None)),
    )

    async def fake_get_tag(_: object, *, tag_id: UUID, include_deleted: bool = False) -> object:
        assert tag_id == UUID("22222222-2222-2222-2222-222222222222")
        assert include_deleted is False
        return tag

    async def fake_sync_people(_: object, **kwargs: object) -> None:
        assert kwargs["entity_type"] == "tag"
        assert kwargs["desired_person_ids"] == []

    async def fake_load_people(_: object, **kwargs: object) -> dict[UUID, list[object]]:
        return {tag.id: []}

    monkeypatch.setattr(tags, "get_tag", fake_get_tag)
    monkeypatch.setattr(tags, "sync_entity_people", fake_sync_people)
    monkeypatch.setattr(tags, "load_people_for_entities", fake_load_people)

    updated_tag = asyncio.run(
        tags.update_tag(
            cast(Any, session),
            tag_id=UUID("22222222-2222-2222-2222-222222222222"),
            clear_people=True,
        )
    )

    assert updated_tag.people == []
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_update_person_can_clear_optional_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    person = SimpleNamespace(
        id=UUID("33333333-3333-3333-3333-333333333333"),
        name="Alice",
        description="Friend",
        nicknames=["ally"],
        birth_date=date(2026, 4, 9),
        location="Toronto",
        tags=[],
    )
    session = SimpleNamespace(
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
    )

    async def fake_get_person(
        _: object,
        *,
        person_id: UUID,
        include_deleted: bool = False,
    ) -> object:
        assert person_id == UUID("33333333-3333-3333-3333-333333333333")
        assert include_deleted is False
        return person

    async def fake_attach_tags(_: object, person_record: object) -> object:
        return person_record

    async def fake_sync_entity_tags(
        _: object,
        *,
        entity_id: UUID,
        entity_type: str,
        desired_tag_ids: list[UUID],
    ) -> None:
        assert entity_id == UUID("33333333-3333-3333-3333-333333333333")
        assert entity_type == "person"
        assert desired_tag_ids == []

    monkeypatch.setattr(people, "get_person", fake_get_person)
    monkeypatch.setattr(people, "_attach_tags", fake_attach_tags)
    monkeypatch.setattr(people, "sync_entity_tags", fake_sync_entity_tags)

    updated_person = asyncio.run(
        people.update_person(
            cast(Any, session),
            person_id=UUID("33333333-3333-3333-3333-333333333333"),
            clear_description=True,
            clear_nicknames=True,
            clear_birth_date=True,
            clear_location=True,
            clear_tags=True,
        )
    )

    assert updated_person.description is None
    assert updated_person.nicknames is None
    assert updated_person.birth_date is None
    assert updated_person.location is None
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_update_vision_can_clear_optional_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    vision = SimpleNamespace(
        id=UUID("44444444-4444-4444-4444-444444444444"),
        name="Launch lifeos-cli",
        description="Ship the first release",
        status="active",
        area_id=UUID("11111111-1111-1111-1111-111111111111"),
        experience_rate_per_hour=120,
    )
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock(), commit=AsyncMock())

    async def fake_get_vision(
        _: object,
        *,
        vision_id: UUID,
        include_deleted: bool = False,
    ) -> object:
        assert vision_id == UUID("44444444-4444-4444-4444-444444444444")
        assert include_deleted is False
        return vision

    monkeypatch.setattr(visions, "get_vision", fake_get_vision)
    monkeypatch.setattr(
        visions,
        "load_people_for_entities",
        AsyncMock(return_value={vision.id: []}),
    )

    updated_vision = asyncio.run(
        visions.update_vision(
            cast(Any, session),
            vision_id=UUID("44444444-4444-4444-4444-444444444444"),
            clear_description=True,
            clear_area=True,
            clear_experience_rate=True,
        )
    )

    assert updated_vision.description is None
    assert updated_vision.area_id is None
    assert updated_vision.experience_rate_per_hour is None
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_create_vision_syncs_people_without_committing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session = SimpleNamespace(
        add=None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
        execute=AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None)),
    )

    def fake_add(vision: object) -> None:
        session.added_vision = vision

    async def fake_ensure_area_exists(_: object, __: UUID | None) -> None:
        return None

    async def fake_sync_people(_: object, **kwargs: object) -> None:
        assert kwargs["entity_type"] == "vision"
        assert kwargs["desired_person_ids"] == [UUID("11111111-1111-1111-1111-111111111111")]

    async def fake_load_people(_: object, **kwargs: object) -> dict[UUID, list[object]]:
        vision_id = cast(Any, session.added_vision).id
        return {vision_id: [SimpleNamespace(name="Alice")]}

    session.add = fake_add
    monkeypatch.setattr(visions, "_ensure_area_exists", fake_ensure_area_exists)
    monkeypatch.setattr(visions, "sync_entity_people", fake_sync_people)
    monkeypatch.setattr(visions, "load_people_for_entities", fake_load_people)

    vision = asyncio.run(
        visions.create_vision(
            cast(Any, session),
            name="Launch lifeos-cli",
            person_ids=[UUID("11111111-1111-1111-1111-111111111111")],
        )
    )

    assert len(vision.people) == 1
    session.flush.assert_awaited_once()
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
    monkeypatch.setattr(habits, "ensure_active_capacity", fake_ensure_active_capacity)
    monkeypatch.setattr(habits, "ensure_task_exists", fake_ensure_task_exists)
    monkeypatch.setattr(habits, "refresh_habit_expiration", fake_refresh_habit_expiration)

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

    monkeypatch.setattr(habits, "get_habit", fake_get_habit)
    monkeypatch.setattr(habits, "refresh_habit_expiration", fake_refresh_habit_expiration)

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


def test_update_event_can_clear_optional_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    event = SimpleNamespace(
        id=UUID("abababab-abab-abab-abab-abababababab"),
        title="Doctor appointment",
        description="Checkup",
        start_time=utc_datetime(2026, 4, 10, 9, 0),
        end_time=utc_datetime(2026, 4, 10, 10, 0),
        priority=3,
        status="planned",
        is_all_day=False,
        area_id=UUID("11111111-1111-1111-1111-111111111111"),
        task_id=UUID("22222222-2222-2222-2222-222222222222"),
    )
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock(), commit=AsyncMock())

    async def fake_get_event(_: object, *, event_id: UUID, include_deleted: bool = False) -> object:
        assert event_id == UUID("abababab-abab-abab-abab-abababababab")
        assert include_deleted is False
        return event

    async def fake_attach_event_links(_: object, event_record: object) -> object:
        return event_record

    async def fake_sync_tags(_: object, **__: object) -> None:
        return None

    async def fake_sync_people(_: object, **__: object) -> None:
        return None

    monkeypatch.setattr(events, "get_event", fake_get_event)
    monkeypatch.setattr(events, "_attach_event_links", fake_attach_event_links)
    monkeypatch.setattr(events, "sync_entity_tags", fake_sync_tags)
    monkeypatch.setattr(events, "sync_entity_people", fake_sync_people)

    updated_event = asyncio.run(
        events.update_event(
            cast(Any, session),
            event_id=UUID("abababab-abab-abab-abab-abababababab"),
            clear_description=True,
            clear_end_time=True,
            clear_area=True,
            clear_task=True,
            clear_tags=True,
            clear_people=True,
        )
    )

    assert updated_event.description is None
    assert updated_event.end_time is None
    assert updated_event.area_id is None
    assert updated_event.task_id is None
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_update_timelog_can_clear_optional_fields(monkeypatch: pytest.MonkeyPatch) -> None:
    timelog = SimpleNamespace(
        id=UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd"),
        title="Deep work",
        start_time=utc_datetime(2026, 4, 10, 13, 0),
        end_time=utc_datetime(2026, 4, 10, 14, 0),
        tracking_method="manual",
        location="Desk",
        energy_level=4,
        notes="Focused",
        area_id=UUID("11111111-1111-1111-1111-111111111111"),
        task_id=UUID("22222222-2222-2222-2222-222222222222"),
    )
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock(), commit=AsyncMock())

    async def fake_get_timelog(
        _: object,
        *,
        timelog_id: UUID,
        include_deleted: bool = False,
    ) -> object:
        assert timelog_id == UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd")
        assert include_deleted is False
        return timelog

    async def fake_attach_timelog_links(_: object, timelog_record: object) -> object:
        return timelog_record

    async def fake_sync_tags(_: object, **__: object) -> None:
        return None

    async def fake_sync_people(_: object, **__: object) -> None:
        return None

    monkeypatch.setattr(timelogs, "get_timelog", fake_get_timelog)
    monkeypatch.setattr(timelogs, "_attach_timelog_links", fake_attach_timelog_links)
    monkeypatch.setattr(timelogs, "sync_entity_tags", fake_sync_tags)
    monkeypatch.setattr(timelogs, "sync_entity_people", fake_sync_people)

    updated_timelog = asyncio.run(
        timelogs.update_timelog(
            cast(Any, session),
            timelog_id=UUID("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd"),
            clear_location=True,
            clear_energy_level=True,
            clear_notes=True,
            clear_area=True,
            clear_task=True,
            clear_tags=True,
            clear_people=True,
        )
    )

    assert updated_timelog.location is None
    assert updated_timelog.energy_level is None
    assert updated_timelog.notes is None
    assert updated_timelog.area_id is None
    assert updated_timelog.task_id is None
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()
