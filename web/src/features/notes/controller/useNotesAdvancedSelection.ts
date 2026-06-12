import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import type { UUID } from "@/types/primitive";
import type { QueryMode } from "@/hooks/useQueryMode";
import type {
  NotesAdvancedSearchParams,
  useNotesAdvancedSearchWithPagination,
} from "@/hooks/queries/useNotesAdvancedSearch";
import type { NotesPageData } from "./useNotesPageData";
import type { Note } from "@/types/newNotes";
import {
  notesApi,
  type NoteBatchDeletePayload,
  type NoteBatchDeleteResult,
} from "@/services/api/notes";
import { arraysEqual } from "@/utils/core";

interface NotesAdvancedSelectionOptions {
  queryMode: QueryMode;
  notesAdvancedSearch: ReturnType<typeof useNotesAdvancedSearchWithPagination>;
  notesAdvancedSearchRef: NotesPageData["notesAdvancedSearchRef"];
  advancedSearchParams: NotesPageData["advancedSearchParams"];
  setAdvancedSearchParams: NotesPageData["setAdvancedSearchParams"];
  advancedNotes: Note[];
  showSuccess: (title: string, description?: string) => void;
  showError: (title: string, description?: string) => void;
  showInfo: (title: string, description?: string) => void;
  t: TFunction;
}

interface UseNotesAdvancedSelectionReturn {
  isSelectMode: boolean;
  toggleSelectMode: (enabled: boolean) => void;
  selectedNoteIds: Set<UUID>;
  handleSelectNote: (noteId: UUID, checked: boolean) => void;
  handleSelectAll: () => void;
  handleSelectInverse: () => void;
  clearSelection: () => void;
  loadAdvancedSearchResults: () => void;
  handleAdvancedReset: () => void;
  isBatchDeleteConfirmOpen: boolean;
  openBatchDeleteConfirm: () => void;
  closeBatchDeleteConfirm: () => void;
  handleBatchDeleteConfirm: () => Promise<void>;
  handleBatchEditSuccess: () => void;
}

export function useNotesAdvancedSelection({
  queryMode,
  notesAdvancedSearch,
  notesAdvancedSearchRef,
  advancedSearchParams,
  setAdvancedSearchParams,
  advancedNotes,
  showSuccess,
  showError,
  showInfo,
  t,
}: NotesAdvancedSelectionOptions): UseNotesAdvancedSelectionReturn {
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<UUID>>(
    () => new Set(),
  );
  const [isBatchDeleteConfirmOpen, setIsBatchDeleteConfirmOpen] =
    useState(false);

  const batchDeleteMutation = useMutation<
    NoteBatchDeleteResult,
    Error,
    NoteBatchDeletePayload
  >({
    mutationFn: (payload) => notesApi.batchDelete(payload),
  });

  const convertAdvancedSearchParams =
    useCallback((): NotesAdvancedSearchParams => {
      return {
        start_date: advancedSearchParams.start_date,
        end_date: advancedSearchParams.end_date,
        tag_mode: advancedSearchParams.tag_mode,
        tag_ids:
          advancedSearchParams.tag_mode === "none"
            ? null
            : advancedSearchParams.tag_ids,
        person_mode: advancedSearchParams.person_mode,
        person_ids:
          advancedSearchParams.person_mode === "none"
            ? null
            : advancedSearchParams.person_ids,
        task_filter: advancedSearchParams.task_filter,
        task_id:
          advancedSearchParams.task_filter === "specific"
            ? advancedSearchParams.task_id
            : null,
        keyword: advancedSearchParams.keyword,
        sort_order: advancedSearchParams.sort_order,
      };
    }, [advancedSearchParams]);

  const loadAdvancedSearchResults = useCallback(() => {
    if (
      advancedSearchParams.task_filter === "specific" &&
      !advancedSearchParams.task_id
    ) {
      showError(
        t("notes.advancedSearch.errorTitle"),
        t("notes.advancedSearch.taskRequired"),
      );
      return;
    }

    const payload = convertAdvancedSearchParams();
    notesAdvancedSearchRef.current.search(payload);
  }, [
    advancedSearchParams.task_filter,
    advancedSearchParams.task_id,
    convertAdvancedSearchParams,
    notesAdvancedSearchRef,
    showError,
    t,
  ]);

  const handleAdvancedReset = useCallback(() => {
    setAdvancedSearchParams((prev) => {
      if (
        prev.start_date === null &&
        prev.end_date === null &&
        prev.tag_mode === "any" &&
        arraysEqual(prev.tag_ids, []) &&
        prev.person_mode === "any" &&
        arraysEqual(prev.person_ids, []) &&
        prev.task_filter === "any" &&
        prev.task_id === null &&
        prev.keyword === null &&
        prev.sort_order === "desc"
      ) {
        return prev;
      }
      return {
        start_date: null,
        end_date: null,
        tag_mode: "any",
        tag_ids: [],
        person_mode: "any",
        person_ids: [],
        task_filter: "any",
        task_id: null,
        keyword: null,
        sort_order: "desc",
      };
    });
    setSelectedNoteIds(new Set());
    setIsSelectMode(false);
    notesAdvancedSearchRef.current.clearSearch();
  }, [notesAdvancedSearchRef, setAdvancedSearchParams]);

  const handleSelectNote = useCallback((noteId: UUID, checked: boolean) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(noteId);
      } else {
        next.delete(noteId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = advancedNotes
      .map((note) => note.id)
      .filter((id): id is UUID => Boolean(id));
    setSelectedNoteIds(new Set(allIds));
  }, [advancedNotes]);

  const handleSelectInverse = useCallback(() => {
    const available = new Set(
      advancedNotes
        .map((note) => note.id)
        .filter((id): id is UUID => Boolean(id)),
    );
    setSelectedNoteIds((prev) => {
      const next = new Set<UUID>();
      available.forEach((id) => {
        if (!prev.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [advancedNotes]);

  const clearSelection = useCallback(() => {
    setSelectedNoteIds(new Set());
  }, []);

  useEffect(() => {
    if (queryMode !== "advanced") {
      setIsSelectMode(false);
      setSelectedNoteIds(new Set());
      notesAdvancedSearchRef.current.clearSearch();
    }
  }, [queryMode, notesAdvancedSearchRef]);

  useEffect(() => {
    if (queryMode !== "advanced") return;
    const validIds = new Set(
      advancedNotes
        .map((note) => note.id)
        .filter((id): id is UUID => Boolean(id)),
    );
    setSelectedNoteIds((prev) => {
      const filtered = new Set<UUID>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          filtered.add(id);
        }
      });
      return filtered;
    });
  }, [advancedNotes, queryMode]);

  const openBatchDeleteConfirm = useCallback(() => {
    if (selectedNoteIds.size === 0) return;
    setIsBatchDeleteConfirmOpen(true);
  }, [selectedNoteIds.size]);

  const closeBatchDeleteConfirm = useCallback(() => {
    setIsBatchDeleteConfirmOpen(false);
  }, []);

  const handleBatchDeleteConfirm = useCallback(async () => {
    if (selectedNoteIds.size === 0) return;
    try {
      const result = await batchDeleteMutation.mutateAsync({
        note_ids: Array.from(selectedNoteIds),
      });

      if (result.deleted_count > 0) {
        showSuccess(
          t("notes.batchDelete.successTitle"),
          t("notes.batchDelete.successMessage", {
            deleted: result.deleted_count,
            failed: result.failed_ids.length,
          }),
        );
      }

      if (result.failed_ids.length > 0) {
        showInfo(
          t("notes.batchDelete.partialTitle"),
          result.errors.length
            ? result.errors.join("\n")
            : t("notes.batchDelete.partialMessage", {
                failed: result.failed_ids.length,
              }),
        );
      }

      setSelectedNoteIds(new Set());
      setIsSelectMode(false);
      if (notesAdvancedSearch.searchParams) {
        await notesAdvancedSearch.refetch();
      }
    } catch (error) {
      showError(
        t("notes.batchDelete.errorTitle"),
        error instanceof Error ? error.message : t("common.operationFailed"),
      );
    } finally {
      setIsBatchDeleteConfirmOpen(false);
    }
  }, [
    batchDeleteMutation,
    notesAdvancedSearch,
    selectedNoteIds,
    showError,
    showInfo,
    showSuccess,
    t,
  ]);

  const handleBatchEditSuccess = useCallback(() => {
    if (notesAdvancedSearch.searchParams) {
      notesAdvancedSearchRef.current.refetch();
    }
    setSelectedNoteIds(new Set());
    setIsSelectMode(false);
  }, [notesAdvancedSearch.searchParams, notesAdvancedSearchRef]);

  const toggleSelectMode = useCallback((enabled: boolean) => {
    setIsSelectMode(enabled);
    if (!enabled) {
      setSelectedNoteIds(new Set());
    }
  }, []);

  return {
    isSelectMode,
    toggleSelectMode,
    selectedNoteIds,
    handleSelectNote,
    handleSelectAll,
    handleSelectInverse,
    clearSelection,
    loadAdvancedSearchResults,
    handleAdvancedReset,
    isBatchDeleteConfirmOpen,
    openBatchDeleteConfirm,
    closeBatchDeleteConfirm,
    handleBatchDeleteConfirm,
    handleBatchEditSuccess,
  };
}
