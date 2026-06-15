import type { QueryClient } from "@tanstack/react-query";
import { tasksKeys } from "@/services/api/queryKeys";
import type { Task } from "@/services/api/tasks";
import type { UUID } from "@/types/primitive";
import {
  isTasksListQuery,
  isTasksSelectorSourceQuery,
  type QueryLike as QueryPredicateLike,
} from "@/services/api/queryPredicates";
import {
  taskMatchesSelectorSourceFilters,
  type TaskSelectorSourceFiltersNormalized,
} from "@/services/api/taskFilters";

type QueryLike = QueryPredicateLike & {
  state: {
    data: unknown;
  };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isTaskLike = (value: unknown): value is Task => {
  return (
    isPlainObject(value) &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { content?: unknown }).content === "string"
  );
};

const deepUpsertTaskInValue = (
  value: unknown,
  task: Task,
): { result: unknown; changed: boolean } => {
  if (value === null || value === undefined) {
    return { result: value, changed: false };
  }

  if (Array.isArray(value)) {
    let nextArray: unknown[] | null = null;
    for (let i = 0; i < value.length; i += 1) {
      const item = value[i];
      const { result, changed } = deepUpsertTaskInValue(item, task);
      if (changed && !nextArray) {
        nextArray = value.slice(0, i);
      }
      if (nextArray) {
        nextArray.push(result);
      }
    }
    if (nextArray) {
      return { result: nextArray, changed: true };
    }
    return { result: value, changed: false };
  }

  if (isTaskLike(value)) {
    const originalTask = value as Task;
    let nextTask: Task = originalTask;
    let changed = false;

    if (originalTask.id === task.id) {
      nextTask = { ...originalTask, ...task };
      changed = true;
    }

    let working: Record<string, unknown> | Task = nextTask;
    Object.entries(nextTask).forEach(([key, child]) => {
      const { result, changed: childChanged } = deepUpsertTaskInValue(
        child,
        task,
      );
      if (childChanged) {
        if (working === nextTask) {
          working = { ...nextTask };
        }
        (working as Record<string, unknown>)[key] = result;
        changed = true;
      }
    });

    if (changed) {
      return { result: working as Task, changed: true };
    }
    return { result: value, changed: false };
  }

  if (isPlainObject(value)) {
    let nextObject: Record<string, unknown> | null = null;
    for (const [key, child] of Object.entries(value)) {
      const { result, changed } = deepUpsertTaskInValue(child, task);
      if (changed) {
        if (!nextObject) {
          nextObject = { ...(value as Record<string, unknown>) };
        }
        nextObject[key] = result;
      }
    }
    if (nextObject) {
      return { result: nextObject, changed: true };
    }
    return { result: value, changed: false };
  }

  return { result: value, changed: false };
};

const upsertTaskInUnknownData = (data: unknown, task: Task): unknown => {
  const { result, changed } = deepUpsertTaskInValue(data, task);
  return changed ? result : data;
};

const dataContainsTask = (value: unknown, taskId: UUID): boolean => {
  if (value === null || value === undefined) return false;

  if (Array.isArray(value)) {
    return value.some((item) => dataContainsTask(item, taskId));
  }

  if (isTaskLike(value)) {
    if ((value as Task).id === taskId) {
      return true;
    }
    return Object.values(value).some((child) =>
      dataContainsTask(child, taskId),
    );
  }

  if (isPlainObject(value)) {
    return Object.values(value).some((child) =>
      dataContainsTask(child, taskId),
    );
  }

  return false;
};

const queryContainsTask = (query: QueryLike, taskId: UUID): boolean => {
  return dataContainsTask(query.state.data, taskId);
};

const toTaskArray = (data: unknown): Task[] | null => {
  if (!Array.isArray(data)) return null;
  if (data.every(isTaskLike)) {
    return data as Task[];
  }
  return null;
};

const upsertTaskInSelectorSourceArray = (list: Task[], task: Task): Task[] => {
  let updated = false;
  const mapped = list.map((item) => {
    if (item.id === task.id) {
      updated = true;
      return { ...item, ...task };
    }
    return item;
  });
  if (updated) {
    return mapped;
  }
  return [...list, task];
};

const removeTaskFromSelectorSourceArray = (
  list: Task[],
  taskId: UUID,
): Task[] => {
  const filtered = list.filter((task) => task.id !== taskId);
  return filtered.length === list.length ? list : filtered;
};

const getSelectorSourceFiltersFromKey = (
  queryKey: unknown,
): TaskSelectorSourceFiltersNormalized => {
  if (!Array.isArray(queryKey) || queryKey.length < 3) {
    return {};
  }
  const rawFilters = queryKey[2];
  if (
    rawFilters &&
    typeof rawFilters === "object" &&
    !Array.isArray(rawFilters)
  ) {
    const filters = rawFilters as TaskSelectorSourceFiltersNormalized;
    if (filters.exclude_status) {
      return {
        exclude_status: [...filters.exclude_status],
      };
    }
    return {};
  }
  return {};
};

const applyTaskToSelectorSourceData = (
  data: unknown,
  task: Task,
  filters: TaskSelectorSourceFiltersNormalized,
): unknown => {
  const list = toTaskArray(data);
  if (!list) return data;
  if (!taskMatchesSelectorSourceFilters(task, filters)) {
    return removeTaskFromSelectorSourceArray(list, task.id);
  }
  return upsertTaskInSelectorSourceArray(list, task);
};

const removeTaskFromSelectorSourceData = (
  data: unknown,
  taskId: UUID,
): unknown => {
  const list = toTaskArray(data);
  if (!list) return data;
  return removeTaskFromSelectorSourceArray(list, taskId);
};

const syncSelectorSourceQueries = (
  queryClient: QueryClient,
  task: Task,
): void => {
  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => isTasksSelectorSourceQuery(query as QueryLike),
  }) as QueryLike[];

  queries.forEach((query) => {
    const filters = getSelectorSourceFiltersFromKey(query.queryKey);
    const currentData = query.state.data;
    const nextData = applyTaskToSelectorSourceData(currentData, task, filters);
    if (nextData !== currentData) {
      const queryKey = query.queryKey as readonly unknown[];
      queryClient.setQueryData(queryKey, nextData);
    }
  });
};

const purgeTaskFromSelectorSourceQueries = (
  queryClient: QueryClient,
  taskId: UUID,
): void => {
  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => isTasksSelectorSourceQuery(query as QueryLike),
  }) as QueryLike[];

  queries.forEach((query) => {
    const currentData = query.state.data;
    const nextData = removeTaskFromSelectorSourceData(currentData, taskId);
    if (nextData !== currentData) {
      const queryKey = query.queryKey as readonly unknown[];
      queryClient.setQueryData(queryKey, nextData);
    }
  });
};

export const invalidateTasksByIds = async (
  queryClient: QueryClient,
  taskIds: UUID[],
  options: { skipEvents?: boolean; skipLists?: boolean } = {},
): Promise<void> => {
  const uniqueTaskIds = Array.from(
    new Set(taskIds.filter((taskId): taskId is UUID => Boolean(taskId))),
  );

  if (uniqueTaskIds.length === 0) return;

  const promises: Array<Promise<unknown>> = [];

  uniqueTaskIds.forEach((taskId) => {
    promises.push(
      queryClient.invalidateQueries({ queryKey: tasksKeys.detail(taskId) }),
    );
    if (!options.skipEvents) {
      promises.push(
        queryClient.invalidateQueries({ queryKey: tasksKeys.timelogs(taskId) }),
      );
    }
  });

  if (!options.skipLists) {
    promises.push(
      queryClient.invalidateQueries({
        predicate: (query) =>
          (isTasksListQuery(query as QueryLike) ||
            isTasksSelectorSourceQuery(query as QueryLike)) &&
          uniqueTaskIds.some((taskId) =>
            queryContainsTask(query as QueryLike, taskId),
          ),
      }),
    );
  }

  await Promise.all(promises);
};

export const updateTaskCaches = (
  queryClient: QueryClient,
  task: Task,
): void => {
  if (!task?.id) return;

  queryClient.setQueryData(tasksKeys.detail(task.id), task);

  const queries = queryClient.getQueryCache().findAll({
    predicate: (query) => queryContainsTask(query as QueryLike, task.id),
  }) as QueryLike[];

  queries.forEach((query) => {
    const queryKey = query.queryKey as readonly unknown[];
    queryClient.setQueryData(queryKey, (existing: unknown) =>
      upsertTaskInUnknownData(existing, task),
    );
  });

  syncSelectorSourceQueries(queryClient, task);
};

export const removeTaskFromSelectorSourceCache = (
  queryClient: QueryClient,
  taskId: UUID,
): void => {
  if (!taskId) return;
  purgeTaskFromSelectorSourceQueries(queryClient, taskId);
};

export const invalidateAllTaskLists = async (
  queryClient: QueryClient,
): Promise<void> => {
  await queryClient.invalidateQueries({
    predicate: (query) =>
      isTasksListQuery(query as QueryLike) ||
      isTasksSelectorSourceQuery(query as QueryLike),
  });
};
