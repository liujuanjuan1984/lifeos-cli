import { useQuery, useQueries } from "@tanstack/react-query";
import { tasksApi } from "@/services/api/tasks";
import { tasksKeys } from "@/services/api/queryKeys";
import type { Timelog } from "@/services/api";
import type { UUID } from "@/types/primitive";

/**
 * Hook to fetch timelogs for a single task
 */
export function useTaskTimelogs(
  taskId: UUID,
  options?: { enabled?: boolean },
) {
  const page = 1;
  const size = 100;
  return useQuery({
    queryKey: tasksKeys.timelogs(taskId),
    queryFn: async () => {
      const response = await tasksApi.getTimelogs(taskId, page, size);
      return response.items ?? [];
    },
    enabled: options?.enabled ?? !!taskId,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

/**
 * Hook to fetch timelogs for multiple tasks
 * This will create individual queries for each task and combine the results
 */
export function useMultipleTaskTimelogs(
  taskIds: UUID[],
  options?: { enabled?: boolean },
) {
  const page = 1;
  const size = 100;
  // 使用 useQueries 来并行获取多个任务的实际事件
  const queries = useQueries({
    queries: taskIds.map((taskId) => ({
      queryKey: tasksKeys.timelogs(taskId),
      queryFn: async () => {
        const response = await tasksApi.getTimelogs(taskId, page, size);
        return response.items ?? [];
      },
      enabled: (options?.enabled ?? true) && !!taskId,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    })),
  });

  // Combine results into a Map for easy lookup
  const taskTimelogs = new Map<UUID, Timelog[]>();
  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const error = queries.find((query) => query.error)?.error;

  queries.forEach((query, index) => {
    if (query.data) {
      taskTimelogs.set(taskIds[index], query.data);
    }
  });

  return {
    taskTimelogs,
    isLoading,
    isError,
    error,
    refetch: () => {
      queries.forEach((query) => query.refetch());
    },
  };
}
