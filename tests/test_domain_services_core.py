from __future__ import annotations

import asyncio
from datetime import date
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock
from uuid import UUID

import pytest

from lifeos_cli.db.models.vision import Vision
from lifeos_cli.db.services import areas, people, tags, visions


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


def test_create_area_flushes_without_committing(monkeypatch: pytest.MonkeyPatch) -> None:
    session = SimpleNamespace(
        add=None,
        flush=AsyncMock(),
        refresh=AsyncMock(),
        commit=AsyncMock(),
        execute=AsyncMock(return_value=SimpleNamespace(scalar_one_or_none=lambda: None)),
    )

    def fake_add(area: object) -> None:
        session.added_area = area

    session.add = fake_add

    area = asyncio.run(
        areas.create_area(
            cast(Any, session),
            name="Health",
        )
    )

    assert area.name == "Health"
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


def test_vision_experience_rate_validation_matches_compass_bounds() -> None:
    assert visions.VISION_EXPERIENCE_RATE_DEFAULT == 60
    assert visions.VISION_EXPERIENCE_RATE_MAX == 3600
    assert visions.validate_vision_experience_rate(None) is None
    assert visions.validate_vision_experience_rate(1) == 1
    assert visions.validate_vision_experience_rate(3600) == 3600

    with pytest.raises(ValueError, match="between 1 and 3600"):
        visions.validate_vision_experience_rate(0)

    with pytest.raises(ValueError, match="between 1 and 3600"):
        visions.validate_vision_experience_rate(3601)


def test_update_vision_rejects_invalid_experience_rate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vision = SimpleNamespace(
        id=UUID("44444444-4444-4444-4444-444444444444"),
        name="Launch lifeos-cli",
        description=None,
        status="active",
        area_id=None,
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

    with pytest.raises(ValueError, match="between 1 and 3600"):
        asyncio.run(
            visions.update_vision(
                cast(Any, session),
                vision_id=UUID("44444444-4444-4444-4444-444444444444"),
                experience_rate_per_hour=0,
            )
        )

    session.flush.assert_not_awaited()
    session.commit.assert_not_called()


def test_vision_model_syncs_experience_and_harvests_when_ready() -> None:
    vision = Vision(name="Launch lifeos-cli", status="active")
    vision.stage = 0
    vision.experience_points = 0
    root_task = SimpleNamespace(parent_task_id=None, actual_effort_total=480)
    child_task = SimpleNamespace(
        parent_task_id=UUID("11111111-1111-1111-1111-111111111111"),
        actual_effort_total=999,
    )

    evolved = vision.sync_experience_with_actual_effort(
        experience_rate_per_hour=60,
        tasks=[cast(Any, root_task), cast(Any, child_task)],
    )

    assert evolved is True
    assert vision.experience_points == 480
    assert vision.stage == 3

    vision.add_experience(7680)
    assert vision.can_harvest() is True

    vision.harvest()
    assert vision.status == "fruit"


def test_sync_vision_experience_uses_root_task_effort(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vision = Vision(name="Launch lifeos-cli", status="active")
    vision.id = UUID("44444444-4444-4444-4444-444444444444")
    vision.stage = 0
    vision.experience_points = 0
    vision.experience_rate_per_hour = None
    session = SimpleNamespace(flush=AsyncMock(), refresh=AsyncMock(), commit=AsyncMock())
    root_task = SimpleNamespace(parent_task_id=None, actual_effort_total=240)

    async def fake_get_vision(
        _: object,
        *,
        vision_id: UUID,
        include_deleted: bool = False,
    ) -> Vision:
        assert vision_id == UUID("44444444-4444-4444-4444-444444444444")
        assert include_deleted is False
        return vision

    async def fake_load_tasks(_: object, vision_id: UUID) -> list[object]:
        assert vision_id == vision.id
        return [root_task]

    monkeypatch.setattr(visions, "get_vision", fake_get_vision)
    monkeypatch.setattr(visions, "_load_active_tasks_for_vision", fake_load_tasks)
    monkeypatch.setattr(
        visions, "load_people_for_entities", AsyncMock(return_value={vision.id: []})
    )

    synced = asyncio.run(
        visions.sync_vision_experience(
            cast(Any, session),
            vision_id=UUID("44444444-4444-4444-4444-444444444444"),
        )
    )

    assert synced.experience_rate_per_hour == 60
    assert synced.experience_points == 240
    assert synced.stage == 2
    session.flush.assert_awaited_once()
    session.commit.assert_not_called()


def test_get_vision_stats_summarizes_tasks(monkeypatch: pytest.MonkeyPatch) -> None:
    vision = Vision(name="Launch lifeos-cli", status="active")
    vision.id = UUID("44444444-4444-4444-4444-444444444444")
    tasks: list[object] = [
        SimpleNamespace(
            status="done",
            estimated_effort=30,
            actual_effort_total=45,
            parent_task_id=None,
        ),
        SimpleNamespace(
            status="in_progress",
            estimated_effort=60,
            actual_effort_total=20,
            parent_task_id=UUID("11111111-1111-1111-1111-111111111111"),
        ),
        SimpleNamespace(
            status="todo",
            estimated_effort=None,
            actual_effort_total=10,
            parent_task_id=None,
        ),
    ]

    async def fake_get_vision(
        _: object,
        *,
        vision_id: UUID,
        include_deleted: bool = False,
    ) -> Vision:
        assert vision_id == vision.id
        assert include_deleted is False
        return vision

    async def fake_load_tasks(_: object, vision_id: UUID) -> list[object]:
        assert vision_id == vision.id
        return tasks

    monkeypatch.setattr(visions, "get_vision", fake_get_vision)
    monkeypatch.setattr(visions, "_load_active_tasks_for_vision", fake_load_tasks)

    stats = asyncio.run(
        visions.get_vision_stats(
            cast(Any, object()),
            vision_id=vision.id,
        )
    )

    assert stats.total_tasks == 3
    assert stats.completed_tasks == 1
    assert stats.in_progress_tasks == 1
    assert stats.todo_tasks == 1
    assert stats.completion_percentage == pytest.approx(1 / 3)
    assert stats.total_estimated_effort == 90
    assert stats.total_actual_effort == 55


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
