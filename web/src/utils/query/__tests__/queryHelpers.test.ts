import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { tasksKeys, visionsKeys } from "@/services/api/queryKeys";
import type { Task } from "@/services/api/tasks";
import type { UUID } from "@/types/primitive";
import { normalizeTaskSelectorSourceFilters } from "@/services/api/taskFilters";
import {
  removeTaskFromSelectorSourceCache,
  updateTaskCaches,
} from "@/utils/query";

const createTask = (overrides?: Partial<Task>): Task => ({
  id: (overrides?.id ?? `task-${Math.random().toString(36).slice(2)}`) as UUID,
  vision_id: overrides?.vision_id ?? null,
  parent_task_id:
    overrides?.parent_task_id === undefined ? null : overrides.parent_task_id,
  content: overrides?.content ?? "Sample Task",
  status: overrides?.status ?? "active",
  priority: overrides?.priority ?? 0,
  display_order: overrides?.display_order ?? 0,
  estimated_effort: overrides?.estimated_effort ?? null,
  actual_effort: overrides?.actual_effort ?? null,
  actual_effort_self: overrides?.actual_effort_self ?? 0,
  actual_effort_total: overrides?.actual_effort_total ?? 0,
  notes_count: overrides?.notes_count ?? 0,
  created_at: overrides?.created_at ?? new Date().toISOString(),
  updated_at: overrides?.updated_at ?? new Date().toISOString(),
  deleted_at: overrides?.deleted_at ?? null,
  persons: overrides?.persons ?? [],
  planning_cycle_type: overrides?.planning_cycle_type ?? null,
  planning_cycle_days: overrides?.planning_cycle_days ?? null,
  planning_cycle_start_date: overrides?.planning_cycle_start_date ?? null,
});

describe("queryHelpers selector source cache syncing", () => {
  let queryClient: QueryClient;
  const selectorFilters = normalizeTaskSelectorSourceFilters({
    exclude_status: ["done"],
  });
  const selectorKey = tasksKeys.selectorSource(selectorFilters);

  beforeEach(() => {
    queryClient = new QueryClient();
    queryClient.setQueryData(selectorKey, []);
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("inserts newly created task into selector cache", () => {
    const task = createTask({ id: "task-new" as UUID, status: "active" });

    updateTaskCaches(queryClient, task);

    const selectorData = queryClient.getQueryData<Task[]>(selectorKey);
    const detail = queryClient.getQueryData<Task>(tasksKeys.detail(task.id));

    expect(detail?.id).toBe(task.id);
    expect(selectorData).toHaveLength(1);
    expect(selectorData?.[0].id).toBe(task.id);
  });

  it("removes task from selector cache when it no longer matches filters", () => {
    const task = createTask({ id: "task-filter" as UUID, status: "active" });
    queryClient.setQueryData(selectorKey, [task]);

    updateTaskCaches(queryClient, { ...task, status: "done" });

    const selectorData = queryClient.getQueryData<Task[]>(selectorKey);
    expect(selectorData).toHaveLength(0);
  });

  it("purges task from selector cache when deleted", () => {
    const task = createTask({ id: "task-delete" as UUID });
    queryClient.setQueryData(selectorKey, [task]);

    removeTaskFromSelectorSourceCache(queryClient, task.id);

    const selectorData = queryClient.getQueryData<Task[]>(selectorKey);
    expect(selectorData).toHaveLength(0);
  });

  it("updates tasks nested inside hierarchy query data", () => {
    const visionId = "vision-nested" as UUID;
    const hierarchyKey = visionsKeys.hierarchy(visionId);
    const childTask = {
      ...createTask({ id: "task-child" as UUID, vision_id: visionId }),
      subtasks: [],
    };
    const rootTask = {
      ...createTask({ id: "task-root" as UUID, vision_id: visionId }),
      subtasks: [childTask],
    };

    queryClient.setQueryData(hierarchyKey, {
      root_tasks: [rootTask],
    });

    updateTaskCaches(queryClient, {
      ...childTask,
      content: "Updated Child",
    });

    const hierarchyData = queryClient.getQueryData<{
      root_tasks: Array<
        Task & {
          subtasks?: Task[];
        }
      >;
    }>(hierarchyKey);

    expect(hierarchyData?.root_tasks[0].subtasks?.[0].content).toBe(
      "Updated Child",
    );
  });
});
