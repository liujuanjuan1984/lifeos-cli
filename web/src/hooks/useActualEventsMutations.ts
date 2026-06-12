import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { actualEventsApi } from "@/services/api/actualEvents";
import {
  isActualEventsListQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";
import {
  invalidateActualEventLists,
  invalidateActualEventsAdvancedSearch,
  removeActualEventDetailCache,
  setActualEventDetailCache,
} from "@/services/api/cacheInvalidation/actualEvents";
import { useToast } from "@/contexts/ToastContext";
import type {
  ActualEventCreate,
  ActualEventUpdate,
  ActualEventWithEnergyResponse,
  ActualEvent,
} from "@/services/api/actualEvents";
import type { UUID } from "@/types/primitive";
import { logger } from "@/utils/core";

const mergeActualEvent = <T extends ActualEvent>(
  existing: T[] | undefined,
  next: T,
): T[] => {
  const list = Array.isArray(existing) ? existing : [];
  const filtered = list.filter((event) => event.id !== next.id);
  return [next, ...filtered].sort(
    (a, b) =>
      new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );
};

const removeActualEvents = <T extends ActualEvent>(
  existing: T[] | undefined,
  idsToRemove: Set<UUID>,
): T[] => {
  const list = Array.isArray(existing) ? existing : [];
  if (list.length === 0) return list;
  return list.filter((event) => !idsToRemove.has(event.id));
};

/**
 * Hook for managing actual events mutations (create, update, delete)
 */
export function useActualEventsMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();

  const scheduleActualEventRefresh = (context: string) => {
    void Promise.all([
      invalidateActualEventLists(queryClient),
      invalidateActualEventsAdvancedSearch(queryClient),
    ]).catch((error) => {
      logger.warn(context, error);
    });
  };

  // Create actual event mutation
  const createMutation = useMutation({
    mutationFn: (data: ActualEventCreate) => actualEventsApi.create(data),
    onSuccess: (result: ActualEventWithEnergyResponse) => {
      setActualEventDetailCache(queryClient, result);
      queryClient.setQueriesData(
        { predicate: (query) => isActualEventsListQuery(query as QueryLike) },
        (existing) =>
          mergeActualEvent(existing as ActualEvent[] | undefined, result),
      );

      scheduleActualEventRefresh(
        "Failed to refresh caches after creating actual event",
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

  // Update actual event mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: UUID; data: ActualEventUpdate }) =>
      actualEventsApi.update(id, data),
    onSuccess: (result: ActualEvent) => {
      setActualEventDetailCache(queryClient, result);
      queryClient.setQueriesData(
        { predicate: (query) => isActualEventsListQuery(query as QueryLike) },
        (existing) =>
          mergeActualEvent(existing as ActualEvent[] | undefined, result),
      );

      scheduleActualEventRefresh(
        "Failed to refresh caches after updating actual event",
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

  // Delete single actual event mutation
  const deleteMutation = useMutation({
    mutationFn: (id: UUID) => actualEventsApi.delete(id),
    onSuccess: (_, eventId) => {
      removeActualEventDetailCache(queryClient, eventId);

      queryClient.setQueriesData(
        { predicate: (query) => isActualEventsListQuery(query as QueryLike) },
        (existing) =>
          removeActualEvents(
            existing as ActualEvent[] | undefined,
            new Set<UUID>([eventId]),
          ),
      );

      scheduleActualEventRefresh(
        "Failed to refresh caches after deleting actual event",
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

  // Batch delete actual events mutation
  const batchDeleteMutation = useMutation({
    mutationFn: (eventIds: UUID[]) => actualEventsApi.batchDelete(eventIds),
    onSuccess: (result, eventIds) => {
      const idsToRemove = new Set<UUID>(eventIds);

      queryClient.setQueriesData(
        { predicate: (query) => isActualEventsListQuery(query as QueryLike) },
        (existing) =>
          removeActualEvents(
            existing as ActualEvent[] | undefined,
            idsToRemove,
          ),
      );

      scheduleActualEventRefresh(
        "Failed to refresh caches after batch deleting actual events",
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

  // Batch create actual events mutation
  const batchCreateMutation = useMutation({
    mutationFn: (events: ActualEventCreate[]) =>
      actualEventsApi.batchCreate(events),
    onSuccess: (result) => {
      scheduleActualEventRefresh(
        "Failed to refresh caches after batch creating actual events",
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

  // Batch update actual events mutation
  const batchUpdateMutation = useMutation({
    mutationFn: (params: {
      event_ids: UUID[];
      update_type: "persons" | "title" | "task" | "dimension";
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
      dimension?: {
        dimension_id: UUID | null;
      };
    }) => actualEventsApi.batchUpdate(params),
    onSuccess: (result) => {
      scheduleActualEventRefresh(
        "Failed to refresh caches after batch updating actual events",
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
    createActualEvent: createMutation,
    updateActualEvent: updateMutation,
    deleteActualEvent: deleteMutation,

    // Batch mutations
    batchCreateActualEvents: batchCreateMutation,
    batchUpdateActualEvents: batchUpdateMutation,
    batchDeleteActualEvents: batchDeleteMutation,

    // Convenience methods for async operations
    createActualEventAsync: createMutation.mutateAsync,
    updateActualEventAsync: updateMutation.mutateAsync,
    deleteActualEventAsync: deleteMutation.mutateAsync,
    batchCreateActualEventsAsync: batchCreateMutation.mutateAsync,
    batchUpdateActualEventsAsync: batchUpdateMutation.mutateAsync,
    batchDeleteActualEventsAsync: batchDeleteMutation.mutateAsync,
  };
}
