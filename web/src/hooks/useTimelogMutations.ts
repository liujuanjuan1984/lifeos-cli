import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { timelogsApi } from "@/services/api/timelogs";
import {
  isTimelogsListQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";
import {
  invalidateTimelogLists,
  invalidateTimelogsAdvancedSearch,
  removeTimelogDetailCache,
  setTimelogDetailCache,
} from "@/services/api/cacheInvalidation/timelogs";
import { useToast } from "@/contexts/ToastContext";
import type {
  TimelogCreate,
  TimelogUpdate,
  TimelogWithEnergyResponse,
  Timelog,
} from "@/services/api/timelogs";
import type { UUID } from "@/types/primitive";
import { logger } from "@/utils/core";

const mergeTimelog = <T extends Timelog>(
  existing: T[] | undefined,
  next: T,
): T[] => {
  const list = Array.isArray(existing) ? existing : [];
  const filtered = list.filter((timelog) => timelog.id !== next.id);
  return [next, ...filtered].sort(
    (a, b) =>
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );
};

const removeTimelogs = <T extends Timelog>(
  existing: T[] | undefined,
  idsToRemove: Set<UUID>,
): T[] => {
  const list = Array.isArray(existing) ? existing : [];
  if (list.length === 0) return list;
  return list.filter((timelog) => !idsToRemove.has(timelog.id));
};

/**
 * Hook for managing timelogs mutations (create, update, delete)
 */
export function useTimelogMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();

  const scheduleTimelogRefresh = (context: string) => {
    void Promise.all([
      invalidateTimelogLists(queryClient),
      invalidateTimelogsAdvancedSearch(queryClient),
    ]).catch((error) => {
      logger.warn(context, error);
    });
  };

  // Create timelog mutation
  const createMutation = useMutation({
    mutationFn: (data: TimelogCreate) => timelogsApi.create(data),
    onSuccess: (result: TimelogWithEnergyResponse) => {
      setTimelogDetailCache(queryClient, result);
      queryClient.setQueriesData(
        { predicate: (query) => isTimelogsListQuery(query as QueryLike) },
        (existing) =>
          mergeTimelog(existing as Timelog[] | undefined, result),
      );

      scheduleTimelogRefresh(
        "Failed to refresh caches after creating timelog",
      );

      // Invalidate task-related queries to refresh planning page and vision page
      // This ensures task effort totals and status updates are reflected immediately
      // without forcing every task to refetch on the network.
      toast.showSuccess(
        t("timeLog.messages.timeLogCreateSuccess"),
        t("timeLog.messages.timeLogCreateSuccessMessage", {
          title: result.title,
        }),
      );
    },
    onError: (error: Error) => {
      toast.showError(
        t("timeLog.messages.timeLogCreateFailed"),
        error.message || t("timeLog.messages.timeLogCreateFailedMessage"),
      );
    },
  });

  // Update timelog mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: UUID; data: TimelogUpdate }) =>
      timelogsApi.update(id, data),
    onSuccess: (result: Timelog) => {
      setTimelogDetailCache(queryClient, result);
      queryClient.setQueriesData(
        { predicate: (query) => isTimelogsListQuery(query as QueryLike) },
        (existing) =>
          mergeTimelog(existing as Timelog[] | undefined, result),
      );

      scheduleTimelogRefresh(
        "Failed to refresh caches after updating timelog",
      );

      // Invalidate task-related queries to refresh planning page and vision page
      toast.showSuccess(
        t("timeLog.messages.timeLogUpdateSuccess"),
        t("timeLog.messages.timeLogUpdateSuccessMessage", {
          title: result.title,
        }),
      );
    },
    onError: (error: Error) => {
      toast.showError(
        t("timeLog.messages.timeLogUpdateFailed"),
        error.message || t("timeLog.messages.timeLogUpdateFailedMessage"),
      );
    },
  });

  // Delete single timelog mutation
  const deleteMutation = useMutation({
    mutationFn: (id: UUID) => timelogsApi.delete(id),
    onSuccess: (_, eventId) => {
      removeTimelogDetailCache(queryClient, eventId);

      queryClient.setQueriesData(
        { predicate: (query) => isTimelogsListQuery(query as QueryLike) },
        (existing) =>
          removeTimelogs(
            existing as Timelog[] | undefined,
            new Set<UUID>([eventId]),
          ),
      );

      scheduleTimelogRefresh(
        "Failed to refresh caches after deleting timelog",
      );

      // Show success message
      toast.showSuccess(t("timeLog.messages.timeLogDeleteSuccess"));
    },
    onError: (error: Error) => {
      toast.showError(
        t("timeLog.messages.timeLogDeleteFailed"),
        error.message || t("timeLog.messages.timeLogDeleteFailedMessage"),
      );
    },
  });

  // Batch delete timelogs mutation
  const batchDeleteMutation = useMutation({
    mutationFn: (eventIds: UUID[]) => timelogsApi.batchDelete(eventIds),
    onSuccess: (result, eventIds) => {
      const idsToRemove = new Set<UUID>(eventIds);

      queryClient.setQueriesData(
        { predicate: (query) => isTimelogsListQuery(query as QueryLike) },
        (existing) =>
          removeTimelogs(
            existing as Timelog[] | undefined,
            idsToRemove,
          ),
      );

      scheduleTimelogRefresh(
        "Failed to refresh caches after batch deleting timelogs",
      );

      if (result.failed_ids.length > 0) {
        toast.showError(
          t("timeLog.messages.timeLogBatchDeletePartialFailed"),
          t("timeLog.messages.timeLogBatchDeletePartialFailedMessage", {
            deletedCount: result.deleted_count,
            failedCount: result.failed_ids.length,
            errors: result.errors.join(", "),
          }),
        );
      } else {
        toast.showSuccess(
          t("timeLog.messages.timeLogBatchDeleteSuccess"),
          t("timeLog.messages.timeLogBatchDeleteSuccessMessage", {
            deletedCount: result.deleted_count,
          }),
        );
      }
    },
    onError: (error: Error) => {
      toast.showError(
        t("timeLog.messages.timeLogBatchDeleteFailed"),
        error.message || t("timeLog.messages.timeLogBatchDeleteFailedMessage"),
      );
    },
  });

  // Batch create timelogs mutation
  const batchCreateMutation = useMutation({
    mutationFn: (timelogs: TimelogCreate[]) =>
      timelogsApi.batchCreate(timelogs),
    onSuccess: (result) => {
      scheduleTimelogRefresh(
        "Failed to refresh caches after batch creating timelogs",
      );

      if (result.failed_count > 0) {
        toast.showError(
          t("timeLog.messages.timeLogBatchCreatePartialFailed"),
          t("timeLog.messages.timeLogBatchCreatePartialFailedMessage", {
            createdCount: result.created_count,
            failedCount: result.failed_count,
            errors: result.errors.join(", "),
          }),
        );
      } else {
        toast.showSuccess(
          t("timeLog.messages.timeLogBatchCreateSuccess"),
          t("timeLog.messages.timeLogBatchCreateSuccessMessage", {
            createdCount: result.created_count,
          }),
        );
      }
    },
    onError: (error: Error) => {
      toast.showError(
        t("timeLog.messages.timeLogBatchCreateFailed"),
        error.message || t("timeLog.messages.timeLogBatchCreateFailedMessage"),
      );
    },
  });

  // Batch update timelogs mutation
  const batchUpdateMutation = useMutation({
    mutationFn: (params: {
      timelog_ids: UUID[];
      update_type: "persons" | "title" | "task" | "area";
      persons?: {
        mode: "add" | "replace" | "clear";
        person_ids: UUID[];
      };
      title?: {
        mode: "replace" | "find_replace";
        value: string;
        find?: string;
      };
      task?: {
        mode: "replace" | "clear";
        task_id?: UUID;
      };
      area?: {
        area_id: UUID | null;
      };
    }) => timelogsApi.batchUpdate(params),
    onSuccess: (result) => {
      scheduleTimelogRefresh(
        "Failed to refresh caches after batch updating timelogs",
      );

      // Invalidate task-related queries to refresh planning page and vision page

      // Force refetch of advanced search queries
      if (result.failed_ids.length > 0) {
        toast.showError(
          t("timeLog.messages.timeLogBatchUpdatePartialFailed"),
          t("timeLog.messages.timeLogBatchUpdatePartialFailedMessage", {
            updatedCount: result.updated_count,
            failedCount: result.failed_ids.length,
            errors: result.errors.join(", "),
          }),
        );
      } else {
        toast.showSuccess(
          t("timeLog.messages.timeLogBatchUpdateSuccess"),
          t("timeLog.messages.timeLogBatchUpdateSuccessMessage", {
            updatedCount: result.updated_count,
          }),
        );
      }
    },
    onError: (error: Error) => {
      toast.showError(
        t("timeLog.messages.timeLogBatchUpdateFailed"),
        error.message || t("timeLog.messages.timeLogBatchUpdateFailedMessage"),
      );
    },
  });

  return {
    // Individual mutations
    createTimelog: createMutation,
    updateTimelog: updateMutation,
    deleteTimelog: deleteMutation,

    // Batch mutations
    batchCreateTimelogs: batchCreateMutation,
    batchUpdateTimelogs: batchUpdateMutation,
    batchDeleteTimelogs: batchDeleteMutation,

    // Convenience methods for async operations
    createTimelogAsync: createMutation.mutateAsync,
    updateTimelogAsync: updateMutation.mutateAsync,
    deleteTimelogAsync: deleteMutation.mutateAsync,
    batchCreateTimelogsAsync: batchCreateMutation.mutateAsync,
    batchUpdateTimelogsAsync: batchUpdateMutation.mutateAsync,
    batchDeleteTimelogsAsync: batchDeleteMutation.mutateAsync,
  };
}
