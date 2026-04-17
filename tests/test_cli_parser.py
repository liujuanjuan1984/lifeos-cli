from __future__ import annotations

from datetime import date
from uuid import UUID

import pytest

from lifeos_cli import cli
from lifeos_cli.cli import build_parser


def test_cli_parser_uses_lifeos_command_name() -> None:
    parser = build_parser()

    assert parser.prog == "lifeos"


def test_cli_parser_supports_short_version_flag(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit) as exc_info:
        parser.parse_args(["-v"])

    captured = capsys.readouterr()

    assert exc_info.value.code == 0
    assert captured.out.startswith("lifeos ")


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

    assert " _      ___   _____  _____   ___    ____  " in captured.out
    assert "| |___  | |  |  _|  | |___ | |_| |  ___) |" in captured.out
    assert "usage:" not in captured.out
    assert "Run LifeOS resource commands from the terminal." not in captured.out
    assert "repo: https://github.com/liujuanjuan1984/lifeos-cli" in captured.out
    assert "uv tool install --upgrade lifeos-cli" in captured.out
    assert "lifeos <resource> <action> [arguments] [options]" in captured.out
    assert "Resources model domains" not in captured.out
    assert "resources:" in captured.out
    assert "resources:\n  resource" not in captured.out
    assert "init" in captured.out
    assert "schedule" in captured.out
    assert "task" in captured.out
    assert "primary command reference" in captured.out
    assert "Run `lifeos init` before using database-backed resource commands." in captured.out
    assert "Welcome bug reports and suggestions through the repo issue tracker." in captured.out
    assert 'lifeos note add "Capture an idea"' in captured.out


def test_cli_task_help_describes_event_bridge_without_action_level_schedule_contract(
    capsys,
) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["task", "--help"])

    captured = capsys.readouterr()

    assert "Use `lifeos event add --task-id <task-id>`" in captured.out
    assert "A task appears in `lifeos schedule show`" not in captured.out


def test_cli_task_add_help_describes_planning_cycle_semantics(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["task", "add", "--help"])

    captured = capsys.readouterr()

    assert "Planning cycle type: year, month, week, or day" in captured.out
    assert "Start date of the enclosing planning cycle window" in captured.out
    assert "not a clock-time execution slot" in captured.out
    assert "--planning-cycle-type week --planning-cycle-days 7" in captured.out


def test_cli_schedule_show_help_explains_task_inclusion_rule(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["schedule", "show", "--help"])

    captured = capsys.readouterr()

    assert (
        "Tasks appear when the requested local date falls inside their planning-cycle window"
        in captured.out
    )
    assert "Task rows come from planning-cycle overlap" in captured.out
    assert (
        "Task section columns: task_id, status, planning_cycle_type, planning_cycle_start_date, "
        "planning_cycle_end_date, content."
    ) in captured.out
    assert (
        "Habit action section columns: habit_action_id, status, habit_id, habit_title."
        in captured.out
    )
    assert (
        "Event section columns for appointments, timeblocks, and deadlines: "
        "event_id, status, start_time, end_time, task_id, title."
    ) in captured.out


def test_cli_habit_task_associations_help_documents_header(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["habit", "task-associations", "--help"])

    captured = capsys.readouterr()

    assert (
        "tab-separated columns: task_id, habit_id, habit_status, habit_start_date, habit_title."
        in captured.out
    )


def test_cli_vision_with_tasks_help_documents_task_header(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["vision", "with-tasks", "--help"])

    captured = capsys.readouterr()

    assert "tab-separated columns: task_id, status, parent_task_id, content." in captured.out


def test_cli_event_add_help_describes_extended_recurrence_frequencies(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["event", "add", "--help"])

    captured = capsys.readouterr()

    assert "monthly" in captured.out
    assert "yearly" in captured.out


def test_cli_habit_add_help_describes_extended_cadence_cycles(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["habit", "add", "--help"])

    captured = capsys.readouterr()

    assert "monthly" in captured.out
    assert "yearly" in captured.out


@pytest.mark.parametrize(
    ("argv", "expected"),
    [
        (
            ["task", "list", "--help"],
            "tab-separated columns: task_id, status, vision_id, parent_task_id, content.",
        ),
        (
            ["event", "list", "--help"],
            "tab-separated columns: event_id, status, event_type, start_time, end_time, "
            "task_id, title.",
        ),
        (
            ["habit", "list", "--help"],
            "Default list output prints a header row followed by tab-separated columns: "
            "habit_id, status, start_date, duration_days, cadence, task_id, title.",
        ),
        (
            ["note", "list", "--help"],
            "prints a header row followed by tab-separated columns: note_id, status, created_at, "
            "task_count, vision_count, event_count, people_count, timelog_count, tag_count",
        ),
    ],
)
def test_cli_summary_list_help_documents_output_columns(
    argv: list[str],
    expected: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(argv)

    captured = capsys.readouterr()

    assert expected in captured.out


def test_cli_task_help_supports_zh_hans_locale(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("LIFEOS_LANGUAGE", "zh-Hans")
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["task", "--help"])

    captured = capsys.readouterr()

    assert "创建并维护属于某个 `vision` 的 `task` 树。" in captured.out
    assert "创建 `task`" in captured.out
    assert "说明:" in captured.out


def test_cli_task_list_help_supports_zh_hans_locale_and_documents_header_row(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("LIFEOS_LANGUAGE", "zh-Hans")
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["task", "list", "--help"])

    captured = capsys.readouterr()

    assert "列出 `task` 以及可选的 `vision`、父级或状态过滤器。" in captured.out
    assert (
        "当存在结果时，`list` 命令会先输出一行表头，随后按制表符分隔输出列："
        "task_id、status、vision_id、parent_task_id、content。"
    ) in captured.out


def test_cli_top_level_help_supports_zh_hans_argparse_scaffolding(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("LIFEOS_LANGUAGE", "zh-Hans")
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["--help"])

    captured = capsys.readouterr()

    assert " _      ___   _____  _____   ___    ____  " in captured.out
    assert "|_____||___| |_|    |_____| \\___/  |____/ " in captured.out
    assert "usage:" not in captured.out and "用法：" not in captured.out
    assert "显示此帮助信息并退出" in captured.out or "-h, --help" in captured.out
    assert "资源:\n  资源" not in captured.out
    assert "在终端中运行 LifeOS 资源命令。" not in captured.out
    assert "repo: https://github.com/liujuanjuan1984/lifeos-cli" in captured.out
    assert "uv tool install --upgrade lifeos-cli" in captured.out
    assert "area" in captured.out and "管理 `area`" in captured.out
    assert "people" in captured.out and "管理 `people` 和关系" in captured.out
    assert "timelog" in captured.out and "管理 `timelog`" in captured.out
    assert "欢迎通过 repo issue 报告 bug 或提出意见建议。" in captured.out


def test_cli_note_help_avoids_duplicated_action_heading_and_reference_boilerplate(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["note", "--help"])

    captured = capsys.readouterr()

    assert "usage: lifeos note [-h] action ..." in captured.out
    assert "操作:\n  操作" not in captured.out
    assert "The note resource is the reference command family for LifeOS." not in captured.out
    assert "Future resources should follow the same command grammar:" not in captured.out


def test_cli_schedule_show_help_supports_zh_hans_locale(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("LIFEOS_LANGUAGE", "zh-Hans")
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["schedule", "show", "--help"])

    captured = capsys.readouterr()

    assert "显示某一个本地日期的聚合 `schedule`。" in captured.out
    assert "`task` 行来自 planning-cycle 的时间重叠" in captured.out
    assert "示例:" in captured.out


@pytest.mark.parametrize(
    ("argv", "expected"),
    [
        (
            ["task", "list", "--help"],
            "当存在结果时，`list` 命令会先输出一行表头，随后按制表符分隔输出列："
            "task_id、status、vision_id、parent_task_id、content。",
        ),
        (
            ["habit", "list", "--help"],
            "默认 `list` 输出会先输出一行表头，随后按制表符分隔输出列："
            "habit_id、status、start_date、duration_days、cadence、task_id、title。",
        ),
        (
            ["note", "list", "--help"],
            "当存在结果时，`list` 命令会先输出一行表头，随后按制表符分隔输出列："
            "note_id、status、created_at、task_count、vision_count、event_count、people_count、"
            "timelog_count、tag_count、content。",
        ),
        (
            ["vision", "with-tasks", "--help"],
            "当该 `vision` 存在 task 时，`tasks` 分段会先输出一行表头，随后按制表符分隔输出列："
            "task_id、status、parent_task_id、content。",
        ),
        (
            ["schedule", "show", "--help"],
            "`task` 分段的列为：task_id、status、planning_cycle_type、planning_cycle_start_date、"
            "planning_cycle_end_date、content。",
        ),
    ],
)
def test_cli_zh_hans_help_documents_entity_specific_header_names(
    monkeypatch: pytest.MonkeyPatch,
    argv: list[str],
    expected: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("LIFEOS_LANGUAGE", "zh-Hans")
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(argv)

    captured = capsys.readouterr()

    assert expected in captured.out


def test_cli_schedule_list_help_documents_section_headers(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["schedule", "list", "--help"])

    captured = capsys.readouterr()

    assert (
        "Non-empty schedule sections print a tab-separated header row before their entries."
        in captured.out
    )
    assert (
        "Task section columns: task_id, status, planning_cycle_type, planning_cycle_start_date, "
        "planning_cycle_end_date, content."
    ) in captured.out
    assert (
        "Habit action section columns: habit_action_id, status, habit_id, habit_title."
        in captured.out
    )
    assert (
        "Event section columns for appointments, timeblocks, and deadlines: "
        "event_id, status, start_time, end_time, task_id, title."
    ) in captured.out


def test_cli_zh_hans_help_keeps_internal_entity_terms_in_english(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("LIFEOS_LANGUAGE", "zh-Hans")
    parser = build_parser()

    cases = [
        (["people", "--help"], ["`people`", "`person`"]),
        (["timelog", "--help"], ["`timelog`", "`area`", "`task`"]),
        (["schedule", "--help"], ["`schedule`", "`task`", "`habit-action`", "`event`"]),
    ]

    for argv, expected_terms in cases:
        with pytest.raises(SystemExit):
            parser.parse_args([*argv[:-1], argv[-1]])
        captured = capsys.readouterr()
        for term in expected_terms:
            assert term in captured.out


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
    range_args = parser.parse_args(
        ["timelog", "stats", "range", "--date", "2026-04-01", "--date", "2026-04-30"]
    )
    month_args = parser.parse_args(["timelog", "stats", "month", "--month", "2026-04"])
    rebuild_args = parser.parse_args(["timelog", "stats", "rebuild", "--all"])

    assert day_args.resource == "timelog"
    assert day_args.timelog_command == "stats"
    assert day_args.timelog_stats_command == "day"
    assert day_args.target_date == date(2026, 4, 10)
    assert range_args.timelog_stats_command == "range"
    assert range_args.date_values == [date(2026, 4, 1), date(2026, 4, 30)]
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
    assert args.date_values == [date(2026, 4, 10)]


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


def test_cli_parser_supports_event_monthly_recurrence_add_flags() -> None:
    parser = build_parser()
    args = parser.parse_args(
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

    assert args.resource == "event"
    assert args.event_command == "add"
    assert args.recurrence_frequency == "monthly"


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


def test_cli_parser_supports_note_add_association_flags() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "note",
            "add",
            "Association note",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
            "--task-id",
            "22222222-2222-2222-2222-222222222222",
            "--timelog-id",
            "33333333-3333-3333-3333-333333333333",
        ]
    )

    assert args.resource == "note"
    assert args.note_command == "add"
    assert args.person_ids == [UUID("11111111-1111-1111-1111-111111111111")]
    assert args.task_ids == [UUID("22222222-2222-2222-2222-222222222222")]
    assert args.timelog_ids == [UUID("33333333-3333-3333-3333-333333333333")]


def test_cli_parser_supports_note_add_extended_association_flags() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "note",
            "add",
            "Graph note",
            "--tag-id",
            "11111111-1111-1111-1111-111111111111",
            "--task-id",
            "22222222-2222-2222-2222-222222222222",
            "--task-id",
            "33333333-3333-3333-3333-333333333333",
            "--vision-id",
            "44444444-4444-4444-4444-444444444444",
            "--event-id",
            "55555555-5555-5555-5555-555555555555",
        ]
    )

    assert args.resource == "note"
    assert args.note_command == "add"
    assert args.tag_ids == [UUID("11111111-1111-1111-1111-111111111111")]
    assert args.task_ids == [
        UUID("22222222-2222-2222-2222-222222222222"),
        UUID("33333333-3333-3333-3333-333333333333"),
    ]
    assert args.vision_ids == [UUID("44444444-4444-4444-4444-444444444444")]
    assert args.event_ids == [UUID("55555555-5555-5555-5555-555555555555")]


def test_cli_parser_supports_note_update_relation_only_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "note",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-timelogs",
        ]
    )

    assert args.resource == "note"
    assert args.note_command == "update"
    assert args.content is None
    assert args.clear_timelogs is True


def test_cli_parser_supports_note_update_clear_tasks_flag() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "note",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-tasks",
        ]
    )

    assert args.resource == "note"
    assert args.note_command == "update"
    assert args.clear_tasks is True


def test_cli_parser_supports_note_list_relation_filters() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "note",
            "list",
            "--person-id",
            "11111111-1111-1111-1111-111111111111",
            "--timelog-id",
            "22222222-2222-2222-2222-222222222222",
        ]
    )

    assert args.resource == "note"
    assert args.note_command == "list"
    assert args.person_id == UUID("11111111-1111-1111-1111-111111111111")
    assert args.timelog_id == UUID("22222222-2222-2222-2222-222222222222")


def test_cli_parser_supports_schedule_show_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["schedule", "show", "--date", "2026-04-10"])

    assert args.resource == "schedule"
    assert args.schedule_command == "show"
    assert str(args.target_date) == "2026-04-10"


def test_cli_parser_supports_schedule_list_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["schedule", "list", "--date", "2026-04-10", "--date", "2026-04-16"])

    assert args.resource == "schedule"
    assert args.schedule_command == "list"
    assert args.date_values == [date(2026, 4, 10), date(2026, 4, 16)]


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
    assert args.date_values == [date(2026, 4, 10)]


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


def test_cli_parser_supports_habit_add_weekly_cadence_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
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

    assert args.resource == "habit"
    assert args.habit_command == "add"
    assert args.cadence_frequency == "weekly"
    assert args.weekends_only is True
    assert args.target_per_cycle == 1


def test_cli_parser_supports_habit_add_monthly_cadence_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
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

    assert args.resource == "habit"
    assert args.habit_command == "add"
    assert args.cadence_frequency == "monthly"
    assert args.target_per_cycle == 2


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


def test_cli_parser_supports_habit_update_clear_weekdays_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "habit",
            "update",
            "11111111-1111-1111-1111-111111111111",
            "--clear-weekdays",
        ]
    )

    assert args.resource == "habit"
    assert args.habit_command == "update"
    assert str(args.habit_id) == "11111111-1111-1111-1111-111111111111"
    assert args.clear_weekdays is True


def test_cli_parser_supports_habit_action_list_by_date_command() -> None:
    parser = build_parser()
    args = parser.parse_args(
        [
            "habit-action",
            "list",
            "--date",
            "2026-04-09",
        ]
    )

    assert args.resource == "habit-action"
    assert args.habit_action_command == "list"
    assert args.date_values == [date(2026, 4, 9)]


def test_cli_parser_supports_habit_action_list_count_command() -> None:
    parser = build_parser()
    args = parser.parse_args(["habit-action", "list", "--date", "2026-04-09", "--count"])

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
            "--date",
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
    assert "\n  lifeos note add --help\n" in captured.out
    assert "Run `lifeos init` before using note commands for the first time." in captured.out
    assert "\n  lifeos init\n" not in captured.out
    assert "tab-separated columns" not in captured.out
    assert "Use `show` to inspect the full note body" not in captured.out


@pytest.mark.parametrize(
    ("resource", "expected_help_examples"),
    [
        ("area", ("lifeos area add --help", "lifeos area list --help", "lifeos area batch --help")),
        (
            "data",
            (
                "lifeos data export --help",
                "lifeos data import --help",
                "lifeos data batch-update --help",
            ),
        ),
        (
            "event",
            ("lifeos event add --help", "lifeos event list --help", "lifeos event batch --help"),
        ),
        (
            "habit",
            ("lifeos habit add --help", "lifeos habit list --help", "lifeos habit batch --help"),
        ),
        (
            "habit-action",
            (
                "lifeos habit-action list --help",
                "lifeos habit-action show --help",
                "lifeos habit-action log --help",
            ),
        ),
        ("note", ("lifeos note add --help", "lifeos note list --help", "lifeos note batch --help")),
        (
            "people",
            (
                "lifeos people add --help",
                "lifeos people list --help",
                "lifeos people batch --help",
            ),
        ),
        ("schedule", ("lifeos schedule show --help", "lifeos schedule list --help")),
        ("tag", ("lifeos tag add --help", "lifeos tag list --help", "lifeos tag batch --help")),
        (
            "task",
            ("lifeos task add --help", "lifeos task list --help", "lifeos task batch --help"),
        ),
        (
            "timelog",
            (
                "lifeos timelog add --help",
                "lifeos timelog list --help",
                "lifeos timelog stats --help",
            ),
        ),
        (
            "vision",
            ("lifeos vision add --help", "lifeos vision list --help", "lifeos vision batch --help"),
        ),
    ],
)
def test_main_resource_help_surfaces_action_help_examples(
    resource: str,
    expected_help_examples: tuple[str, ...],
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main([resource])
    captured = capsys.readouterr()

    assert exit_code == 0
    for expected_help_example in expected_help_examples:
        assert f"\n  {expected_help_example}\n" in captured.out


@pytest.mark.parametrize(
    ("argv", "expected_help_examples"),
    [
        (["area", "batch"], ("lifeos area batch delete --help",)),
        (["event", "batch"], ("lifeos event batch delete --help",)),
        (["habit", "batch"], ("lifeos habit batch delete --help",)),
        (
            ["note", "batch"],
            ("lifeos note batch update-content --help", "lifeos note batch delete --help"),
        ),
        (["people", "batch"], ("lifeos people batch delete --help",)),
        (["tag", "batch"], ("lifeos tag batch delete --help",)),
        (["task", "batch"], ("lifeos task batch delete --help",)),
        (
            ["timelog", "batch"],
            (
                "lifeos timelog batch update --help",
                "lifeos timelog batch restore --help",
                "lifeos timelog batch delete --help",
            ),
        ),
        (
            ["timelog", "stats"],
            (
                "lifeos timelog stats day --help",
                "lifeos timelog stats range --help",
                "lifeos timelog stats rebuild --help",
            ),
        ),
        (["vision", "batch"], ("lifeos vision batch delete --help",)),
    ],
)
def test_namespace_help_surfaces_nested_help_examples(
    argv: list[str],
    expected_help_examples: tuple[str, ...],
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main(argv)
    captured = capsys.readouterr()

    assert exit_code == 0
    for expected_help_example in expected_help_examples:
        assert f"\n  {expected_help_example}\n" in captured.out


@pytest.mark.parametrize(
    ("resource", "unexpected"),
    [
        ("task", "A task appears in `lifeos schedule show`"),
        ("schedule", "segmented into appointment, timeblock, and deadline sections"),
        ("timelog", "linked_notes_count"),
    ],
)
def test_resource_help_avoids_action_level_contract_details(
    resource: str,
    unexpected: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main([resource])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert unexpected not in captured.out


@pytest.mark.parametrize(
    ("resource", "expected_note"),
    [
        ("area", "See `lifeos area batch --help` for bulk delete operations."),
        ("event", "See `lifeos event batch --help` for bulk delete operations."),
        ("habit", "See `lifeos habit batch --help` for bulk delete operations."),
        (
            "note",
            "See `lifeos note batch --help` for bulk `update-content` and `delete` workflows.",
        ),
        ("people", "See `lifeos people batch --help` for bulk delete operations."),
        ("tag", "See `lifeos tag batch --help` for bulk delete operations."),
        ("task", "See `lifeos task batch --help` for bulk delete operations."),
        (
            "timelog",
            "See `lifeos timelog batch --help` for bulk `update`, `restore`, and `delete` "
            "workflows.",
        ),
        ("vision", "See `lifeos vision batch --help` for bulk delete operations."),
    ],
)
def test_resource_help_surfaces_concrete_batch_guidance(
    resource: str,
    expected_note: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main([resource])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert expected_note in captured.out


@pytest.mark.parametrize(
    "resource",
    ("area", "event", "habit", "note", "people", "tag", "task", "timelog", "vision"),
)
def test_resource_help_avoids_delete_behavior_contract_details(
    resource: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main([resource])
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "soft deletion" not in captured.out


@pytest.mark.parametrize(
    ("resource", "unexpected_examples"),
    [
        (
            "note",
            ('lifeos note add "Capture an idea"', 'lifeos note search "sprint retrospective"'),
        ),
        (
            "area",
            (
                'lifeos area add "Health" --color "#16A34A"',
                "lifeos area show 11111111-1111-1111-1111-111111111111",
            ),
        ),
        (
            "timelog",
            (
                'lifeos timelog add "Deep work" --start-time 2026-04-10T13:00:00-04:00 '
                "--end-time 2026-04-10T14:30:00-04:00",
                "lifeos timelog restore <timelog-id>",
            ),
        ),
    ],
)
def test_resource_help_examples_stay_navigation_focused(
    resource: str,
    unexpected_examples: tuple[str, ...],
    capsys: pytest.CaptureFixture[str],
) -> None:
    exit_code = cli.main([resource])
    captured = capsys.readouterr()

    assert exit_code == 0
    for unexpected_example in unexpected_examples:
        assert unexpected_example not in captured.out


@pytest.mark.parametrize(
    ("argv", "expected"),
    [
        (["note", "-h", "add"], "Create a new note from inline text, stdin, or a file."),
        (["task", "-h", "add"], "Create a new task for a vision."),
        (
            ["note", "-h", "batch", "update-content"],
            "Apply a find/replace operation across multiple active notes.",
        ),
        (
            ["note", "batch", "-h", "update-content"],
            "Apply a find/replace operation across multiple active notes.",
        ),
        (["-h", "note", "add"], "Create a new note from inline text, stdin, or a file."),
    ],
)
def test_main_rewrites_misplaced_help_flags_to_target_subcommand(
    argv: list[str],
    expected: str,
    capsys: pytest.CaptureFixture[str],
) -> None:
    with pytest.raises(SystemExit) as exc_info:
        cli.main(argv)

    captured = capsys.readouterr()

    assert exc_info.value.code == 0
    assert expected in captured.out


def test_cli_note_list_help_explains_output_shape(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["note", "list", "--help"])

    captured = capsys.readouterr()

    assert "prints a header row followed by tab-separated columns" in captured.out
    assert "Use --limit and --offset together for pagination." in captured.out


def test_cli_note_add_help_keeps_init_guidance_out_of_examples(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["note", "add", "--help"])

    captured = capsys.readouterr()

    assert "Run `lifeos init`" not in captured.out
    assert "\n  lifeos init\n" not in captured.out


def test_cli_note_batch_help_explains_namespace_intent(capsys) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(["note", "batch", "--help"])

    captured = capsys.readouterr()

    assert "Run operations that target multiple notes in a single command." in captured.out
    assert "update-content" in captured.out
    assert "delete" in captured.out
