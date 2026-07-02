import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import { useTagSelectorSource } from "@/hooks/selectors/useTagSelectorSource";
import { notesApi } from "@/services/api/notes";
import { tasksApi } from "@/services/api/tasks";
import type { Tag, Task, TaskWithSubtasks } from "@/services/api";
import type { Note, NoteCreate, NoteUpdate } from "@/services/api/notes";
import {
  timelogsKeys,
  notesKeys,
  tasksKeys,
  visionsKeys,
} from "@/services/api/queryKeys";
import {
  invalidateNotesAdvancedSearch,
  invalidateNotesLists,
  invalidateNotesStats,
} from "@/services/api/cacheInvalidation/notes";
import {
  isTimelogsAdvancedSearchQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";
import {
  invalidateTasksByIds,
  updateTaskCaches,
  updateTaskRelationshipCounts,
} from "@/utils/query";
import { logger } from "@/utils/core";
import type { UUID } from "@/types/primitive";

const findTaskInHierarchyCache = (
  queryClient: QueryClient,
  visionId: UUID | null | undefined,
  taskId: UUID,
): TaskWithSubtasks | null => {
  if (!visionId) return null;
  const hierarchy = queryClient.getQueryData<{
    root_tasks: TaskWithSubtasks[];
  }>(visionsKeys.hierarchy(visionId));
  if (!hierarchy?.root_tasks?.length) {
    return null;
  }

  const stack = [...hierarchy.root_tasks];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.id === taskId) {
      return current;
    }
    if (current.subtasks?.length) {
      stack.push(...current.subtasks);
    }
  }
  return null;
};

interface UseCreateNoteModalControllerParams {
  mode: "create" | "edit";
  existingNote?: Note;
  onCompleted: () => void;
  onNoteCreated?: (note?: Note) => void;
}

interface SubmitNotePayload {
  content: string;
  selectedPersonIds: UUID[];
  selectedTagIds: UUID[];
  lockedTagIds: UUID[];
  isTagSelectionLocked: boolean;
  selectedTaskId: UUID | null;
  selectedTimelogIds: UUID[];
}

export function useCreateNoteModalController({
  mode,
  existingNote,
  onCompleted,
  onNoteCreated,
}: UseCreateNoteModalControllerParams) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const invalidateRelatedQueries = useCallback(
    async (targets?: {
      timelogIds?: UUID[];
      taskIds?: UUID[];
      notes?: Note[];
      removedNoteIds?: UUID[];
    }) => {
      const tasks: Array<Promise<unknown>> = [
        invalidateNotesLists(queryClient),
        invalidateNotesAdvancedSearch(queryClient),
        invalidateNotesStats(queryClient),
      ];

      targets?.notes?.forEach((note) => {
        queryClient.setQueryData(notesKeys.detail(note.id), note);
      });

      targets?.removedNoteIds?.forEach((noteId) => {
        queryClient.removeQueries({
          queryKey: notesKeys.detail(noteId),
          exact: true,
        });
      });

      const timelogIds =
        targets?.timelogIds && targets.timelogIds.length > 0
          ? Array.from(new Set(targets.timelogIds))
          : [];
      if (timelogIds.length > 0) {
        tasks.push(
          queryClient.invalidateQueries({
            queryKey: timelogsKeys.lists(),
          }),
        );
        tasks.push(
          queryClient.invalidateQueries({
            predicate: (query) =>
              isTimelogsAdvancedSearchQuery(query as QueryLike),
          }),
        );
        timelogIds.forEach((id) => {
          tasks.push(
            queryClient.invalidateQueries({
              queryKey: timelogsKeys.detail(id),
            }),
          );
        });
      }

      const taskIds =
        targets?.taskIds && targets.taskIds.length > 0
          ? Array.from(new Set(targets.taskIds))
          : [];
      if (taskIds.length > 0) {
        tasks.push(
          invalidateTasksByIds(queryClient, taskIds, {
            skipEvents: true,
            skipLists: true,
          }),
        );
      }

      await Promise.all(tasks);
    },
    [queryClient],
  );

  const syncTaskFromNoteSummary = useCallback(
    async (noteTask?: Note["task"], previousTaskId?: UUID | null) => {
      if (noteTask?.id) {
        let baseTask =
          queryClient.getQueryData<Task>(tasksKeys.detail(noteTask.id)) ??
          findTaskInHierarchyCache(
            queryClient,
            noteTask.vision_id ?? null,
            noteTask.id,
          );

        if (!baseTask) {
          try {
            baseTask = await tasksApi.getById(noteTask.id);
          } catch (error) {
            logger.warn("Failed to fetch task for note sync", error);
          }
        }

        if (baseTask) {
          const mergedTask: Task = {
            ...baseTask,
            content: noteTask.content ?? baseTask.content,
            status: noteTask.status ?? baseTask.status,
            priority:
              typeof noteTask.priority === "number"
                ? noteTask.priority
                : baseTask.priority,
            estimated_effort:
              typeof noteTask.estimated_effort === "number"
                ? noteTask.estimated_effort
                : baseTask.estimated_effort,
            notes_count:
              typeof noteTask.notes_count === "number"
                ? noteTask.notes_count
                : baseTask.notes_count,
            timelogs_count:
              typeof noteTask.timelogs_count === "number"
                ? noteTask.timelogs_count
                : baseTask.timelogs_count,
            actual_effort_total:
              typeof noteTask.actual_effort_total === "number"
                ? noteTask.actual_effort_total
                : baseTask.actual_effort_total,
            vision_id: noteTask.vision_id ?? baseTask.vision_id,
            parent_task_id:
              noteTask.parent_task_id !== undefined
                ? (noteTask.parent_task_id ?? null)
                : (baseTask.parent_task_id ?? null),
            updated_at: noteTask.updated_at ?? baseTask.updated_at,
            created_at: noteTask.created_at ?? baseTask.created_at,
          };

          updateTaskCaches(queryClient, mergedTask);
        }
      }

      const previousTaskIdToRefresh =
        previousTaskId &&
        previousTaskId !== (noteTask?.id ?? null) &&
        typeof previousTaskId === "string"
          ? (previousTaskId as UUID)
          : null;

      if (previousTaskIdToRefresh) {
        try {
          const refreshedTask = await tasksApi.getById(previousTaskIdToRefresh);
          updateTaskCaches(queryClient, refreshedTask);
        } catch (error) {
          logger.warn(
            "Failed to refresh previous task after note reassignment",
            error,
          );
        }
      }
    },
    [queryClient],
  );

  const createNoteMutation = useMutation({
    mutationFn: (noteData: NoteCreate) => notesApi.create(noteData),
    onSuccess: (createdNote, variables) => {
      toast.showSuccess(
        t("createNoteModal.messages.noteCreateSuccess"),
        t("createNoteModal.messages.noteCreateSuccessMessage"),
      );
      const timelogIds = new Set<UUID>();
      if (variables?.timelog_ids) {
        variables.timelog_ids.forEach((id) => timelogIds.add(id));
      }
      createdNote?.timelogs?.forEach((timelog) =>
        timelogIds.add(timelog.id),
      );

      const taskIds = new Set<UUID>();
      if (typeof variables?.task_id === "string") {
        taskIds.add(variables.task_id);
      }
      if (createdNote?.task?.id) {
        taskIds.add(createdNote.task.id);
      }

      const refreshCaches = async () => {
        await syncTaskFromNoteSummary(createdNote?.task);
        Array.from(taskIds).forEach((taskId) => {
          updateTaskRelationshipCounts(queryClient, taskId, {
            notes_count: (current) => Math.max(1, current + 1),
          });
        });
        await invalidateRelatedQueries({
          timelogIds: Array.from(timelogIds),
          taskIds: Array.from(taskIds),
          notes: [createdNote],
        });
      };

      void refreshCaches().catch((refreshError) => {
        logger.warn(
          "Failed to refresh caches after creating note",
          refreshError,
        );
      });

      onNoteCreated?.(createdNote);
      onCompleted();
    },
    onError: (error: Error) => {
      toast.showError(
        t("createNoteModal.messages.noteCreateFailed"),
        t("createNoteModal.messages.noteCreateFailedMessage"),
      );
      console.error("Failed to create note:", error);
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({
      noteId,
      noteData,
    }: {
      noteId: UUID;
      noteData: NoteUpdate;
    }) => notesApi.update(noteId, noteData),
    onSuccess: (updatedNote, variables) => {
      toast.showSuccess(
        t("createNoteModal.messages.noteUpdateSuccess"),
        t("createNoteModal.messages.noteUpdateSuccessMessage"),
      );
      const timelogIds = new Set<UUID>();
      existingNote?.timelogs?.forEach((timelog) =>
        timelogIds.add(timelog.id),
      );
      updatedNote?.timelogs?.forEach((timelog) =>
        timelogIds.add(timelog.id),
      );
      const payloadTimelogIds = variables?.noteData?.timelog_ids ?? [];
      payloadTimelogIds.forEach((id) => timelogIds.add(id));

      const taskIds = new Set<UUID>();
      if (existingNote?.task?.id) {
        taskIds.add(existingNote.task.id);
      }
      if (updatedNote?.task?.id) {
        taskIds.add(updatedNote.task.id);
      }
      const nextTaskId = variables?.noteData?.task_id;
      if (typeof nextTaskId === "string") {
        taskIds.add(nextTaskId);
      }

      const refreshCaches = async () => {
        await syncTaskFromNoteSummary(
          updatedNote?.task,
          existingNote?.task?.id ?? null,
        );
        await invalidateRelatedQueries({
          timelogIds: Array.from(timelogIds),
          taskIds: Array.from(taskIds),
          notes: [updatedNote],
        });
      };

      void refreshCaches().catch((refreshError) => {
        logger.warn(
          "Failed to refresh caches after updating note",
          refreshError,
        );
      });

      onNoteCreated?.(updatedNote);
      onCompleted();
    },
    onError: (error: Error) => {
      toast.showError(
        t("createNoteModal.messages.noteUpdateFailed"),
        t("createNoteModal.messages.noteUpdateFailedMessage"),
      );
      console.error("Failed to update note:", error);
    },
  });

  const { tags: availableNoteTags, createTag: createNoteTag } =
    useTagSelectorSource({ entityType: "note" });

  const handleCreateTag = useCallback(
    async (tagName: string): Promise<Tag> => {
      try {
        const newTag = await createNoteTag(tagName);
        toast.showSuccess(
          t("createNoteModal.messages.tagCreated"),
          t("createNoteModal.messages.tagCreatedMessage", { tagName }),
        );
        return newTag;
      } catch (error) {
        toast.showError(
          t("createNoteModal.messages.tagCreateFailed"),
          t("createNoteModal.messages.tagCreateFailedMessage"),
        );
        throw error;
      }
    },
    [createNoteTag, toast, t],
  );

  const submitNote = useCallback(
    ({
      content,
      selectedPersonIds,
      selectedTagIds,
      lockedTagIds,
      isTagSelectionLocked,
      selectedTaskId,
      selectedTimelogIds,
    }: SubmitNotePayload) => {
      const mergedTagIds = isTagSelectionLocked
        ? Array.from(new Set<UUID>([...lockedTagIds, ...selectedTagIds]))
        : selectedTagIds;

      if (mode === "edit" && existingNote) {
        const noteData: NoteUpdate = {
          content: content.trim(),
          person_ids: selectedPersonIds,
          tag_ids: mergedTagIds,
          task_id:
            selectedTaskId === null
              ? null
              : selectedTaskId
                ? selectedTaskId
                : undefined,
          timelog_ids: selectedTimelogIds,
        };
        updateNoteMutation.mutate({ noteId: existingNote.id, noteData });
        return;
      }

      const payload: NoteCreate = {
        content: content.trim(),
        person_ids: selectedPersonIds.length ? selectedPersonIds : undefined,
        tag_ids: mergedTagIds.length ? mergedTagIds : undefined,
        task_id:
          selectedTaskId === null
            ? null
            : selectedTaskId
              ? selectedTaskId
              : undefined,
        timelog_ids:
          selectedTimelogIds.length > 0
            ? selectedTimelogIds
            : undefined,
      };
      createNoteMutation.mutate(payload);
    },
    [createNoteMutation, existingNote, mode, updateNoteMutation],
  );

  const isSubmitting =
    mode === "edit"
      ? updateNoteMutation.isPending
      : createNoteMutation.isPending;

  return {
    availableNoteTags,
    handleCreateTag,
    submitNote,
    isSubmitting,
  };
}
