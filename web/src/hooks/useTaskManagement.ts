import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Task, TaskWithSubtasks, Vision } from "@/services/api";
import type { TimelogWithEnergyResponse } from "@/services/api/timelogs";
import { tasksApi } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";
import type { UUID } from "@/types/primitive";
import {
  invalidateTasksByIds,
  updateTaskCaches,
  updateTaskRelationshipCounts,
} from "@/utils/query";
import { tasksKeys } from "@/services/api/queryKeys";
import { createModalSessionId } from "@/utils/session";

type TaskUpdateSummary = {
  id: UUID;
  vision_id: UUID | null;
  parent_task_id: UUID | null;
} & Partial<Omit<Task, "id" | "vision_id" | "parent_task_id">>;

interface TaskMutationResultPayload {
  updatedTask?: TaskUpdateSummary;
  structureChanged?: boolean;
  visionChanged?: boolean;
  parentTaskStatusChanged?: {
    taskId: UUID;
    oldStatus: string;
    newStatus: string;
  };
  visionIdHint?: UUID | null;
}

// 定义任务保存结果的类型
interface TaskSaveResult {
  updatedTask?: TaskUpdateSummary;
  structureChanged?: boolean;
  visionChanged?: boolean;
  parentTaskStatusChanged?: {
    taskId: UUID;
    oldStatus: string;
    newStatus: string;
  };
  sessionId?: string;
}

export interface TaskManagementConfig {
  onTaskUpdate?: () => void; // 任务更新后的回调
  onNoteCreated?: () => void; // 创建笔记后的回调（默认不刷新，由调用方决定）
  visionId?: UUID; // 可选的愿景ID，用于某些操作
  allVisions?: Vision[]; // 所有可用的愿景列表
  allTasks?: TaskWithSubtasks[]; // 所有任务列表，用于父任务选择
  // VisionManager 特殊需求
  onTaskUpdateWithVisionId?: (visionId: UUID) => void; // 带愿景ID的任务更新回调
  getFlattenedTasks?: (tasks: TaskWithSubtasks[]) => TaskWithSubtasks[]; // 扁平化任务树的函数
  onTaskAttributesUpdate?: (task: TaskUpdateSummary) => void;
  onTaskStructureChange?: (
    payload: TaskMutationResultPayload & {
      previousVisionId: UUID | null;
    },
  ) => void;
}

interface TaskManagementState {
  // 编辑相关状态
  editingTask: TaskWithSubtasks | null;
  isEditModalOpen: boolean;
  editModalSessionId: string | null;

  // 删除相关状态
  deletingTask: TaskWithSubtasks | null;
  isDeleteConfirmOpen: boolean;

  // 时间记录相关状态
  viewingTimeRecords: TaskWithSubtasks | null;
  isTimeRecordsModalOpen: boolean;

  // 笔记相关状态
  viewingNotes: TaskWithSubtasks | null;
  isNotesModalOpen: boolean;

  // 创建笔记相关状态
  creatingNoteForTask: TaskWithSubtasks | null;
  isCreateNoteModalOpen: boolean;

  // Timelog creation state
  creatingTimelogForTask: TaskWithSubtasks | null;
  isCreateTimelogModalOpen: boolean;

  // 创建子任务相关状态
  creatingSubtask: boolean;
  parentTaskId: UUID | null;
}

interface TaskManagementActions {
  // 任务编辑
  handleEditTask: (task: TaskWithSubtasks) => void;
  handleTaskSave: (result?: TaskSaveResult) => void;
  closeEditModal: (context?: { sessionId?: string }) => void;

  // 任务删除
  handleDeleteTask: (task: TaskWithSubtasks) => void;
  confirmDeleteTask: () => void;
  closeDeleteConfirm: () => void;

  // 状态更新
  handleStatusUpdate: (
    task: TaskWithSubtasks,
    newStatus: string,
  ) => Promise<void>;

  // 添加子任务
  handleAddSubtask: (parentId?: UUID | null) => void;

  // 查看时间记录
  handleViewTimeRecords: (task: TaskWithSubtasks) => void;
  closeTimeRecordsModal: () => void;

  // 查看笔记
  handleViewNotes: (task: TaskWithSubtasks) => void;
  closeNotesModal: () => void;

  // 创建笔记
  handleOpenCreateNoteModal: (task: TaskWithSubtasks) => void;
  closeCreateNoteModal: () => void;
  handleNoteCreated: () => void;

  // Timelog creation
  handleOpenCreateTimelogModal: (task: TaskWithSubtasks) => void;
  closeCreateTimelogModal: () => void;
  handleTimelogCreated: (result: TimelogWithEnergyResponse) => void;

  // 任务重排序
  handleTasksReorder: (reorderedTasks: TaskWithSubtasks[]) => Promise<void>;
}

/**
 * 通用的任务管理 hook
 *
 * 提供任务编辑、删除、状态更新、添加子任务、查看时间记录、重排序等功能
 * 可以在不同的组件中复用，避免代码重复
 */
export const useTaskManagement = (config: TaskManagementConfig = {}) => {
  const {
    onTaskUpdate,
    onNoteCreated,
    visionId,
    allVisions: _allVisions = [],
    allTasks = [],
    onTaskUpdateWithVisionId,
    getFlattenedTasks: _getFlattenedTasks,
    onTaskAttributesUpdate,
    onTaskStructureChange,
  } = config;
  const toast = useToast();
  const queryClient = useQueryClient();

  const triggerAttributesUpdate = useCallback(
    (task: TaskUpdateSummary) => {
      if (onTaskAttributesUpdate) {
        onTaskAttributesUpdate(task);
        return;
      }
      if (onTaskUpdateWithVisionId && visionId) {
        onTaskUpdateWithVisionId(visionId);
        return;
      }
      onTaskUpdate?.();
    },
    [onTaskAttributesUpdate, onTaskUpdateWithVisionId, visionId, onTaskUpdate],
  );

  const triggerStructureChange = useCallback(
    (
      payload: TaskMutationResultPayload & { previousVisionId: UUID | null },
    ) => {
      let handled = false;
      if (onTaskStructureChange) {
        onTaskStructureChange(payload);
        handled = true;
      }
      if (onTaskUpdateWithVisionId && visionId) {
        onTaskUpdateWithVisionId(visionId);
        handled = true;
      }
      if (!handled) {
        onTaskUpdate?.();
      }
    },
    [onTaskStructureChange, onTaskUpdateWithVisionId, visionId, onTaskUpdate],
  );

  // 任务删除 mutation
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: UUID) => tasksApi.delete(taskId),
    onSuccess: async (_, taskId) => {
      toast.showSuccess("任务删除成功", "任务已成功删除");
      if (onTaskUpdateWithVisionId && visionId) {
        onTaskUpdateWithVisionId(visionId);
      } else {
        onTaskUpdate?.();
      }
      queryClient.removeQueries({
        queryKey: tasksKeys.detail(taskId),
        exact: true,
      });
      await invalidateTasksByIds(queryClient, [taskId], { skipEvents: true });
    },
    onError: (error: Error) => {
      toast.showError("删除任务失败", "删除任务时遇到问题，请稍后重试");
      console.error("Delete task error:", error);
    },
  });

  // 任务状态更新 mutation
  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: UUID; status: string }) =>
      tasksApi.updateStatus(taskId, status),
    onSuccess: async (updatedTask: Task) => {
      toast.showSuccess("任务状态更新成功", "任务状态已成功更新");
      const normalizedTask: TaskUpdateSummary = {
        ...updatedTask,
        parent_task_id: updatedTask.parent_task_id ?? null,
      };
      triggerAttributesUpdate(normalizedTask);
      updateTaskCaches(queryClient, updatedTask);
      await invalidateTasksByIds(queryClient, [updatedTask.id], {
        skipEvents: true,
      });
    },
    onError: (error: Error) => {
      toast.showError("更新任务状态失败", "更新任务状态时遇到问题，请稍后重试");
      console.error("Update task status error:", error);
    },
  });

  // 任务重排序 mutation
  const reorderTasksMutation = useMutation({
    mutationFn: (taskOrders: Array<{ id: UUID; display_order: number }>) =>
      tasksApi.reorder(taskOrders),
    onSuccess: async (_result, taskOrders) => {
      toast.showSuccess("任务顺序更新成功", "任务顺序已成功更新");
      if (onTaskUpdateWithVisionId && visionId) {
        onTaskUpdateWithVisionId(visionId);
      } else {
        onTaskUpdate?.();
      }
      const reorderedIds = taskOrders.map((order) => order.id);
      if (reorderedIds.length > 0) {
        await invalidateTasksByIds(queryClient, reorderedIds, {
          skipEvents: true,
        });
      }
    },
    onError: (error: Error) => {
      toast.showError("更新任务顺序失败", "更新任务顺序时遇到问题，请稍后重试");
      console.error("Reorder tasks error:", error);
    },
  });

  // 状态管理
  const [state, setState] = useState<TaskManagementState>({
    editingTask: null,
    isEditModalOpen: false,
    editModalSessionId: null,
    deletingTask: null,
    isDeleteConfirmOpen: false,
    viewingTimeRecords: null,
    isTimeRecordsModalOpen: false,
    viewingNotes: null,
    isNotesModalOpen: false,
    creatingNoteForTask: null,
    isCreateNoteModalOpen: false,
    creatingTimelogForTask: null,
    isCreateTimelogModalOpen: false,
    creatingSubtask: false,
    parentTaskId: null,
  });

  // 任务编辑处理
  const handleEditTask = useCallback((task: TaskWithSubtasks) => {
    const sessionId = createModalSessionId();
    setState((prev) => ({
      ...prev,
      editingTask: task,
      isEditModalOpen: true,
      creatingSubtask: false,
      parentTaskId: null,
      editModalSessionId: sessionId,
    }));
  }, []);

  // 任务编辑保存处理
  const handleTaskSave = useCallback(
    (result?: TaskSaveResult) => {
      if (
        state.editModalSessionId &&
        result?.sessionId &&
        result.sessionId !== state.editModalSessionId
      ) {
        return;
      }

      const previousVisionId = state.editingTask?.vision_id ?? visionId ?? null;

      setState((prev) => ({
        ...prev,
        isEditModalOpen: false,
        editingTask: null,
        creatingSubtask: false,
        parentTaskId: null,
        editModalSessionId: null,
      }));

      if (!result) {
        return;
      }

      if (result.structureChanged || result.visionChanged) {
        const payload: TaskMutationResultPayload & {
          previousVisionId: UUID | null;
        } = {
          updatedTask: result.updatedTask
            ? {
                ...result.updatedTask,
                vision_id: result.updatedTask.vision_id ?? previousVisionId,
                parent_task_id: result.updatedTask.parent_task_id ?? null,
              }
            : undefined,
          structureChanged: result.structureChanged,
          visionChanged: result.visionChanged,
          parentTaskStatusChanged: result.parentTaskStatusChanged,
          previousVisionId,
          visionIdHint:
            result.updatedTask?.vision_id ??
            visionId ??
            previousVisionId ??
            null,
        };
        triggerStructureChange(payload);
        return;
      }

      if (result.updatedTask) {
        const normalizedTask: TaskUpdateSummary = {
          ...result.updatedTask,
          vision_id: result.updatedTask.vision_id ?? previousVisionId,
          parent_task_id: result.updatedTask.parent_task_id ?? null,
        };
        triggerAttributesUpdate(normalizedTask);
      }
    },
    [state, visionId, triggerStructureChange, triggerAttributesUpdate],
  );

  // 关闭编辑模态框
  const closeEditModal = useCallback((context?: { sessionId?: string }) => {
    setState((prev) => {
      if (
        prev.editModalSessionId &&
        context?.sessionId &&
        context.sessionId !== prev.editModalSessionId
      ) {
        return prev;
      }

      return {
        ...prev,
        isEditModalOpen: false,
        editingTask: null,
        creatingSubtask: false,
        parentTaskId: null,
        editModalSessionId: null,
      };
    });
  }, []);

  // 任务删除处理
  const handleDeleteTask = useCallback((task: TaskWithSubtasks) => {
    setState((prev) => ({
      ...prev,
      deletingTask: task,
      isDeleteConfirmOpen: true,
    }));
  }, []);

  // 确认删除任务
  const confirmDeleteTask = useCallback(() => {
    if (!state.deletingTask) return;

    const taskId = state.deletingTask.id;

    setState((prev) => ({
      ...prev,
      isDeleteConfirmOpen: false,
      deletingTask: null,
    }));

    deleteTaskMutation.mutate(taskId);
  }, [state.deletingTask, deleteTaskMutation]);

  // 关闭删除确认对话框
  const closeDeleteConfirm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isDeleteConfirmOpen: false,
      deletingTask: null,
    }));
  }, []);

  // 状态更新处理
  const handleStatusUpdate = useCallback(
    async (task: TaskWithSubtasks, newStatus: string) => {
      // 保存当前滚动位置和焦点
      const activeElement = document.activeElement as HTMLElement | null;
      const activeElementRole = activeElement?.getAttribute("role");
      const shouldRestoreFocus =
        Boolean(activeElement) &&
        activeElement !== document.body &&
        activeElementRole !== "combobox";
      const savedPosition = {
        scrollY: window.scrollY,
        scrollX: window.scrollX,
        activeElement: shouldRestoreFocus ? activeElement : null,
      };

      updateTaskStatusMutation.mutate(
        { taskId: task.id, status: newStatus },
        {
          onSuccess: () => {
            // 恢复滚动位置和焦点
            requestAnimationFrame(() => {
              window.scrollTo(savedPosition.scrollX, savedPosition.scrollY);
              if (savedPosition.activeElement?.focus) {
                savedPosition.activeElement.focus();
              }
            });
          },
        },
      );
    },
    [updateTaskStatusMutation],
  );

  // 添加子任务处理
  const handleAddSubtask = useCallback(
    (parentId?: UUID | null) => {
      const sessionId = createModalSessionId();
      if (!parentId) {
        // Allow creating a brand-new root task when no parent is provided
        setState((prev) => ({
          ...prev,
          editingTask: null,
          isEditModalOpen: true,
          creatingSubtask: false,
          parentTaskId: null,
          editModalSessionId: sessionId,
        }));
        return;
      }

      const parentTask = allTasks.find((task) => task.id === parentId);
      if (parentTask) {
        // 对于新任务，我们不创建完整的 TaskWithSubtasks 对象
        // 而是使用 null 来表示新任务，让 TaskEditModal 处理
        setState((prev) => ({
          ...prev,
          editingTask: null, // 使用 null 表示新任务
          isEditModalOpen: true,
          creatingSubtask: true,
          parentTaskId: parentId,
          editModalSessionId: sessionId,
        }));
        return;
      }

      console.warn(
        `[useTaskManagement] Parent task ${parentId} not found. Falling back to root task creation.`,
      );
      setState((prev) => ({
        ...prev,
        editingTask: null,
        isEditModalOpen: true,
        creatingSubtask: false,
        parentTaskId: null,
        editModalSessionId: sessionId,
      }));
    },
    [allTasks],
  );

  // 查看时间记录处理
  const handleViewTimeRecords = useCallback((task: TaskWithSubtasks) => {
    setState((prev) => ({
      ...prev,
      viewingTimeRecords: task,
      isTimeRecordsModalOpen: true,
    }));
  }, []);

  // 关闭时间记录模态框
  const closeTimeRecordsModal = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isTimeRecordsModalOpen: false,
      viewingTimeRecords: null,
    }));
  }, []);

  // 查看笔记处理
  const handleViewNotes = useCallback((task: TaskWithSubtasks) => {
    setState((prev) => ({
      ...prev,
      viewingNotes: task,
      isNotesModalOpen: true,
    }));
  }, []);

  // 关闭笔记模态框
  const closeNotesModal = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isNotesModalOpen: false,
      viewingNotes: null,
    }));
  }, []);

  // 创建新笔记的处理
  const handleOpenCreateNoteModal = useCallback((task: TaskWithSubtasks) => {
    setState((prev) => ({
      ...prev,
      creatingNoteForTask: task,
      isCreateNoteModalOpen: true,
    }));
  }, []);

  // 仅关闭创建笔记模态框（不刷新）
  const closeCreateNoteModal = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isCreateNoteModalOpen: false,
      creatingNoteForTask: null,
    }));
  }, []);

  // 笔记成功创建：关闭并回调（默认不触发全局刷新）
  const handleNoteCreated = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isCreateNoteModalOpen: false,
      creatingNoteForTask: null,
    }));
    if (onNoteCreated) {
      onNoteCreated();
    }
  }, [onNoteCreated]);

  const handleOpenCreateTimelogModal = useCallback((task: TaskWithSubtasks) => {
    setState((prev) => ({
      ...prev,
      creatingTimelogForTask: task,
      isCreateTimelogModalOpen: true,
    }));
  }, []);

  const closeCreateTimelogModal = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isCreateTimelogModalOpen: false,
      creatingTimelogForTask: null,
    }));
  }, []);

  const handleTimelogCreated = useCallback(
    (result: TimelogWithEnergyResponse) => {
      const taskId =
        result.task?.id ??
        result.task_id ??
        state.creatingTimelogForTask?.id ??
        null;

      setState((prev) => ({
        ...prev,
        isCreateTimelogModalOpen: false,
        creatingTimelogForTask: null,
      }));

      if (!taskId) {
        onTaskUpdate?.();
        return;
      }

      updateTaskRelationshipCounts(queryClient, taskId, {
        timelogs_count: (current) => Math.max(1, current + 1),
      });

      void invalidateTasksByIds(queryClient, [taskId]).catch((error) => {
        console.warn("Failed to refresh task after creating timelog:", error);
      });
      onTaskUpdate?.();
    },
    [onTaskUpdate, queryClient, state.creatingTimelogForTask?.id],
  );

  // 任务重排序处理
  const handleTasksReorder = useCallback(
    async (reorderedTasks: TaskWithSubtasks[]) => {
      // Empty payload indicates cross-level moves from DraggableTaskList; force a full refresh
      if (reorderedTasks.length === 0) {
        triggerStructureChange({
          updatedTask: undefined,
          structureChanged: true,
          visionChanged: false,
          previousVisionId: visionId ?? null,
          visionIdHint: visionId ?? null,
        });
        return;
      }

      const taskOrders = reorderedTasks.map((task, index) => ({
        id: task.id,
        display_order: index,
      }));
      reorderTasksMutation.mutate(taskOrders);
    },
    [reorderTasksMutation, triggerStructureChange, visionId],
  );

  // 返回状态和操作
  const actions: TaskManagementActions = {
    handleEditTask,
    handleTaskSave,
    closeEditModal,
    handleDeleteTask,
    confirmDeleteTask,
    closeDeleteConfirm,
    handleStatusUpdate,
    handleAddSubtask,
    handleViewTimeRecords,
    closeTimeRecordsModal,
    handleViewNotes,
    closeNotesModal,
    handleOpenCreateNoteModal,
    closeCreateNoteModal,
    handleNoteCreated,
    handleOpenCreateTimelogModal,
    closeCreateTimelogModal,
    handleTimelogCreated,
    handleTasksReorder,
  };

  return {
    state,
    actions,
    // 便捷的状态访问
    editingTask: state.editingTask,
    isEditModalOpen: state.isEditModalOpen,
    editModalSessionId: state.editModalSessionId,
    deletingTask: state.deletingTask,
    isDeleteConfirmOpen: state.isDeleteConfirmOpen,
    viewingTimeRecords: state.viewingTimeRecords,
    isTimeRecordsModalOpen: state.isTimeRecordsModalOpen,
    viewingNotes: state.viewingNotes,
    isNotesModalOpen: state.isNotesModalOpen,
    creatingNoteForTask: state.creatingNoteForTask,
    isCreateNoteModalOpen: state.isCreateNoteModalOpen,
    creatingTimelogForTask: state.creatingTimelogForTask,
    isCreateTimelogModalOpen: state.isCreateTimelogModalOpen,
    creatingSubtask: state.creatingSubtask,
    parentTaskId: state.parentTaskId,
  };
};

export type { TaskUpdateSummary, TaskMutationResultPayload };
