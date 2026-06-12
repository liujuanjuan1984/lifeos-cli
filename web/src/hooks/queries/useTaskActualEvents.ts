import { useQuery, useQueries } from "@tanstack/react-query";
import { tasksApi } from "@/services/api/tasks";
import { tasksKeys } from "@/services/api/queryKeys";
import type { ActualEvent } from "@/services/api";
import type { UUID } from "@/types/primitive";

/**
 * Hook to fetch actual events for a single task
 */
export function useTaskActualEvents(
  taskId: UUID,
  options?: { enabled?: boolean },
) {
  const page = 1;
  const size = 100;
  return useQuery({
    queryKey: tasksKeys.events(taskId),
    queryFn: async () => {
      const response = await tasksApi.getActualEvents(taskId, page, size);
      return response.items ?? [];
    },
    enabled: options?.enabled ?? !!taskId,
    staleTime: 5 * 60 * 1000, // 5分钟缓存
  });
}

/**
 * Hook to fetch actual events for multiple tasks
 * This will create individual queries for each task and combine the results
 */
export function useMultipleTaskActualEvents(
  taskIds: UUID[],
  options?: { enabled?: boolean },
) {
  const page = 1;
  const size = 100;
  // 使用 useQueries 来并行获取多个任务的实际事件
  const queries = useQueries({
    queries: taskIds.map((taskId) => ({
      queryKey: tasksKeys.events(taskId),
      queryFn: async () => {
        const response = await tasksApi.getActualEvents(taskId, page, size);
        return response.items ?? [];
      },
      enabled: (options?.enabled ?? true) && !!taskId,
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    })),
  });

  // Combine results into a Map for easy lookup
  const taskActualEvents = new Map<UUID, ActualEvent[]>();
  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const error = queries.find((query) => query.error)?.error;

  queries.forEach((query, index) => {
    if (query.data) {
      taskActualEvents.set(taskIds[index], query.data);
    }
  });

  return {
    taskActualEvents,
    isLoading,
    isError,
    error,
    refetch: () => {
      queries.forEach((query) => query.refetch());
    },
  };
}
