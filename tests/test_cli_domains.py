from __future__ import annotations

from datetime import date, datetime
from typing import cast
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
from lifeos_cli.db.services.batching import BatchRestoreResult
from tests.support import make_record, make_session_scope, utc_datetime


def test_main_area_add_creates_area(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_area(session: object, **kwargs: object) -> object:
        assert kwargs["name"] == "Health"
        return make_record(id=UUID("11111111-1111-1111-1111-111111111111"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(areas, "create_area", fake_create_area)

    exit_code = cli.main(["area", "add", "Health"])
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
        assert kwargs["event_type"] == "appointment"
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


def test_main_event_add_passes_recurrence_fields(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_event(session: object, **kwargs: object) -> object:
        assert kwargs["recurrence_frequency"] == "daily"
        assert kwargs["recurrence_interval"] == 2
        assert kwargs["recurrence_count"] == 5
        return make_record(id=UUID("34343434-3434-3434-3434-343434343434"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(events, "create_event", fake_create_event)

    exit_code = cli.main(
        [
            "event",
            "add",
            "Daily review",
            "--start-time",
            "2026-04-10T09:00:00-04:00",
            "--recurrence-frequency",
            "daily",
            "--recurrence-interval",
            "2",
            "--recurrence-count",
            "5",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created event 34343434-3434-3434-3434-343434343434" in captured.out


def test_main_event_add_passes_monthly_recurrence_frequency(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_event(session: object, **kwargs: object) -> object:
        assert kwargs["recurrence_frequency"] == "monthly"
        return make_record(id=UUID("56565656-5656-5656-5656-565656565656"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(events, "create_event", fake_create_event)

    exit_code = cli.main(
        [
            "event",
            "add",
            "Monthly review",
            "--start-time",
            "2026-04-30T16:00:00-04:00",
            "--recurrence-frequency",
            "monthly",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created event 56565656-5656-5656-5656-565656565656" in captured.out


def test_main_event_add_passes_event_type(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_event(session: object, **kwargs: object) -> object:
        assert kwargs["event_type"] == "timeblock"
        return make_record(id=UUID("45454545-4545-4545-4545-454545454545"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(events, "create_event", fake_create_event)

    exit_code = cli.main(
        [
            "event",
            "add",
            "Focus Work",
            "--type",
            "timeblock",
            "--start-time",
            "2026-04-10T09:00:00-04:00",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created event 45454545-4545-4545-4545-454545454545" in captured.out


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


def test_main_timelog_list_passes_search_filters(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_list_timelogs(session: object, **kwargs: object) -> list[object]:
        assert kwargs["query"] == "deep work"
        assert kwargs["notes_contains"] == "focused"
        assert kwargs["area_name"] == "Work"
        assert kwargs["without_area"] is False
        assert kwargs["without_task"] is True
        return [
            make_record(
                id=UUID("13131313-1313-1313-1313-131313131313"),
                deleted_at=None,
                tracking_method="manual",
                start_time=utc_datetime(2026, 4, 10, 13, 0),
                end_time=utc_datetime(2026, 4, 10, 14, 0),
                task_id=None,
                linked_notes_count=0,
                title="Deep work",
            )
        ]

    async def fake_count_timelogs(session: object, **kwargs: object) -> int:
        assert kwargs["query"] == "deep work"
        assert kwargs["notes_contains"] == "focused"
        assert kwargs["area_name"] == "Work"
        assert kwargs["without_area"] is False
        assert kwargs["without_task"] is True
        return 1

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(timelogs, "list_timelogs", fake_list_timelogs)
    monkeypatch.setattr(timelogs, "count_timelogs", fake_count_timelogs)

    exit_code = cli.main(
        [
            "timelog",
            "list",
            "--query",
            "deep work",
            "--notes-contains",
            "focused",
            "--area-name",
            "Work",
            "--without-task",
            "--count",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Deep work" in captured.out
    assert "Total timelogs: 1" in captured.out


def test_main_timelog_batch_update_passes_relation_and_title_updates(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_batch_update_timelogs(session: object, **kwargs: object) -> object:
        assert kwargs["timelog_ids"] == [
            UUID("13131313-1313-1313-1313-131313131313"),
            UUID("14141414-1414-1414-1414-141414141414"),
        ]
        assert kwargs["find_title_text"] == "deep"
        assert kwargs["replace_title_text"] == "focused"
        assert kwargs["clear_task"] is True
        assert kwargs["person_ids"] == [UUID("33333333-3333-3333-3333-333333333333")]
        return timelogs.TimelogBatchUpdateResult(
            updated_count=2,
            unchanged_ids=(),
            failed_ids=(),
            errors=(),
        )

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(timelogs, "batch_update_timelogs", fake_batch_update_timelogs)

    exit_code = cli.main(
        [
            "timelog",
            "batch",
            "update",
            "--ids",
            "13131313-1313-1313-1313-131313131313",
            "14141414-1414-1414-1414-141414141414",
            "--find-title-text",
            "deep",
            "--replace-title-text",
            "focused",
            "--clear-task",
            "--person-id",
            "33333333-3333-3333-3333-333333333333",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Updated timelogs: 2" in captured.out


def test_main_timelog_restore_calls_service(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_restore_timelog(session: object, **kwargs: object) -> object:
        assert kwargs["timelog_id"] == UUID("13131313-1313-1313-1313-131313131313")
        return make_record(id=UUID("13131313-1313-1313-1313-131313131313"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(timelogs, "restore_timelog", fake_restore_timelog)

    exit_code = cli.main(["timelog", "restore", "13131313-1313-1313-1313-131313131313"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Restored timelog 13131313-1313-1313-1313-131313131313" in captured.out


def test_main_timelog_batch_restore_reports_failed_ids(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    missing_id = UUID("14141414-1414-1414-1414-141414141414")

    async def fake_batch_restore_timelogs(session: object, **kwargs: object) -> object:
        assert kwargs["timelog_ids"] == [
            UUID("13131313-1313-1313-1313-131313131313"),
            missing_id,
        ]
        return BatchRestoreResult(
            restored_count=1,
            failed_ids=(missing_id,),
            errors=(f"Timelog {missing_id} was not found",),
        )

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(timelogs, "batch_restore_timelogs", fake_batch_restore_timelogs)

    exit_code = cli.main(
        [
            "timelog",
            "batch",
            "restore",
            "--ids",
            "13131313-1313-1313-1313-131313131313",
            "14141414-1414-1414-1414-141414141414",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Restored timelogs: 1" in captured.out
    assert "Failed timelog IDs" in captured.err
    assert f"Error: Timelog {missing_id} was not found" in captured.err


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


def test_main_event_update_passes_scope_fields(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_update_event(session: object, **kwargs: object) -> object:
        assert kwargs["scope"] == "single"
        assert kwargs["event_type"] == "deadline"
        instance_start = cast(datetime, kwargs["instance_start"])
        assert instance_start is not None
        assert str(instance_start.isoformat()) == "2026-04-10T09:00:00-04:00"
        return make_record(id=UUID("56565656-5656-5656-5656-565656565656"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(events, "update_event", fake_update_event)

    exit_code = cli.main(
        [
            "event",
            "update",
            "56565656-5656-5656-5656-565656565656",
            "--scope",
            "single",
            "--instance-start",
            "2026-04-10T09:00:00-04:00",
            "--type",
            "deadline",
            "--title",
            "Updated review",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Updated event 56565656-5656-5656-5656-565656565656" in captured.out


def test_main_event_delete_passes_scope_fields(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_delete_event(session: object, **kwargs: object) -> None:
        assert kwargs["scope"] == "all_future"
        instance_start = cast(datetime, kwargs["instance_start"])
        assert instance_start is not None
        assert str(instance_start.isoformat()) == "2026-04-10T09:00:00-04:00"

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(events, "delete_event", fake_delete_event)

    exit_code = cli.main(
        [
            "event",
            "delete",
            "56565656-5656-5656-5656-565656565656",
            "--scope",
            "all_future",
            "--instance-start",
            "2026-04-10T09:00:00-04:00",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Soft-deleted event 56565656-5656-5656-5656-565656565656" in captured.out


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


def test_main_vision_experience_commands_call_services(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    calls: list[str] = []

    async def fake_add_experience(session: object, **kwargs: object) -> object:
        calls.append("add")
        assert kwargs["vision_id"] == UUID("44444444-4444-4444-4444-444444444444")
        assert kwargs["experience_points"] == 120
        return make_record(id=UUID("44444444-4444-4444-4444-444444444444"))

    async def fake_sync_experience(session: object, **kwargs: object) -> object:
        calls.append("sync")
        assert kwargs["vision_id"] == UUID("44444444-4444-4444-4444-444444444444")
        return make_record(id=UUID("44444444-4444-4444-4444-444444444444"))

    async def fake_harvest(session: object, **kwargs: object) -> object:
        calls.append("harvest")
        assert kwargs["vision_id"] == UUID("44444444-4444-4444-4444-444444444444")
        return make_record(id=UUID("44444444-4444-4444-4444-444444444444"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(visions, "add_experience_to_vision", fake_add_experience)
    monkeypatch.setattr(visions, "sync_vision_experience", fake_sync_experience)
    monkeypatch.setattr(visions, "harvest_vision", fake_harvest)

    add_exit_code = cli.main(
        [
            "vision",
            "add-experience",
            "44444444-4444-4444-4444-444444444444",
            "--points",
            "120",
        ]
    )
    sync_exit_code = cli.main(["vision", "sync-experience", "44444444-4444-4444-4444-444444444444"])
    harvest_exit_code = cli.main(["vision", "harvest", "44444444-4444-4444-4444-444444444444"])
    captured = capsys.readouterr()

    assert add_exit_code == 0
    assert sync_exit_code == 0
    assert harvest_exit_code == 0
    assert calls == ["add", "sync", "harvest"]
    assert "Updated vision 44444444-4444-4444-4444-444444444444" in captured.out
    assert "Synced vision 44444444-4444-4444-4444-444444444444" in captured.out
    assert "Harvested vision 44444444-4444-4444-4444-444444444444" in captured.out


def test_main_vision_read_model_commands_print_results(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_get_with_tasks(session: object, **kwargs: object) -> object:
        assert kwargs["vision_id"] == UUID("44444444-4444-4444-4444-444444444444")
        return make_record(
            id=UUID("44444444-4444-4444-4444-444444444444"),
            name="Launch lifeos-cli",
            description=None,
            status="active",
            stage=0,
            experience_points=0,
            experience_rate_per_hour=60,
            area_id=None,
            people=[],
            tasks=[
                make_record(
                    id=UUID("55555555-5555-5555-5555-555555555555"),
                    status="done",
                    parent_task_id=None,
                    content="Draft release checklist",
                )
            ],
            created_at=None,
            updated_at=None,
            deleted_at=None,
        )

    async def fake_get_stats(session: object, **kwargs: object) -> object:
        assert kwargs["vision_id"] == UUID("44444444-4444-4444-4444-444444444444")
        return visions.VisionStats(
            total_tasks=1,
            completed_tasks=1,
            in_progress_tasks=0,
            todo_tasks=0,
            completion_percentage=1.0,
            total_estimated_effort=30,
            total_actual_effort=45,
        )

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(visions, "get_vision_with_tasks", fake_get_with_tasks)
    monkeypatch.setattr(visions, "get_vision_stats", fake_get_stats)

    with_tasks_exit_code = cli.main(
        ["vision", "with-tasks", "44444444-4444-4444-4444-444444444444"]
    )
    stats_exit_code = cli.main(["vision", "stats", "44444444-4444-4444-4444-444444444444"])
    captured = capsys.readouterr()

    assert with_tasks_exit_code == 0
    assert stats_exit_code == 0
    assert "tasks:" in captured.out
    assert "Draft release checklist" in captured.out
    assert "total_tasks: 1" in captured.out
    assert "completion_percentage: 1.00" in captured.out


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


def test_main_task_read_model_commands_print_results(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    root_task = make_record(
        id=UUID("55555555-5555-5555-5555-555555555555"),
        status="todo",
        content="Root task",
        completion_percentage=0.5,
        depth=0,
        subtasks=(
            make_record(
                id=UUID("66666666-6666-6666-6666-666666666666"),
                status="done",
                content="Child task",
                completion_percentage=1.0,
                depth=1,
                subtasks=(),
            ),
        ),
    )

    async def fake_get_task_with_subtasks(session: object, **kwargs: object) -> object:
        assert kwargs["task_id"] == UUID("55555555-5555-5555-5555-555555555555")
        return root_task

    async def fake_get_hierarchy(session: object, **kwargs: object) -> object:
        assert kwargs["vision_id"] == UUID("44444444-4444-4444-4444-444444444444")
        return make_record(
            vision_id=UUID("44444444-4444-4444-4444-444444444444"),
            root_tasks=(root_task,),
        )

    async def fake_get_stats(session: object, **kwargs: object) -> object:
        assert kwargs["task_id"] == UUID("55555555-5555-5555-5555-555555555555")
        return tasks.TaskStats(
            total_subtasks=1,
            completed_subtasks=1,
            completion_percentage=0.5,
            total_estimated_effort=90,
            total_actual_effort=60,
        )

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(tasks, "get_task_with_subtasks", fake_get_task_with_subtasks)
    monkeypatch.setattr(tasks, "get_vision_task_hierarchy", fake_get_hierarchy)
    monkeypatch.setattr(tasks, "get_task_stats", fake_get_stats)

    with_subtasks_exit_code = cli.main(
        ["task", "with-subtasks", "55555555-5555-5555-5555-555555555555"]
    )
    hierarchy_exit_code = cli.main(["task", "hierarchy", "44444444-4444-4444-4444-444444444444"])
    stats_exit_code = cli.main(["task", "stats", "55555555-5555-5555-5555-555555555555"])
    captured = capsys.readouterr()

    assert with_subtasks_exit_code == 0
    assert hierarchy_exit_code == 0
    assert stats_exit_code == 0
    assert "Root task" in captured.out
    assert "Child task" in captured.out
    assert "root_tasks:" in captured.out
    assert "total_subtasks: 1" in captured.out
    assert "completion_percentage: 0.50" in captured.out


def test_main_task_list_passes_extended_filters(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_list_tasks(session: object, **kwargs: object) -> list[object]:
        assert kwargs["vision_in"] == "44444444-4444-4444-4444-444444444444"
        assert kwargs["status_in"] == "todo,in_progress"
        assert kwargs["exclude_status"] == "cancelled"
        assert kwargs["planning_cycle_type"] == "week"
        assert kwargs["planning_cycle_start_date"] == date(2026, 4, 10)
        assert kwargs["content"] == "Draft release checklist"
        return []

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(tasks, "list_tasks", fake_list_tasks)

    exit_code = cli.main(
        [
            "task",
            "list",
            "--vision-in",
            "44444444-4444-4444-4444-444444444444",
            "--status-in",
            "todo,in_progress",
            "--exclude-status",
            "cancelled",
            "--planning-cycle-type",
            "week",
            "--planning-cycle-start-date",
            "2026-04-10",
            "--content",
            "Draft release checklist",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "No tasks found." in captured.out


def test_main_task_move_and_reorder_call_services(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_move_task(session: object, **kwargs: object) -> object:
        assert kwargs["task_id"] == UUID("55555555-5555-5555-5555-555555555555")
        assert kwargs["old_parent_task_id"] == UUID("66666666-6666-6666-6666-666666666666")
        assert kwargs["new_parent_task_id"] == UUID("77777777-7777-7777-7777-777777777777")
        assert kwargs["new_vision_id"] == UUID("88888888-8888-8888-8888-888888888888")
        assert kwargs["new_display_order"] == 3
        return make_record(
            task=make_record(id=UUID("55555555-5555-5555-5555-555555555555")),
            updated_descendants=(),
        )

    async def fake_reorder_tasks(session: object, **kwargs: object) -> None:
        assert kwargs["task_orders"] == [
            (UUID("55555555-5555-5555-5555-555555555555"), 0),
            (UUID("66666666-6666-6666-6666-666666666666"), 1),
        ]

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(tasks, "move_task", fake_move_task)
    monkeypatch.setattr(tasks, "reorder_tasks", fake_reorder_tasks)

    move_exit_code = cli.main(
        [
            "task",
            "move",
            "55555555-5555-5555-5555-555555555555",
            "--old-parent-task-id",
            "66666666-6666-6666-6666-666666666666",
            "--new-parent-task-id",
            "77777777-7777-7777-7777-777777777777",
            "--new-vision-id",
            "88888888-8888-8888-8888-888888888888",
            "--new-display-order",
            "3",
        ]
    )
    reorder_exit_code = cli.main(
        [
            "task",
            "reorder",
            "--order",
            "55555555-5555-5555-5555-555555555555:0",
            "--order",
            "66666666-6666-6666-6666-666666666666:1",
        ]
    )
    captured = capsys.readouterr()

    assert move_exit_code == 0
    assert reorder_exit_code == 0
    assert "Moved task 55555555-5555-5555-5555-555555555555" in captured.out
    assert "Reordered tasks: 2" in captured.out


def test_main_task_move_preserves_parent_when_parent_flag_is_omitted(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_move_task(session: object, **kwargs: object) -> object:
        assert kwargs["task_id"] == UUID("55555555-5555-5555-5555-555555555555")
        assert "new_parent_task_id" not in kwargs
        assert kwargs["new_display_order"] == 4
        return make_record(
            task=make_record(id=UUID("55555555-5555-5555-5555-555555555555")),
            updated_descendants=(),
        )

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(tasks, "move_task", fake_move_task)

    exit_code = cli.main(
        [
            "task",
            "move",
            "55555555-5555-5555-5555-555555555555",
            "--new-display-order",
            "4",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Moved task 55555555-5555-5555-5555-555555555555" in captured.out


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
        assert kwargs["cadence_frequency"] == "daily"
        assert kwargs["cadence_weekdays"] is None
        assert kwargs["target_per_cycle"] is None
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


def test_main_habit_add_passes_weekly_cadence_fields(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_habit(session: object, **kwargs: object) -> object:
        assert kwargs["cadence_frequency"] == "weekly"
        assert kwargs["cadence_weekdays"] == ["saturday", "sunday"]
        assert kwargs["target_per_cycle"] == 1
        return make_record(id=UUID("78787878-7878-7878-7878-787878787878"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(habits, "create_habit", fake_create_habit)

    exit_code = cli.main(
        [
            "habit",
            "add",
            "Call Parents",
            "--start-date",
            "2026-04-09",
            "--duration-days",
            "100",
            "--cadence-frequency",
            "weekly",
            "--weekends-only",
            "--target-per-week",
            "1",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created habit 78787878-7878-7878-7878-787878787878" in captured.out


def test_main_habit_add_passes_monthly_cadence_fields(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_create_habit(session: object, **kwargs: object) -> object:
        assert kwargs["cadence_frequency"] == "monthly"
        assert kwargs["cadence_weekdays"] is None
        assert kwargs["target_per_cycle"] == 2
        return make_record(id=UUID("79797979-7979-7979-7979-797979797979"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(habits, "create_habit", fake_create_habit)

    exit_code = cli.main(
        [
            "habit",
            "add",
            "Monthly cleanup",
            "--start-date",
            "2026-04-09",
            "--duration-days",
            "365",
            "--cadence-frequency",
            "monthly",
            "--target-per-cycle",
            "2",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Created habit 79797979-7979-7979-7979-797979797979" in captured.out


def test_main_habit_list_prints_count(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_list_habits(session: object, **kwargs: object) -> list[object]:
        assert kwargs["status"] == "active"
        return [
            make_record(
                id=UUID("77777777-7777-7777-7777-777777777777"),
                deleted_at=None,
                status="active",
                start_date=date(2026, 4, 9),
                duration_days=21,
                task_id=None,
                title="Daily Exercise",
            )
        ]

    async def fake_count_habits(session: object, **kwargs: object) -> int:
        assert kwargs["status"] == "active"
        return 1

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(habits, "list_habits", fake_list_habits)
    monkeypatch.setattr(habits, "count_habits", fake_count_habits)

    exit_code = cli.main(["habit", "list", "--status", "active", "--count"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Daily Exercise" in captured.out
    assert "Total habits: 1" in captured.out


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


def test_main_habit_update_rejects_conflicting_clear_weekdays_flags(
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(
        [
            "habit",
            "update",
            "77777777-7777-7777-7777-777777777777",
            "--weekdays",
            "monday,wednesday,friday",
            "--clear-weekdays",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 1
    assert "Use either --weekdays / --weekends-only or --clear-weekdays, not both." in captured.err


def test_main_habit_action_list_prints_count(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_list_habit_actions(session: object, **kwargs: object) -> list[object]:
        assert kwargs["action_date"] == date(2026, 4, 9)
        return [
            make_record(
                id=UUID("88888888-8888-8888-8888-888888888888"),
                deleted_at=None,
                status="pending",
                action_date=date(2026, 4, 9),
                habit_id=UUID("77777777-7777-7777-7777-777777777777"),
                habit=make_record(title="Daily Exercise"),
            )
        ]

    async def fake_count_habit_actions(session: object, **kwargs: object) -> int:
        assert kwargs["action_date"] == date(2026, 4, 9)
        return 1

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(habit_actions, "list_habit_actions", fake_list_habit_actions)
    monkeypatch.setattr(habit_actions, "count_habit_actions", fake_count_habit_actions)

    exit_code = cli.main(["habit-action", "list", "--action-date", "2026-04-09", "--count"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Daily Exercise" in captured.out
    assert "Total habit actions: 1" in captured.out


def test_main_habit_action_log_updates_by_habit_and_date(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    async def fake_update_habit_action_by_date(session: object, **kwargs: object) -> object:
        assert kwargs["habit_id"] == UUID("77777777-7777-7777-7777-777777777777")
        assert kwargs["action_date"] == date(2026, 4, 9)
        assert kwargs["status"] == "done"
        assert kwargs["notes"] == "Completed"
        assert kwargs["clear_notes"] is False
        return make_record(id=UUID("88888888-8888-8888-8888-888888888888"))

    monkeypatch.setattr(db_session, "session_scope", make_session_scope())
    monkeypatch.setattr(
        habit_actions,
        "update_habit_action_by_date",
        fake_update_habit_action_by_date,
    )

    exit_code = cli.main(
        [
            "habit-action",
            "log",
            "--habit-id",
            "77777777-7777-7777-7777-777777777777",
            "--action-date",
            "2026-04-09",
            "--status",
            "done",
            "--notes",
            "Completed",
        ]
    )
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Updated habit action 88888888-8888-8888-8888-888888888888" in captured.out


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
