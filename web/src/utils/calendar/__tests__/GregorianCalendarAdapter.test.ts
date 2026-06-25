import { describe, expect, it } from "vitest";

import { GregorianCalendarAdapter } from "@/utils/calendar";
import type { TaskWithSubtasks } from "@/services/api";

const createTask = (
  overrides: Partial<TaskWithSubtasks>,
): TaskWithSubtasks => ({
  id: overrides.id ?? "task-id",
  vision_id: null,
  parent_task_id: overrides.parent_task_id ?? null,
  content: overrides.content ?? "Task",
  notes_count: overrides.notes_count ?? 0,
  status: overrides.status ?? "todo",
  priority: 1,
  display_order: 0,
  estimated_effort: null,
  planning_cycle_type: overrides.planning_cycle_type ?? "day",
  planning_cycle_days: overrides.planning_cycle_days ?? null,
  planning_cycle_start_date:
    overrides.planning_cycle_start_date ?? "2025-01-01",
  actual_effort: null,
  actual_effort_self: 0,
  actual_effort_total: 0,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
  deleted_at: null,
  people: [],
  subtasks: overrides.subtasks ?? [],
  completion_percentage: overrides.completion_percentage ?? 0,
  depth: overrides.depth ?? 0,
});

describe("GregorianCalendarAdapter", () => {
  it("returns week start based on configured first day", () => {
    const thursday = new Date("2025-01-02T12:00:00Z");

    const mondayStart = new GregorianCalendarAdapter(1).getWeekStart(thursday);
    expect(mondayStart.getDay()).toBe(1);

    const sundayStart = new GregorianCalendarAdapter(7).getWeekStart(thursday);
    expect(sundayStart.getDay()).toBe(0);
  });

  it("computes next and previous periods", () => {
    const adapter = new GregorianCalendarAdapter();
    const base = new Date("2025-01-01T00:00:00Z");

    expect(adapter.getNextPeriod(base, "year").getFullYear()).toBe(2026);
    expect(adapter.getPreviousPeriod(base, "year").getFullYear()).toBe(2024);
    expect(adapter.getNextPeriod(base, "month").getMonth()).toBe(1);
    expect(adapter.getPreviousPeriod(base, "day").getDate()).toBe(31);
  });

  it("builds week groups with nested day children", () => {
    const adapter = new GregorianCalendarAdapter(1);
    const base = new Date("2025-01-08T00:00:00Z");

    const weekTask = createTask({
      id: "week-1",
      planning_cycle_type: "week",
      planning_cycle_start_date: "2025-01-06",
    });
    const mondayTask = createTask({
      id: "day-monday",
      planning_cycle_type: "day",
      planning_cycle_start_date: "2025-01-06",
    });
    const tuesdayTask = createTask({
      id: "day-tuesday",
      planning_cycle_type: "day",
      planning_cycle_start_date: "2025-01-07",
    });

    const groups = adapter.buildPlanningGroups(
      "week",
      base,
      [weekTask, mondayTask, tuesdayTask],
      1,
    );

    expect(groups).toHaveLength(1);
    const weekGroup = groups[0];
    expect(weekGroup.tasks.map((task) => task.id)).toEqual(["week-1"]);
    expect(weekGroup.children).toHaveLength(7);
    const mondayGroup = weekGroup.children?.[0];
    const tuesdayGroup = weekGroup.children?.[1];
    expect(mondayGroup?.tasks[0].id).toBe("day-monday");
    expect(tuesdayGroup?.tasks[0].id).toBe("day-tuesday");
  });

  it("builds year groups including month children", () => {
    const adapter = new GregorianCalendarAdapter();
    const base = new Date("2025-05-15T00:00:00Z");

    const yearTask = createTask({
      id: "year-1",
      planning_cycle_type: "year",
      planning_cycle_start_date: "2025-01-01",
    });
    const monthTask = createTask({
      id: "month-5",
      planning_cycle_type: "month",
      planning_cycle_start_date: "2025-05-01",
    });

    const groups = adapter.buildPlanningGroups(
      "year",
      base,
      [yearTask, monthTask],
      1,
    );

    expect(groups).toHaveLength(1);
    const yearGroup = groups[0];
    expect(yearGroup.tasks.map((task) => task.id)).toEqual(["year-1"]);
    expect(yearGroup.children).toHaveLength(12);
    const mayGroup = yearGroup.children?.[4];
    expect(mayGroup?.tasks.map((task) => task.id)).toEqual(["month-5"]);
  });
});
