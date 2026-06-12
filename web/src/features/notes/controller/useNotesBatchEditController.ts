import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/contexts/ToastContext";
import {
  notesApi,
  type NoteBatchUpdatePayload,
  type NoteBatchUpdateResult,
} from "@/services/api/notes";
import type { UUID } from "@/types/primitive";

type BatchMode = "tags" | "persons" | "task" | "content";
type TagMode = "add" | "replace";
type PersonMode = "add" | "replace";
type TaskMode = "replace" | "clear";

interface SubmitBatchEditOptions {
  noteIds: UUID[];
  mode: BatchMode;
  tagMode: TagMode;
  selectedTagIds: UUID[];
  personMode: PersonMode;
  selectedPersonIds: UUID[];
  taskMode: TaskMode;
  selectedTaskId: UUID | null;
  findText: string;
  replaceText: string;
  caseSensitive: boolean;
}

interface UseNotesBatchEditControllerParams {
  onSuccess: () => void;
  onCompleted: () => void;
  resetState: () => void;
}

export function useNotesBatchEditController({
  onSuccess,
  onCompleted,
  resetState,
}: UseNotesBatchEditControllerParams) {
  const { t } = useTranslation();
  const { showError, showInfo, showSuccess } = useToast();

  const mutation = useMutation<
    NoteBatchUpdateResult,
    Error,
    NoteBatchUpdatePayload
  >({
    mutationFn: (payload) => notesApi.batchUpdate(payload),
  });

  const submitBatchEdit = useCallback(
    async ({
      noteIds,
      mode,
      tagMode,
      selectedTagIds,
      personMode,
      selectedPersonIds,
      taskMode,
      selectedTaskId,
      findText,
      replaceText,
      caseSensitive,
    }: SubmitBatchEditOptions) => {
      if (noteIds.length === 0) {
        showError(t("notes.batchEdit.title"), t("notes.batchEdit.noSelection"));
        return;
      }

      const payload: NoteBatchUpdatePayload = {
        note_ids: noteIds,
        operation: mode,
      };

      if (mode === "tags") {
        if (tagMode === "add" && selectedTagIds.length === 0) {
          showError(
            t("notes.batchEdit.title"),
            t("notes.batchEdit.tagsRequired"),
          );
          return;
        }
        payload.tags = {
          mode: tagMode,
          tag_ids: selectedTagIds,
        };
      } else if (mode === "persons") {
        if (personMode === "add" && selectedPersonIds.length === 0) {
          showError(
            t("notes.batchEdit.title"),
            t("notes.batchEdit.personsRequired"),
          );
          return;
        }
        payload.persons = {
          mode: personMode,
          person_ids: selectedPersonIds,
        };
      } else if (mode === "task") {
        if (taskMode === "replace" && !selectedTaskId) {
          showError(
            t("notes.batchEdit.title"),
            t("notes.batchEdit.taskRequired"),
          );
          return;
        }
        payload.task = {
          mode: taskMode,
          task_id: selectedTaskId ?? undefined,
        };
      } else if (mode === "content") {
        if (!findText.trim()) {
          showError(
            t("notes.batchEdit.title"),
            t("notes.batchEdit.findTextRequired"),
          );
          return;
        }
        payload.content = {
          find_text: findText,
          replace_text: replaceText,
          case_sensitive: caseSensitive,
        };
      }

      try {
        const result = await mutation.mutateAsync(payload);

        if (result.updated_count > 0) {
          showSuccess(
            t("notes.batchEdit.successTitle"),
            t("notes.batchEdit.successMessage", {
              updated: result.updated_count,
              failed: result.failed_ids.length,
            }),
          );
        }

        if (result.failed_ids.length > 0) {
          showInfo(
            t("notes.batchEdit.partialTitle"),
            t("notes.batchEdit.partialMessage", {
              failed: result.failed_ids.length,
            }),
          );
        }

        onSuccess();
        resetState();
        onCompleted();
      } catch (error) {
        showError(
          t("notes.batchEdit.errorTitle"),
          error instanceof Error ? error.message : t("common.operationFailed"),
        );
      }
    },
    [
      mutation,
      onCompleted,
      onSuccess,
      resetState,
      showError,
      showInfo,
      showSuccess,
      t,
    ],
  );

  return {
    isPending: mutation.isPending,
    submitBatchEdit,
  };
}
