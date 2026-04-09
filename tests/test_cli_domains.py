from __future__ import annotations

from uuid import UUID

import pytest

from lifeos_cli import cli
from lifeos_cli.db import session as db_session
from lifeos_cli.db.services import (
    areas,
    events,
    habit_actions,
    habits,
    people,
    tags,
    tasks,
    timelogs,
    visions,
)
from tests.support import make_record, make_session_scope, utc_datetime


def test_main_area_add_creates_area(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_area(session: object, **kwargs: object) -> object:
        assert kwargs["name"] == "Health"
        assert kwargs["person_ids"] == [UUID("11111111-1111-1111-1111-111111111111")]
        return make_record(id=UUID("11111111-1111-1111-1111-111111111111"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(areas, "create_area", fake_create_area)

    exit_code = cli.main(
        [
            "area",
            "add",
            "Health",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created area 11111111-1111-1111-1111-111111111111" in captured.out


def test_main_area_update_rejects_conflicting_clear_icon_flags(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(
        [
            "area",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--icon",
            "brain",
            "--clear-icon",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Use either --icon or --clear-icon, not both." in captured.err


def test_main_event_add_creates_event(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_event(session: object, **kwargs: object) -> object:
        assert kwargs["title"] == "Doctor appointment"
        assert kwargs["person_ids"] == [UUID("11111111-1111-1111-1111-111111111111")]
        return make_record(id=UUID("12121212-1212-1212-1212-121212121212"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(events, "create_event", fake_create_event)

    exit_code = cli.main(
        [
            "event",
            "add",
            "Doctor appointment",
            "--start-time",
            "2026-04-10T09:00:00-04:00",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created event 12121212-1212-1212-1212-121212121212" in captured.out


def test_main_tag_add_creates_tag(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_tag(session: object, **kwargs: object) -> object:
        assert kwargs["name"] == "family"
        assert kwargs["entity_type"] == "person"
        return make_record(id=UUID("22222222-2222-2222-2222-222222222222"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(tags, "create_tag", fake_create_tag)

    exit_code = cli.main(["tag", "add", "family", "--entity-type", "person"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created tag 22222222-2222-2222-2222-222222222222" in captured.out


def test_main_tag_update_can_clear_people(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_update_tag(session: object, **kwargs: object) -> object:
        assert kwargs["clear_people"] is True
        assert kwargs["person_ids"] is None
        return make_record(id=UUID("22222222-2222-2222-2222-222222222222"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(tags, "update_tag", fake_update_tag)

    exit_code = cli.main(
        [
            "tag",
            "update",
            "22222222-2222-2222-2222-222222222222",
            "--clear-people",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Updated tag 22222222-2222-2222-2222-222222222222" in captured.out


def test_main_timelog_add_creates_timelog(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_timelog(session: object, **kwargs: object) -> object:
        assert kwargs["title"] == "Deep work"
        assert kwargs["tracking_method"] == "manual"
        return make_record(id=UUID("13131313-1313-1313-1313-131313131313"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(timelogs, "create_timelog", fake_create_timelog)

    exit_code = cli.main(
        [
            "timelog",
            "add",
            "Deep work",
            "--start-time",
            "2026-04-10T13:00:00-04:00",
            "--end-time",
            "2026-04-10T14:30:00-04:00",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created timelog 13131313-1313-1313-1313-131313131313" in captured.out


def test_main_people_show_prints_tags(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_get_person(
        session: object,
        *,
        person_id: UUID,
        include_deleted: bool,
    ) -> object:
        return make_record(
            id=person_id,
            name="Alice",
            description="Friend",
            nicknames=["ally"],
            birth_date=None,
            location="Toronto",
            tags=[make_record(name="family"), make_record(name="friend")],
            created_at=utc_datetime(2026, 4, 9),
            updated_at=utc_datetime(2026, 4, 9),
            deleted_at=None,
        )

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(people, "get_person", fake_get_person)

    exit_code = cli.main(["people", "show", "33333333-3333-3333-3333-333333333333"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "name: Alice" in captured.out
    assert "tags: family, friend" in captured.out


def test_main_event_update_rejects_conflicting_clear_area_flags(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(
        [
            "event",
            "update",
            "12121212-1212-1212-1212-121212121212",
            "--area-id",
            "11111111-1111-1111-1111-111111111111",
            "--clear-area",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Use either --area-id or --clear-area, not both." in captured.err


def test_main_people_update_can_clear_location(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_update_person(session: object, **kwargs: object) -> object:
        assert kwargs["clear_location"] is True
        assert kwargs["location"] is None
        return make_record(id=UUID("33333333-3333-3333-3333-333333333333"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(people, "update_person", fake_update_person)

    exit_code = cli.main(
        [
            "people",
            "update",
            "33333333-3333-3333-3333-333333333333",
            "--clear-location",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Updated person 33333333-3333-3333-3333-333333333333" in captured.out


def test_main_vision_add_creates_vision(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_vision(session: object, **kwargs: object) -> object:
        assert kwargs["name"] == "Launch lifeos-cli"
        assert kwargs["person_ids"] == [UUID("11111111-1111-1111-1111-111111111111")]
        return make_record(id=UUID("44444444-4444-4444-4444-444444444444"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(visions, "create_vision", fake_create_vision)

    exit_code = cli.main(
        [
            "vision",
            "add",
            "Launch lifeos-cli",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created vision 44444444-4444-4444-4444-444444444444" in captured.out


def test_main_vision_update_rejects_conflicting_clear_area_flags(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(
        [
            "vision",
            "update",
            "44444444-4444-4444-4444-444444444444",
            "--area-id",
            "11111111-1111-1111-1111-111111111111",
            "--clear-area",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Use either --area-id or --clear-area, not both." in captured.err


def test_main_task_add_creates_task(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_task(session: object, **kwargs: object) -> object:
        assert kwargs["content"] == "Draft release checklist"
        assert kwargs["priority"] == 2
        assert kwargs["person_ids"] == [UUID("11111111-1111-1111-1111-111111111111")]
        return make_record(id=UUID("55555555-5555-5555-5555-555555555555"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(tasks, "create_task", fake_create_task)

    exit_code = cli.main(
        [
            "task",
            "add",
            "Draft release checklist",
            "--vision-id",
            "66666666-6666-6666-6666-666666666666",
            "--priority",
            "2",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created task 55555555-5555-5555-5555-555555555555" in captured.out


def test_main_task_batch_delete_prints_summary(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_batch_delete_tasks(
        session: object,
        *,
        task_ids: list[UUID],
    ) -> object:
        assert task_ids == [
            UUID("11111111-1111-1111-1111-111111111111"),
            UUID("22222222-2222-2222-2222-222222222222"),
        ]
        return make_record(
            deleted_count=2,
            failed_ids=(),
            errors=(),
        )

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(tasks, "batch_delete_tasks", fake_batch_delete_tasks)

    exit_code = cli.main(
        [
            "task",
            "batch",
            "delete",
            "--ids",
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Deleted tasks: 2" in captured.out


def test_main_task_update_can_clear_parent(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_update_task(session: object, **kwargs: object) -> object:
        assert kwargs["clear_parent"] is True
        assert kwargs["parent_task_id"] is None
        return make_record(id=UUID("55555555-5555-5555-5555-555555555555"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(tasks, "update_task", fake_update_task)

    exit_code = cli.main(
        [
            "task",
            "update",
            "55555555-5555-5555-5555-555555555555",
            "--clear-parent",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Updated task 55555555-5555-5555-5555-555555555555" in captured.out


def test_main_task_update_can_clear_people(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_update_task(session: object, **kwargs: object) -> object:
        assert kwargs["clear_people"] is True
        assert kwargs["person_ids"] is None
        return make_record(id=UUID("55555555-5555-5555-5555-555555555555"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(tasks, "update_task", fake_update_task)

    exit_code = cli.main(
        [
            "task",
            "update",
            "55555555-5555-5555-5555-555555555555",
            "--clear-people",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Updated task 55555555-5555-5555-5555-555555555555" in captured.out


def test_main_task_update_rejects_conflicting_clear_planning_cycle_flags(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(
        [
            "task",
            "update",
            "55555555-5555-5555-5555-555555555555",
            "--planning-cycle-type",
            "week",
            "--clear-planning-cycle",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Use either planning cycle fields or --clear-planning-cycle, not both." in captured.err


def test_main_task_update_rejects_conflicting_parent_flags(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(
        [
            "task",
            "update",
            "55555555-5555-5555-5555-555555555555",
            "--parent-task-id",
            "66666666-6666-6666-6666-666666666666",
            "--clear-parent",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Use either --parent-task-id or --clear-parent, not both." in captured.err


def test_main_timelog_update_rejects_conflicting_clear_notes_flags(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(
        [
            "timelog",
            "update",
            "13131313-1313-1313-1313-131313131313",
            "--notes",
            "done",
            "--clear-notes",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Use either --notes or --clear-notes, not both." in captured.err


def test_main_people_batch_delete_reports_missing_ids(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_batch_delete_people(
        session: object,
        *,
        person_ids: list[UUID],
    ) -> object:
        assert person_ids == [UUID("33333333-3333-3333-3333-333333333333")]
        return make_record(
            deleted_count=0,
            failed_ids=(UUID("33333333-3333-3333-3333-333333333333"),),
            errors=("Person 33333333-3333-3333-3333-333333333333 was not found",),
        )

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(people, "batch_delete_people", fake_batch_delete_people)

    exit_code = cli.main(
        [
            "people",
            "batch",
            "delete",
            "--ids",
            "33333333-3333-3333-3333-333333333333",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Deleted people: 0" in captured.out
    assert "Failed person IDs" in captured.err


def test_main_habit_add_creates_habit(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_habit(session: object, **kwargs: object) -> object:
        assert kwargs["title"] == "Daily Exercise"
        assert str(kwargs["start_date"]) == "2026-04-09"
        assert kwargs["duration_days"] == 21
        return make_record(id=UUID("77777777-7777-7777-7777-777777777777"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(habits, "create_habit", fake_create_habit)

    exit_code = cli.main(
        [
            "habit",
            "add",
            "Daily Exercise",
            "--start-date",
            "2026-04-09",
            "--duration-days",
            "21",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created habit 77777777-7777-7777-7777-777777777777" in captured.out


def test_main_habit_update_rejects_conflicting_clear_task_flags(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(
        [
            "habit",
            "update",
            "77777777-7777-7777-7777-777777777777",
            "--task-id",
            "11111111-1111-1111-1111-111111111111",
            "--clear-task",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Use either --task-id or --clear-task, not both." in captured.err


def test_main_habit_action_update_can_clear_notes(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_update_habit_action(session: object, **kwargs: object) -> object:
        assert kwargs["clear_notes"] is True
        assert kwargs["notes"] is None
        return make_record(id=UUID("88888888-8888-8888-8888-888888888888"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(habit_actions, "update_habit_action", fake_update_habit_action)

    exit_code = cli.main(
        [
            "habit-action",
            "update",
            "88888888-8888-8888-8888-888888888888",
            "--clear-notes",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Updated habit action 88888888-8888-8888-8888-888888888888" in captured.out
