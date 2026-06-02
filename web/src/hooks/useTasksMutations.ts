import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi, type TaskFieldsMode } from "@/services/api/tasks";
import { tasksKeys } from "@/services/api/queryKeys";
import { useToast } from "@/contexts/ToastContext";
import type { TaskCreate, TaskUpdate, Task } from "@/services/api/tasks";
import type { UUID } from "@/types/primitive";
import {
  invalidateVisionsHierarchy,
  invalidateAllVisionHierarchies,
  removeTaskDetailCache,
} from "@/services/api/cacheInvalidation/tasks";
import { addTaskToHierarchyCache } from "@/services/api/cacheInvalidation/visions";
import {
  invalidatePlanningSnapshots,
  type PlanningSnapshot,
} from "@/utils/query";
import {
  removeTaskFromSelectorSourceCache,
  updateTaskCaches,
} from "@/utils/query";

type PlanningAware =
  | {
      planning_cycle_type?: string | null;
      planning_cycle_start_date?: string | null;
    }
  | null
  | undefined;

const collectPlanningSnapshots = (
  previous?: PlanningAware,
  next?: PlanningAware,
): PlanningSnapshot[] => {
  const prevType = previous?.planning_cycle_type ?? null;
  const prevDate = previous?.planning_cycle_start_date ?? null;
  const nextType = next?.planning_cycle_type ?? null;
  const nextDate = next?.planning_cycle_start_date ?? null;

  if (prevType === nextType && prevDate === nextDate) {
    return [];
  }

  return [
    {
      planning_cycle_type: prevType,
      planning_cycle_start_date: prevDate,
    },
    {
      planning_cycle_type: nextType,
      planning_cycle_start_date: nextDate,
    },
  ];
};

const TASK_FIELD_MODES: TaskFieldsMode[] = ["basic", "full"];

/**
 * Hook for managing tasks mutations (create, update, delete, reorder, move)
 */
export function useTasksMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const invalidateTaskListQueries = (visionId?: UUID | null): Promise<void>[] =>
    TASK_FIELD_MODES.map(
      (mode) =>
        queryClient.invalidateQueries({
          queryKey: tasksKeys.list({
            vision_id: visionId ?? undefined,
            fields: mode,
          }),
        }) as Promise<void>,
    );

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: (data: TaskCreate) => tasksApi.create(data),
    onSuccess: async (result: Task) => {
      updateTaskCaches(queryClient, result);

      // 乐观更新：立即更新hierarchy缓存，避免loading状态
      if (result.vision_id) {
        addTaskToHierarchyCache(queryClient, result.vision_id, result);
      }

      // 精确缓存失效策略：延迟失效hierarchy，给乐观更新时间生效
      const invalidatePromises: Promise<void>[] = [];

      // 延迟200ms后失效hierarchy，确保乐观更新先显示
      setTimeout(() => {
        if (result.vision_id) {
          invalidateVisionsHierarchy(queryClient, result.vision_id);
        }
      }, 200);

      // 只在有vision_id时才失效相关的任务查询
      if (result.vision_id) {
        invalidatePromises.push(...invalidateTaskListQueries(result.vision_id));
      } else {
        invalidatePromises.push(...invalidateTaskListQueries(undefined));
      }

      const planningSnapshots = collectPlanningSnapshots(null, result);
      if (planningSnapshots.length > 0) {
        invalidatePromises.push(
          invalidatePlanningSnapshots(queryClient, planningSnapshots),
        );
      }

      await Promise.all(invalidatePromises);

      // Show success message
      toast.showSuccess("任务创建成功！", `"${result.content}" 已成功创建`);
    },
    onError: (error: Error) => {
      toast.showError("任务创建失败", error.message || "请检查输入信息后重试");
    },
  });

  // Update task mutation
  const updateMutation = useMutation<
    Task,
    Error,
    { id: UUID; data: TaskUpdate },
    { previousTask: Task | null }
  >({
    mutationFn: ({ id, data }) => tasksApi.update(id, data),
    onMutate: async ({ id }) => {
      const previousTask =
        queryClient.getQueryData<Task>(tasksKeys.detail(id)) ?? null;
      return { previousTask };
    },
    onSuccess: async (result: Task, _variables, context) => {
      updateTaskCaches(queryClient, result);

      // 精确缓存失效策略：只失效相关的查询
      const invalidatePromises: Promise<void>[] = [
        // 失效vision hierarchy
        invalidateVisionsHierarchy(queryClient, result.vision_id),
      ];

      // 只在有vision_id时才失效相关的任务查询
      if (result.vision_id) {
        invalidatePromises.push(...invalidateTaskListQueries(result.vision_id));
      } else {
        // 如果是无vision的任务，失效全量任务查询
        invalidatePromises.push(...invalidateTaskListQueries(undefined));
      }

      const planningSnapshots = collectPlanningSnapshots(
        context?.previousTask,
        result,
      );
      if (planningSnapshots.length > 0) {
        invalidatePromises.push(
          invalidatePlanningSnapshots(queryClient, planningSnapshots),
        );
      }

      await Promise.all(invalidatePromises);

      // Show success message
      toast.showSuccess("任务更新成功！", `"${result.content}" 已成功更新`);
    },
    onError: (error: Error) => {
      toast.showError("任务更新失败", error.message || "请检查输入信息后重试");
    },
  });

  // Update task status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: UUID; status: string }) =>
      tasksApi.updateStatus(id, status),
    onSuccess: async (result: Task) => {
      updateTaskCaches(queryClient, result);

      // 精确缓存失效策略：只失效相关的查询
      const invalidatePromises = [
        // 失效vision hierarchy
        invalidateVisionsHierarchy(queryClient, result.vision_id),
      ];

      // 只在有vision_id时才失效相关的任务查询
      if (result.vision_id) {
        invalidatePromises.push(...invalidateTaskListQueries(result.vision_id));
      } else {
        // 如果是无vision的任务，失效全量任务查询
        invalidatePromises.push(...invalidateTaskListQueries(undefined));
      }

      await Promise.all(invalidatePromises);

      // Show success message
      toast.showSuccess(
        "任务状态更新成功！",
        `"${result.content}" 状态已更新为 ${result.status}`,
      );
    },
    onError: (error: Error) => {
      toast.showError("任务状态更新失败", error.message || "请稍后重试");
    },
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: UUID }) => tasksApi.delete(id),
    onSuccess: async (_, variables) => {
      const cachedTask =
        queryClient.getQueryData<Task>(tasksKeys.detail(variables.id)) ?? null;
      removeTaskDetailCache(queryClient, variables.id);
      removeTaskFromSelectorSourceCache(queryClient, variables.id);

      // 精确缓存失效策略：只失效相关的查询
      const invalidatePromises: Promise<void>[] = [];

      if (cachedTask) {
        // 有缓存信息时，只失效相关vision的查询
        invalidatePromises.push(
          invalidateVisionsHierarchy(queryClient, cachedTask.vision_id),
        );

        // 只在有vision_id时才失效相关的任务查询
        if (cachedTask.vision_id) {
          invalidatePromises.push(
            ...invalidateTaskListQueries(cachedTask.vision_id),
          );
        } else {
          // 如果是无vision的任务，失效全量任务查询
          invalidatePromises.push(...invalidateTaskListQueries(undefined));
        }
      } else {
        // 无缓存信息时的fallback策略
        invalidatePromises.push(invalidateAllVisionHierarchies(queryClient));
      }

      const planningSnapshots = collectPlanningSnapshots(cachedTask, null);
      if (planningSnapshots.length > 0) {
        invalidatePromises.push(
          invalidatePlanningSnapshots(queryClient, planningSnapshots),
        );
      }

      await Promise.all(invalidatePromises);

      // Show success message
      toast.showSuccess("任务删除成功！");
    },
    onError: (error: Error) => {
      toast.showError("任务删除失败", error.message || "请稍后重试");
    },
  });

  // Reorder tasks mutation
  const reorderMutation = useMutation({
    mutationFn: (taskOrders: { id: UUID; display_order: number }[]) =>
      tasksApi.reorder(taskOrders),
    onSuccess: async (_result, taskOrders) => {
      // 聚合受影响的 vision，避免全量 hierarchy 失效
      const affectedVisionIds = new Set<UUID | null>();
      taskOrders.forEach(({ id }) => {
        const cachedTask = queryClient.getQueryData<Task>(tasksKeys.detail(id));
        if (cachedTask?.vision_id) {
          affectedVisionIds.add(cachedTask.vision_id);
        }
      });

      if (affectedVisionIds.size > 0) {
        await Promise.all(
          Array.from(affectedVisionIds).map((visionId) =>
            invalidateVisionsHierarchy(queryClient, visionId),
          ),
        );
      } else {
        // 无法推断受影响的愿景时，保留原有 fallback
        await invalidateAllVisionHierarchies(queryClient);
      }

      // Show success message
      toast.showSuccess("任务排序更新成功！");
    },
    onError: (error: Error) => {
      toast.showError("任务排序更新失败", error.message || "请稍后重试");
    },
  });

  // Move task mutation
  const moveMutation = useMutation({
    mutationFn: ({
      id,
      oldParentTaskId,
      newParentTaskId,
      newVisionId,
      newDisplayOrder,
    }: {
      id: UUID;
      oldParentTaskId?: UUID;
      newParentTaskId?: UUID;
      newVisionId?: UUID;
      newDisplayOrder?: number;
    }) =>
      tasksApi.move(
        id,
        oldParentTaskId,
        newParentTaskId,
        newVisionId,
        newDisplayOrder,
      ),
    onSuccess: async (result: Task) => {
      const previousTask = queryClient.getQueryData<Task>(
        tasksKeys.detail(result.id),
      );
      updateTaskCaches(queryClient, result);

      // 精确缓存失效策略：只失效相关的查询
      const invalidatePromises: Promise<void>[] = [
        // 失效新vision hierarchy
        invalidateVisionsHierarchy(queryClient, result.vision_id),
      ];

      // 只在新vision存在时才失效相关的任务查询
      if (result.vision_id) {
        invalidatePromises.push(...invalidateTaskListQueries(result.vision_id));
      } else {
        // 如果新任务无vision，失效全量任务查询
        invalidatePromises.push(...invalidateTaskListQueries(undefined));
      }

      const previousVisionId = previousTask?.vision_id || null;
      if (previousVisionId && previousVisionId !== result.vision_id) {
        // 如果vision发生变化，也失效旧vision的相关查询
        invalidatePromises.push(
          invalidateVisionsHierarchy(queryClient, previousVisionId),
        );

        // 只在旧vision存在时才失效任务查询
        if (previousVisionId) {
          invalidatePromises.push(
            ...invalidateTaskListQueries(previousVisionId),
          );
        }
      }

      await Promise.all(invalidatePromises);

      // Show success message
      toast.showSuccess("任务移动成功！", `"${result.content}" 已成功移动`);
    },
    onError: (error: Error) => {
      toast.showError("任务移动失败", error.message || "请稍后重试");
    },
  });

  return {
    // Individual mutations
    createTask: createMutation,
    updateTask: updateMutation,
    updateTaskStatus: updateStatusMutation,
    deleteTask: deleteMutation,
    reorderTasks: reorderMutation,
    moveTask: moveMutation,

    // Convenience methods for async operations
    createTaskAsync: createMutation.mutateAsync,
    updateTaskAsync: updateMutation.mutateAsync,
    updateTaskStatusAsync: updateStatusMutation.mutateAsync,
    deleteTaskAsync: deleteMutation.mutateAsync,
    reorderTasksAsync: reorderMutation.mutateAsync,
    moveTaskAsync: moveMutation.mutateAsync,
  };
}
