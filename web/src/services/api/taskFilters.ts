import type { Task } from "./tasks";

export interface TaskSelectorSourceFiltersInput {
  exclude_status?: string[] | null | undefined;
}

export interface TaskSelectorSourceFiltersNormalized {
  exclude_status?: string[];
}

const normalizeStatusList = (
  statuses?: string[] | null,
): string[] | undefined => {
  if (!statuses || statuses.length === 0) {
    return undefined;
  }
  const normalized = Array.from(
    new Set(
      statuses
        .map((status) => (typeof status === "string" ? status.trim() : ""))
        .filter((status): status is string => status.length > 0),
    ),
  ).sort();

  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeTaskSelectorSourceFilters = (
  input?: TaskSelectorSourceFiltersInput | null,
): TaskSelectorSourceFiltersNormalized => {
  return {
    exclude_status: normalizeStatusList(input?.exclude_status),
  };
};

export const taskMatchesSelectorSourceFilters = (
  task: Task,
  filters: TaskSelectorSourceFiltersNormalized,
): boolean => {
  if ((task as { deleted_at?: string | null }).deleted_at) {
    return false;
  }
  if (filters.exclude_status?.length) {
    return !filters.exclude_status.includes(task.status);
  }
  return true;
};
