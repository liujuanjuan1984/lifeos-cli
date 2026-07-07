import type { QueryClient } from "@tanstack/react-query";
import { invalidateHabitActionWindows } from "@/services/api/cacheInvalidation/habits";
import { tasksKeys } from "@/services/api/queryKeys";
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

export const invalidatePlanningSnapshots = async (
  queryClient: QueryClient,
  snapshots: Array<PlanningSnapshot | null | undefined>,
): Promise<void> => {
  const normalizedSnapshots = snapshots
    .map((snapshot) => normalizePlanningSnapshot(snapshot))
    .filter(
      (snapshot): snapshot is NormalizedPlanningSnapshot =>
        snapshot !== null && snapshot !== undefined,
    );

  if (normalizedSnapshots.length === 0) {
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
          size: PLANNING_TASK_LIST_LIMIT,
        }),
      }),
    ),
  );

  const habitInvalidations = dedupedSnapshots.some(
    (snapshot) => snapshot.planning_cycle_type === "day",
  )
    ? [invalidateHabitActionWindows(queryClient)]
    : [];

  await Promise.all([...planningInvalidations, ...habitInvalidations]);
};
