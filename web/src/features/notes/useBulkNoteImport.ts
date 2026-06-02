import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notesApi } from "@/services/api/notes";
import type { UUID } from "@/types/primitive";
import {
  invalidateNotesAdvancedSearch,
  invalidateNotesLists,
  invalidateNotesStats,
} from "@/services/api/cacheInvalidation/notes";

export interface BulkNoteDraft {
  id: string;
  content: string;
}

interface BulkNoteSubmitArgs {
  drafts: BulkNoteDraft[];
  personIds: UUID[];
  tagIds: UUID[];
  taskId?: UUID | null;
}

interface BulkNoteSubmitResult {
  statusById: Record<string, { status: "success" | "error"; error?: string }>;
  createdCount: number;
  failedCount: number;
}

export const MAX_BULK_NOTES_PER_REQUEST = 20;

export function useBulkNoteImport() {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitBulkNotes = useCallback(
    async (args: BulkNoteSubmitArgs): Promise<BulkNoteSubmitResult> => {
      if (!args.drafts.length) {
        return { statusById: {}, createdCount: 0, failedCount: 0 };
      }
      setIsSubmitting(true);
      const statusMap = new Map<
        string,
        { status: "success" | "error"; error?: string }
      >();
      args.drafts.forEach((draft) => {
        statusMap.set(draft.id, { status: "success" });
      });

      let totalCreated = 0;
      let totalFailed = 0;

      try {
        for (
          let i = 0;
          i < args.drafts.length;
          i += MAX_BULK_NOTES_PER_REQUEST
        ) {
          const chunk = args.drafts.slice(i, i + MAX_BULK_NOTES_PER_REQUEST);
          const response = await notesApi.batchCreate({
            notes: chunk.map((draft) => ({ content: draft.content })),
            person_ids: args.personIds.length ? args.personIds : undefined,
            tag_ids: args.tagIds.length ? args.tagIds : undefined,
            task_id: args.taskId ?? undefined,
          });

          totalCreated += response.created_count;
          totalFailed += response.failed_count;

          const failureMap = new Map<number, string>();
          response.failed_items.forEach((item) => {
            failureMap.set(item.index - 1, item.error);
          });

          chunk.forEach((draft, index) => {
            if (failureMap.has(index)) {
              statusMap.set(draft.id, {
                status: "error",
                error: failureMap.get(index) || "",
              });
            } else {
              statusMap.set(draft.id, { status: "success" });
            }
          });
        }

        await Promise.all([
          invalidateNotesLists(queryClient),
          invalidateNotesStats(queryClient),
          invalidateNotesAdvancedSearch(queryClient),
        ]);

        return {
          statusById: Object.fromEntries(statusMap.entries()),
          createdCount: totalCreated,
          failedCount: totalFailed,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        args.drafts.forEach((draft) => {
          const entry = statusMap.get(draft.id);
          if (!entry || entry.status !== "error") {
            statusMap.set(draft.id, { status: "error", error: message });
          }
        });
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [queryClient],
  );

  return { submitBulkNotes, isSubmitting };
}
