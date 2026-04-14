from __future__ import annotations

from tests.cli_integration_support import (
    INTEGRATION_PYTESTMARK,
    IntegrationContext,
    assert_ok,
    extract_created_id,
    init_context,
    run_lifeos,
)

pytestmark = INTEGRATION_PYTESTMARK


def test_real_cli_schedule_workflow(integration_context: IntegrationContext) -> None:
    init_context(integration_context)

    vision_result = run_lifeos(integration_context, "vision", "add", "Launch lifeos-cli")
    assert_ok(vision_result)
    vision_id = extract_created_id(vision_result.stdout)

    task_result = run_lifeos(
        integration_context,
        "task",
        "add",
        "Draft release checklist",
        "--vision-id",
        vision_id,
        "--planning-cycle-type",
        "week",
        "--planning-cycle-days",
        "7",
        "--planning-cycle-start-date",
        "2026-04-10",
    )
    assert_ok(task_result)
    task_id = extract_created_id(task_result.stdout)

    habit_result = run_lifeos(
        integration_context,
        "habit",
        "add",
        "Daily Review",
        "--start-date",
        "2026-04-10",
        "--duration-days",
        "7",
    )
    assert_ok(habit_result)

    event_result = run_lifeos(
        integration_context,
        "event",
        "add",
        "Release planning block",
        "--type",
        "timeblock",
        "--start-time",
        "2026-04-10T09:00:00-04:00",
        "--end-time",
        "2026-04-10T10:00:00-04:00",
        "--task-id",
        task_id,
    )
    assert_ok(event_result)
    event_id = extract_created_id(event_result.stdout)

    recurring_event_result = run_lifeos(
        integration_context,
        "event",
        "add",
        "Daily review",
        "--type",
        "deadline",
        "--start-time",
        "2026-04-10T12:00:00-04:00",
        "--end-time",
        "2026-04-10T12:30:00-04:00",
        "--recurrence-frequency",
        "daily",
        "--recurrence-count",
        "2",
    )
    assert_ok(recurring_event_result)

    schedule_show_result = run_lifeos(
        integration_context,
        "schedule",
        "show",
        "--date",
        "2026-04-10",
    )
    assert_ok(schedule_show_result)
    assert "date: 2026-04-10" in schedule_show_result.stdout
    assert "tasks:" in schedule_show_result.stdout
    assert (
        "  task_id\tstatus\tvision\tplanning_cycle_type\tplanning_cycle_start_date\t"
        "planning_cycle_end_date\tcontent" in schedule_show_result.stdout
    )
    assert "habit_actions:" in schedule_show_result.stdout
    assert "  habit_action_id\tstatus\thabit_id\thabit_title" in schedule_show_result.stdout
    assert "appointments:" in schedule_show_result.stdout
    assert "timeblocks:" in schedule_show_result.stdout
    assert (
        "  event_id\tstatus\tstart_time\tend_time\ttask_id\tvision\ttitle"
        in schedule_show_result.stdout
    )
    assert "deadlines:" in schedule_show_result.stdout
    assert task_id in schedule_show_result.stdout
    assert "Launch lifeos-cli" in schedule_show_result.stdout
    assert "Daily Review" in schedule_show_result.stdout
    assert event_id in schedule_show_result.stdout
    assert "Release planning block" in schedule_show_result.stdout
    assert "Daily review" in schedule_show_result.stdout

    schedule_list_result = run_lifeos(
        integration_context,
        "schedule",
        "list",
        "--start-date",
        "2026-04-10",
        "--end-date",
        "2026-04-11",
    )
    assert_ok(schedule_list_result)
    assert "date: 2026-04-10" in schedule_list_result.stdout
    assert "date: 2026-04-11" in schedule_list_result.stdout
    assert (
        "  task_id\tstatus\tvision\tplanning_cycle_type\tplanning_cycle_start_date\t"
        "planning_cycle_end_date\tcontent" in schedule_list_result.stdout
    )
    assert "  habit_action_id\tstatus\thabit_id\thabit_title" in schedule_list_result.stdout
    assert (
        "  event_id\tstatus\tstart_time\tend_time\ttask_id\tvision\ttitle"
        in schedule_list_result.stdout
    )
    assert task_id in schedule_list_result.stdout
    assert "Launch lifeos-cli" in schedule_list_result.stdout
    assert schedule_list_result.stdout.count("Daily review") == 2
