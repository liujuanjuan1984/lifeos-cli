import type { QueryClient } from "@tanstack/react-query";
import { habitsKeys, tasksKeys } from "@/services/api/queryKeys";
import type { TaskFieldsMode } from "@/services/api/tasks";

const PLANNING_TASK_LIST_LIMIT = 100;

const PLANNING_TASK_FIELD_MODES: TaskFieldsMode[] = ["basic", "full"];

export interface PlanningSnapshot {
  planning_cycle_type?: string | null;
  planning_cycle_start_date?: string | null;
}

interface NormalizedPlanningSnapshot {
  planning_cycle_type: string;
  planning_cycle_start_date: string;
}

const isValidSnapshotValue = (
  value: string | null | undefined,
): value is string => typeof value === "string" && value.trim().length > 0;

const normalizePlanningSnapshot = (
  snapshot: PlanningSnapshot | null | undefined,
): NormalizedPlanningSnapshot | null => {
  if (!snapshot) return null;
  const { planning_cycle_type, planning_cycle_start_date } = snapshot;
  if (
    !isValidSnapshotValue(planning_cycle_type) ||
    !isValidSnapshotValue(planning_cycle_start_date)
  ) {
    return null;
  }
  return {
    planning_cycle_type,
    planning_cycle_start_date,
  };
};

interface InvalidatePlanningOptions {
  /**
   * 是否同时失效与每日习惯相关的缓存。默认 true。
   */
  includeHabitActions?: boolean;
  /**
   * 需要额外强制失效的日期（即使对应 snapshot 不是 day）。
   */
  extraHabitDates?: string[];
  /**
   * planning 列表查询使用的 size，默认与 usePlanningTasks 对齐。
   */
  limit?: number;
}

export const invalidatePlanningSnapshots = async (
  queryClient: QueryClient,
  snapshots: Array<PlanningSnapshot | null | undefined>,
  options: InvalidatePlanningOptions = {},
): Promise<void> => {
  const size = options.limit ?? PLANNING_TASK_LIST_LIMIT;
  const includeHabitActions =
    options.includeHabitActions === undefined
      ? true
      : options.includeHabitActions;

  const normalizedSnapshots = snapshots
    .map((snapshot) => normalizePlanningSnapshot(snapshot))
    .filter(
      (snapshot): snapshot is NormalizedPlanningSnapshot =>
        snapshot !== null && snapshot !== undefined,
    );

  if (normalizedSnapshots.length === 0 && !options.extraHabitDates?.length) {
    return;
  }

  const dedupedSnapshots = Array.from(
    new Map(
      normalizedSnapshots.map((snapshot) => [
        `${snapshot.planning_cycle_type}-${snapshot.planning_cycle_start_date}`,
        snapshot,
      ]),
    ).values(),
  );

  const planningInvalidations = dedupedSnapshots.flatMap((snapshot) =>
    PLANNING_TASK_FIELD_MODES.map((fieldsMode) =>
      queryClient.invalidateQueries({
        queryKey: tasksKeys.list({
          planning_cycle_type: snapshot.planning_cycle_type,
          planning_cycle_start_date: snapshot.planning_cycle_start_date,
          fields: fieldsMode,
          size,
        }),
      }),
    ),
  );

  let habitDates: string[] = options.extraHabitDates || [];
  if (includeHabitActions) {
    habitDates = [
      ...habitDates,
      ...dedupedSnapshots
        .filter((snapshot) => snapshot.planning_cycle_type === "day")
        .map((snapshot) => snapshot.planning_cycle_start_date),
    ];
  }

  const dedupedHabitDates = Array.from(new Set(habitDates)).filter(
    (date) => typeof date === "string" && date.length > 0,
  );

  const habitInvalidations = dedupedHabitDates.map((date) =>
    queryClient.invalidateQueries({
      queryKey: habitsKeys.actionsByDate(date),
    }),
  );

  await Promise.all([...planningInvalidations, ...habitInvalidations]);
};
