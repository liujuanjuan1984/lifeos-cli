import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionApi } from "@/services/api/session";
import {
  invalidateSessionDetail,
  invalidateSessionLists,
} from "@/services/api/cacheInvalidation/sessions";
import { useToast } from "@/contexts/ToastContext";
import type {
  CreateSessionRequest,
  UpdateSessionRequest,
} from "@/types/session";
import type { UUID } from "@/types/primitive";

/**
 * Hook for managing sessions mutations (create, update, delete)
 */
export function useSessionsMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();

  // Create session mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateSessionRequest) => sessionApi.createSession(data),
    onSuccess: (result) => {
      invalidateSessionLists(queryClient);

      // Show success message
      toast.showSuccess("会话创建成功！", `"${result.name}" 已成功创建`);
    },
    onError: (error: Error) => {
      toast.showError("会话创建失败", error.message || "请检查输入信息后重试");
    },
  });

  // Update session mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: UUID; data: UpdateSessionRequest }) =>
      sessionApi.updateSession(id, data),
    onSuccess: (result) => {
      invalidateSessionLists(queryClient);
      invalidateSessionDetail(queryClient, result.id);

      // Show success message
      toast.showSuccess("会话更新成功！", `"${result.name}" 已成功更新`);
    },
    onError: (error: Error) => {
      toast.showError("会话更新失败", error.message || "请检查输入信息后重试");
    },
  });

  // Delete session mutation
  const deleteMutation = useMutation({
    mutationFn: (sessionId: UUID) => sessionApi.deleteSession(sessionId),
    onSuccess: () => {
      invalidateSessionLists(queryClient);

      // Show success message
      toast.showSuccess("会话删除成功！");
    },
    onError: (error: Error) => {
      toast.showError("会话删除失败", error.message || "请稍后重试");
    },
  });

  return {
    // Individual mutations
    createSession: createMutation,
    updateSession: updateMutation,
    deleteSession: deleteMutation,

    // Convenience methods for async operations
    createSessionAsync: createMutation.mutateAsync,
    updateSessionAsync: updateMutation.mutateAsync,
    deleteSessionAsync: deleteMutation.mutateAsync,
  };
}
