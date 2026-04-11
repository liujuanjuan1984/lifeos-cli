from __future__ import annotations

from datetime import date
from uuid import UUID

import pytest

from lifeos_cli import cli
from lifeos_cli.cli import build_parser


def test_cli_parser_uses_lifeos_command_name() -> None:
    parser = build_parser()

    assert parser.prog == "lifeos"


def test_cli_parser_supports_note_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["note", "add", "a new note"])

    assert args.resource == "note"
    assert args.note_command == "add"
    assert args.content == "a new note"


def test_cli_parser_supports_note_add_from_stdin() -> None:
    parser = build_parser()
    args = parser.parse_args(["note", "add", "--stdin"])

    assert args.resource == "note"
    assert args.note_command == "add"
    assert args.stdin is True
    assert args.content is None


def test_cli_parser_supports_note_show_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["note", "show", "11111111-1111-1111-1111-111111111111"])

    assert args.resource == "note"
    assert args.note_command == "show"
    assert str(args.note_id) == "11111111-1111-1111-1111-111111111111"


def test_cli_parser_supports_init_preference_flags() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "init",
            "--database-url",
            "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos",
            "--timezone",
            "America/Toronto",
            "--language",
            "zh-Hans",
            "--day-starts-at",
            "04:00",
            "--week-starts-on",
            "sunday",
            "--vision-experience-rate-per-hour",
            "120",
        ]
    )

    assert args.database_url == "postgresql+psycopg://db-user:<db-password>@localhost:5432/lifeos"
    assert args.timezone == "America/Toronto"
    assert args.language == "zh-Hans"
    assert args.day_starts_at == "04:00"
    assert args.week_starts_on == "sunday"
    assert args.vision_experience_rate_per_hour == 120


def test_cli_parser_supports_config_set_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["config", "set", "preferences.timezone", "America/Toronto"])

    assert args.resource == "config"
    assert args.config_command == "set"
    assert args.key == "preferences.timezone"
    assert args.value == "America/Toronto"


def test_cli_parser_supports_note_search_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["note", "search", "meeting notes", "--limit", "20"])

    assert args.resource == "note"
    assert args.note_command == "search"
    assert args.query == "meeting notes"
    assert args.limit == 20


def test_cli_parser_supports_note_batch_update_content_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "note",
            "batch",
            "update-content",
            "--ids",
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222",
            "--find-text",
            "draft",
            "--replace-text",
            "final",
        ]
    )

    assert args.resource == "note"
    assert args.note_command == "batch"
    assert args.note_batch_command == "update-content"
    assert args.find_text == "draft"
    assert args.replace_text == "final"
    assert len(args.note_ids) == 2


def test_cli_top_level_help_describes_command_grammar(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["--help"])

    captured = capsys.readouterr()

    assert "lifeos <resource> <action> [arguments] [options]" in captured.out
    assert "resources:" in captured.out
    assert "init" in captured.out
    assert "Initialize local configuration" in captured.out
    assert "lifeos config set preferences.timezone America/Toronto" in captured.out
    assert "data" in captured.out
    assert "Run unified data import/export and batch commands" in captured.out
    assert "event" in captured.out
    assert "Manage planned schedule events" in captured.out
    assert "schedule" in captured.out
    assert "Inspect aggregated schedule views" in captured.out
    assert "people" in captured.out
    assert "Manage people and relationships" in captured.out
    assert "habit-action" in captured.out
    assert "Manage dated habit actions" in captured.out
    assert "timelog" in captured.out
    assert "Manage actual time records" in captured.out
    assert "primary command reference" in captured.out
    assert "When automation acts on behalf of a human" in captured.out
    assert "human-only work, agent-only work, and truly shared work" in captured.out
    assert 'lifeos note add "Capture an idea"' in captured.out


def test_cli_schedule_help_describes_read_model_and_occurrences(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["schedule", "--help"])

    captured = capsys.readouterr()

    assert (
        "Schedule is a CLI read model built from tasks, habit actions, and events" in captured.out
    )
    assert "expanded recurring event occurrences" in captured.out
    assert "Dates use the configured timezone and `day_starts_at` preference." in captured.out
    assert (
        "Event output is segmented into appointment, timeblock, and deadline sections."
        in captured.out
    )


def test_cli_config_help_describes_set_command(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["config", "--help"])

    captured = capsys.readouterr()

    assert "show" in captured.out
    assert "set" in captured.out
    assert "Environment variables still override config-file values at runtime." in captured.out


def test_cli_data_help_describes_snapshot_and_bundle_model(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["data", "--help"])

    captured = capsys.readouterr()

    assert "canonical JSON/JSONL snapshot rows" in captured.out
    assert "bundle backup or restore" in captured.out
    assert "data export all --output lifeos-bundle.zip" in captured.out
    assert "data import bundle --file lifeos-bundle.zip --replace-existing" in captured.out


def test_cli_data_import_help_describes_atomic_bundle_restore(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["data", "import", "--help"])

    captured = capsys.readouterr()

    assert "Bundle restore is atomic" in captured.out
    assert (
        "Single-resource imports expect referenced foreign rows to already exist." in captured.out
    )


def test_cli_timelog_stats_help_describes_persisted_area_stats(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["timelog", "stats", "--help"])

    captured = capsys.readouterr()

    assert "persisted stats when available" in captured.out
    assert "Stats are grouped only by area" in captured.out
    assert "timelog stats rebuild" in captured.out


def test_cli_parser_supports_data_commands() -> None:
    parser = build_parser()

    export_args = parser.parse_args(["data", "export", "timelog", "--format", "jsonl"])
    bundle_args = parser.parse_args(["data", "import", "bundle", "--file", "backup.zip"])
    batch_update_args = parser.parse_args(
        ["data", "batch-update", "task", "--file", "task-patch.jsonl"]
    )
    batch_delete_args = parser.parse_args(
        ["data", "batch-delete", "event", "--id", "11111111-1111-1111-1111-111111111111"]
    )

    assert export_args.resource == "data"
    assert export_args.data_command == "export"
    assert export_args.target == "timelog"
    assert export_args.format == "jsonl"
    assert bundle_args.data_command == "import"
    assert bundle_args.target == "bundle"
    assert batch_update_args.data_command == "batch-update"
    assert batch_update_args.target == "task"
    assert batch_delete_args.data_command == "batch-delete"
    assert batch_delete_args.target == "event"


def test_cli_people_help_describes_human_and_agent_subject_modeling(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["people", "--help"])

    captured = capsys.readouterr()

    assert "human partner and, when useful, a named automation identity" in captured.out
    assert "separate records when both can own work" in captured.out


def test_cli_parser_supports_timelog_stats_commands() -> None:
    parser = build_parser()

    day_args = parser.parse_args(["timelog", "stats", "day", "--date", "2026-04-10"])
    month_args = parser.parse_args(["timelog", "stats", "month", "--month", "2026-04"])
    rebuild_args = parser.parse_args(["timelog", "stats", "rebuild", "--all"])

    assert day_args.resource == "timelog"
    assert day_args.timelog_command == "stats"
    assert day_args.timelog_stats_command == "day"
    assert day_args.target_date == date(2026, 4, 10)
    assert month_args.timelog_stats_command == "month"
    assert month_args.month == date(2026, 4, 1)
    assert rebuild_args.timelog_stats_command == "rebuild"
    assert rebuild_args.rebuild_all is True


@pytest.mark.parametrize(
    ("argv", "expected_text"),
    (
        (
            ["task", "add", "--help"],
            "mark whether the task belongs to the human, the agent, or both",
        ),
        (
            ["event", "add", "--help"],
            "distinguish human-only plans from agent-only or shared schedule blocks",
        ),
        (
            ["timelog", "add", "--help"],
            "state whether the effort belongs to the human, the agent, or both",
        ),
    ),
)
def test_cli_action_help_describes_subject_disambiguation(
    argv: list[str],
    expected_text: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(argv)

    captured = capsys.readouterr()

    assert expected_text in captured.out


def test_cli_event_delete_help_describes_recurring_scope_requirements(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["event", "delete", "--help"])

    captured = capsys.readouterr()

    assert "Use `--scope single|all_future|all` for recurring series deletes." in captured.out
    assert "`--scope single` and `--scope all_future` require `--instance-start`." in captured.out
    assert "--scope all_future --instance-start 2026-04-10T09:00:00-04:00" in captured.out


def test_cli_parser_supports_area_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "area",
            "add",
            "Health",
            "--display-order",
            "2",
        ]
    )

    assert args.resource == "area"
    assert args.area_command == "add"
    assert args.name == "Health"
    assert args.display_order == 2


def test_cli_parser_supports_area_update_clear_icon_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "area",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-icon",
        ]
    )

    assert args.resource == "area"
    assert args.area_command == "update"
    assert args.clear_icon is True


def test_cli_parser_supports_event_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
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

    assert args.resource == "event"
    assert args.event_command == "add"
    assert args.title == "Doctor appointment"
    assert len(args.person_ids) == 1
    assert args.event_type == "appointment"


def test_cli_parser_supports_event_list_by_local_date() -> None:
    parser = build_parser()
    args = parser.parse_args(["event", "list", "--date", "2026-04-10"])

    assert args.resource == "event"
    assert args.event_command == "list"
    assert str(args.local_date) == "2026-04-10"


def test_cli_parser_supports_event_recurrence_add_flags() -> None:
    parser = build_parser()
    args = parser.parse_args(
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

    assert args.resource == "event"
    assert args.event_command == "add"
    assert args.recurrence_frequency == "daily"
    assert args.recurrence_interval == 2
    assert args.recurrence_count == 5


def test_cli_parser_supports_event_type_flags() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "event",
            "list",
            "--type",
            "deadline",
            "--date",
            "2026-04-10",
        ]
    )

    assert args.resource == "event"
    assert args.event_command == "list"
    assert args.event_type == "deadline"


def test_cli_parser_supports_event_update_scope_flags() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "event",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--scope",
            "single",
            "--instance-start",
            "2026-04-10T09:00:00-04:00",
        ]
    )

    assert args.resource == "event"
    assert args.event_command == "update"
    assert args.scope == "single"
    assert args.instance_start.isoformat() == "2026-04-10T09:00:00-04:00"


def test_cli_parser_supports_people_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["people", "add", "Alice", "--nickname", "ally"])

    assert args.resource == "people"
    assert args.people_command == "add"
    assert args.name == "Alice"
    assert args.nickname == ["ally"]


def test_cli_parser_supports_schedule_show_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["schedule", "show", "--date", "2026-04-10"])

    assert args.resource == "schedule"
    assert args.schedule_command == "show"
    assert str(args.target_date) == "2026-04-10"


def test_cli_parser_supports_schedule_list_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        ["schedule", "list", "--start-date", "2026-04-10", "--end-date", "2026-04-16"]
    )

    assert args.resource == "schedule"
    assert args.schedule_command == "list"
    assert str(args.start_date) == "2026-04-10"
    assert str(args.end_date) == "2026-04-16"


def test_cli_parser_supports_people_update_clear_location_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "people",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-location",
        ]
    )

    assert args.resource == "people"
    assert args.people_command == "update"
    assert args.clear_location is True


def test_cli_parser_supports_task_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "add",
            "Draft release checklist",
            "--vision-id",
            "11111111-1111-1111-1111-111111111111",
            "--priority",
            "3",
        ]
    )

    assert args.resource == "task"
    assert args.task_command == "add"
    assert args.content == "Draft release checklist"
    assert str(args.vision_id) == "11111111-1111-1111-1111-111111111111"
    assert args.priority == 3


def test_cli_parser_supports_timelog_list_by_local_date() -> None:
    parser = build_parser()
    args = parser.parse_args(["timelog", "list", "--date", "2026-04-10"])

    assert args.resource == "timelog"
    assert args.timelog_command == "list"
    assert str(args.local_date) == "2026-04-10"


def test_cli_parser_supports_timelog_list_search_filters() -> None:
    parser = build_parser()
    args = parser.parse_args(
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

    assert args.resource == "timelog"
    assert args.timelog_command == "list"
    assert args.query == "deep work"
    assert args.notes_contains == "focused"
    assert args.area_name == "Work"
    assert args.without_task is True
    assert args.count is True


def test_cli_parser_supports_task_list_person_filter() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "list",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
        ]
    )

    assert args.resource == "task"
    assert args.task_command == "list"
    assert str(args.person_id) == "11111111-1111-1111-1111-111111111111"


def test_cli_parser_supports_task_list_extended_filters() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "list",
            "--vision-in",
            "11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222",
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

    assert args.resource == "task"
    assert args.task_command == "list"
    assert args.status_in == "todo,in_progress"
    assert args.exclude_status == "cancelled"
    assert args.planning_cycle_type == "week"
    assert args.planning_cycle_start_date == "2026-04-10"
    assert args.content == "Draft release checklist"


def test_cli_parser_supports_task_read_model_commands() -> None:
    parser = build_parser()

    with_subtasks_args = parser.parse_args(
        ["task", "with-subtasks", "11111111-1111-1111-1111-111111111111"]
    )
    hierarchy_args = parser.parse_args(
        ["task", "hierarchy", "22222222-2222-2222-2222-222222222222"]
    )
    stats_args = parser.parse_args(["task", "stats", "33333333-3333-3333-3333-333333333333"])

    assert with_subtasks_args.resource == "task"
    assert with_subtasks_args.task_command == "with-subtasks"
    assert str(with_subtasks_args.task_id) == "11111111-1111-1111-1111-111111111111"
    assert hierarchy_args.resource == "task"
    assert hierarchy_args.task_command == "hierarchy"
    assert str(hierarchy_args.vision_id) == "22222222-2222-2222-2222-222222222222"
    assert stats_args.resource == "task"
    assert stats_args.task_command == "stats"
    assert str(stats_args.task_id) == "33333333-3333-3333-3333-333333333333"


def test_cli_parser_supports_task_move_and_reorder_commands() -> None:
    parser = build_parser()

    move_args = parser.parse_args(
        [
            "task",
            "move",
            "11111111-1111-1111-1111-111111111111",
            "--old-parent-task-id",
            "22222222-2222-2222-2222-222222222222",
            "--new-parent-task-id",
            "33333333-3333-3333-3333-333333333333",
            "--new-vision-id",
            "44444444-4444-4444-4444-444444444444",
            "--new-display-order",
            "2",
        ]
    )
    reorder_args = parser.parse_args(
        [
            "task",
            "reorder",
            "--order",
            "11111111-1111-1111-1111-111111111111:0",
            "--order",
            "22222222-2222-2222-2222-222222222222:1",
        ]
    )

    assert move_args.resource == "task"
    assert move_args.task_command == "move"
    assert str(move_args.old_parent_task_id) == "22222222-2222-2222-2222-222222222222"
    assert str(move_args.new_parent_task_id) == "33333333-3333-3333-3333-333333333333"
    assert str(move_args.new_vision_id) == "44444444-4444-4444-4444-444444444444"
    assert move_args.new_display_order == 2
    assert reorder_args.resource == "task"
    assert reorder_args.task_command == "reorder"
    assert reorder_args.order == [
        "11111111-1111-1111-1111-111111111111:0",
        "22222222-2222-2222-2222-222222222222:1",
    ]


def test_cli_parser_supports_timelog_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "timelog",
            "add",
            "Deep work",
            "--start-time",
            "2026-04-10T13:00:00-04:00",
            "--end-time",
            "2026-04-10T14:30:00-04:00",
            "--tracking-method",
            "manual",
        ]
    )

    assert args.resource == "timelog"
    assert args.timelog_command == "add"
    assert args.title == "Deep work"
    assert args.tracking_method == "manual"


def test_cli_parser_supports_vision_update_clear_area_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "vision",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-area",
        ]
    )

    assert args.resource == "vision"
    assert args.vision_command == "update"
    assert args.clear_area is True


def test_cli_parser_supports_vision_update_clear_people_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "vision",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-people",
        ]
    )

    assert args.resource == "vision"
    assert args.vision_command == "update"
    assert args.clear_people is True


def test_cli_parser_supports_vision_experience_commands() -> None:
    parser = build_parser()

    add_args = parser.parse_args(
        [
            "vision",
            "add-experience",
            "11111111-1111-1111-1111-111111111111",
            "--points",
            "120",
        ]
    )
    sync_args = parser.parse_args(
        ["vision", "sync-experience", "11111111-1111-1111-1111-111111111111"]
    )
    harvest_args = parser.parse_args(["vision", "harvest", "11111111-1111-1111-1111-111111111111"])

    assert add_args.resource == "vision"
    assert add_args.vision_command == "add-experience"
    assert add_args.experience_points == 120
    assert sync_args.vision_command == "sync-experience"
    assert harvest_args.vision_command == "harvest"


def test_cli_parser_supports_vision_read_model_commands() -> None:
    parser = build_parser()

    with_tasks_args = parser.parse_args(
        ["vision", "with-tasks", "11111111-1111-1111-1111-111111111111"]
    )
    stats_args = parser.parse_args(["vision", "stats", "11111111-1111-1111-1111-111111111111"])

    assert with_tasks_args.resource == "vision"
    assert with_tasks_args.vision_command == "with-tasks"
    assert stats_args.resource == "vision"
    assert stats_args.vision_command == "stats"


def test_cli_vision_update_help_lists_valid_statuses(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["vision", "update", "--help"])

    captured = capsys.readouterr()

    assert "active`, `archived`, and `fruit`" in captured.out
    assert "--status paused" not in captured.out


def test_cli_parser_supports_tag_update_clear_color_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "tag",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-color",
        ]
    )

    assert args.resource == "tag"
    assert args.tag_command == "update"
    assert args.clear_color is True


def test_cli_parser_supports_tag_list_person_filter() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "tag",
            "list",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
        ]
    )

    assert args.resource == "tag"
    assert args.tag_command == "list"
    assert str(args.person_id) == "11111111-1111-1111-1111-111111111111"


def test_cli_parser_supports_task_batch_delete_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "batch",
            "delete",
            "--ids",
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222",
        ]
    )

    assert args.resource == "task"
    assert args.task_command == "batch"
    assert args.task_batch_command == "delete"
    assert len(args.task_ids) == 2


def test_cli_parser_supports_task_update_clear_parent_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-parent",
        ]
    )

    assert args.resource == "task"
    assert args.task_command == "update"
    assert str(args.task_id) == "11111111-1111-1111-1111-111111111111"
    assert args.clear_parent is True


def test_cli_parser_supports_task_update_clear_people_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "task",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-people",
        ]
    )

    assert args.resource == "task"
    assert args.task_command == "update"
    assert args.clear_people is True


def test_cli_parser_supports_habit_add_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
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

    assert args.resource == "habit"
    assert args.habit_command == "add"
    assert args.title == "Daily Exercise"
    assert args.duration_days == 21


def test_cli_parser_supports_habit_list_count_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["habit", "list", "--status", "active", "--count"])

    assert args.resource == "habit"
    assert args.habit_command == "list"
    assert args.status == "active"
    assert args.count is True


def test_cli_parser_supports_habit_update_clear_task_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "habit",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-task",
        ]
    )

    assert args.resource == "habit"
    assert args.habit_command == "update"
    assert str(args.habit_id) == "11111111-1111-1111-1111-111111111111"
    assert args.clear_task is True


def test_cli_parser_supports_habit_action_list_by_date_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "habit-action",
            "list",
            "--action-date",
            "2026-04-09",
        ]
    )

    assert args.resource == "habit-action"
    assert args.habit_action_command == "list"
    assert str(args.action_date) == "2026-04-09"


def test_cli_parser_supports_habit_action_list_count_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["habit-action", "list", "--action-date", "2026-04-09", "--count"])

    assert args.resource == "habit-action"
    assert args.habit_action_command == "list"
    assert args.count is True


def test_cli_parser_supports_habit_action_log_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "habit-action",
            "log",
            "--habit-id",
            "77777777-7777-7777-7777-777777777777",
            "--action-date",
            "2026-04-09",
            "--status",
            "done",
        ]
    )

    assert args.resource == "habit-action"
    assert args.habit_action_command == "log"
    assert args.habit_id == UUID("77777777-7777-7777-7777-777777777777")
    assert str(args.action_date) == "2026-04-09"
    assert args.status == "done"


def test_cli_parser_supports_event_update_clear_people_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "event",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-people",
        ]
    )

    assert args.resource == "event"
    assert args.event_command == "update"
    assert args.clear_people is True


def test_cli_parser_supports_timelog_update_clear_notes_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "timelog",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-notes",
        ]
    )

    assert args.resource == "timelog"
    assert args.timelog_command == "update"
    assert args.clear_notes is True


def test_cli_parser_supports_timelog_batch_update_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "timelog",
            "batch",
            "update",
            "--ids",
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222",
            "--find-title-text",
            "deep",
            "--replace-title-text",
            "focused",
            "--clear-task",
            "--person-id",
            "33333333-3333-3333-3333-333333333333",
        ]
    )

    assert args.resource == "timelog"
    assert args.timelog_command == "batch"
    assert args.timelog_batch_command == "update"
    assert args.find_title_text == "deep"
    assert args.replace_title_text == "focused"
    assert args.clear_task is True
    assert args.person_ids == [UUID("33333333-3333-3333-3333-333333333333")]
    assert len(args.timelog_ids) == 2


def test_cli_parser_supports_timelog_restore_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["timelog", "restore", "11111111-1111-1111-1111-111111111111"])

    assert args.resource == "timelog"
    assert args.timelog_command == "restore"


def test_cli_parser_supports_timelog_batch_restore_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "timelog",
            "batch",
            "restore",
            "--ids",
            "11111111-1111-1111-1111-111111111111",
            "22222222-2222-2222-2222-222222222222",
        ]
    )

    assert args.resource == "timelog"
    assert args.timelog_command == "batch"
    assert args.timelog_batch_command == "restore"
    assert len(args.timelog_ids) == 2


@pytest.mark.parametrize(
    ("argv",),
    [
        (["note", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "note",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["area", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "area",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["tag", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "tag",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["people", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "people",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["vision", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "vision",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["task", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "task",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["habit", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "habit",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["habit-action", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (["event", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "event",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
        (["timelog", "delete", "11111111-1111-1111-1111-111111111111", "--hard"],),
        (
            [
                "timelog",
                "batch",
                "delete",
                "--ids",
                "11111111-1111-1111-1111-111111111111",
                "--hard",
            ],
        ),
    ],
)
def test_cli_parser_rejects_hard_delete_flags(argv: list[str]) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(argv)


def test_main_note_without_action_prints_resource_help(capsys) -> None:
    exit_code = cli.main(["note"])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Create, inspect, update, and delete note records." in captured.out
    assert "Run `lifeos init` before using note commands for the first time." in captured.out


def test_cli_note_list_help_explains_output_shape(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["note", "list", "--help"])

    captured = capsys.readouterr()

    assert "The output is tab-separated" in captured.out
    assert "Use --limit and --offset together for pagination." in captured.out


def test_cli_note_batch_help_explains_namespace_intent(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["note", "batch", "--help"])

    captured = capsys.readouterr()

    assert "Run operations that target multiple notes in a single command." in captured.out
    assert "update-content" in captured.out
    assert "delete" in captured.out
