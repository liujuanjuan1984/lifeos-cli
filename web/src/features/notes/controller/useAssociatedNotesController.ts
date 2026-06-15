import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { notesApi } from "@/services/api/notes";
import { notesKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";

type AssociatedNotesFilter =
  | { task_id?: UUID; timelog_id?: never; tag_id?: never }
  | { task_id?: never; timelog_id?: UUID; tag_id?: never }
  | { task_id?: never; timelog_id?: never; tag_id?: UUID };

interface UseAssociatedNotesControllerParams {
  isOpen: boolean;
  enabledId: UUID | null;
  listFilters: AssociatedNotesFilter;
}

export function useAssociatedNotesController({
  isOpen,
  enabledId,
  listFilters,
}: UseAssociatedNotesControllerParams) {
  const {
    data: notesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: notesKeys.list(listFilters),
    queryFn: ({ signal }) =>
      notesApi.fetchPaged(
        {
          ...listFilters,
          page: 1,
          size: 50,
        },
        { signal },
      ),
    enabled: isOpen && !!enabledId,
    staleTime: 5 * 60 * 1000,
  });

  const notes = useMemo(() => notesData?.items ?? [], [notesData]);

  return {
    notes,
    isLoading,
    error,
    refetch,
  };
}
