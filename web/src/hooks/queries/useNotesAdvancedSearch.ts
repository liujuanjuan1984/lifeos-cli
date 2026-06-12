import { useTranslation } from "react-i18next";
import {
  notesApi,
  type Note,
  type NoteAdvancedSearchPayload,
} from "@/services/api/notes";
import { notesKeys } from "@/services/api/queryKeys";
import { useToast } from "@/contexts/ToastContext";
import { usePaginatedSearch } from "./usePaginatedSearch";

export type NotesAdvancedSearchParams = NoteAdvancedSearchPayload;

export function useNotesAdvancedSearchWithPagination(pageSize: number = 100) {
  const { t } = useTranslation();
  const { showSuccess, showInfo, showError } = useToast();

  return usePaginatedSearch<Note, NotesAdvancedSearchParams>({
    pageSize,
    queryKey: (params) => notesKeys.advancedSearch(params),
    queryFn: async (params) => {
      const response = await notesApi.advancedSearch(params);
      return response.items;
    },
    idleKey: [...notesKeys.all, "advanced-search", "idle"] as const,
    staleTime: 30 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    onSuccess: (items) => {
      showSuccess(
        t("notes.messages.searchCompletedTitle"),
        t("notes.messages.searchFoundRecords", { count: items.length }),
      );
    },
    onEmpty: () => {
      showInfo(
        t("notes.messages.searchCompletedTitle"),
        t("notes.messages.searchFoundNone"),
      );
    },
    onError: (error) => {
      const message = error?.message || t("notes.messages.searchFailed");
      showError(t("notes.messages.searchFailedTitle"), message);
    },
  });
}
