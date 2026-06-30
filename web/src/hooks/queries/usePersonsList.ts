import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { personsApi, type PersonListResponse } from "@/services/api/persons";
import { personsKeys } from "@/services/api/queryKeys";
import type { PersonSummary } from "@/services/api";

export function usePersonsList(options?: { ttlMs?: number }) {
  const { t } = useTranslation();
  const filters = { page: 1, size: 100 } as const;

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery<PersonListResponse, Error, PersonSummary[]>({
    queryKey: personsKeys.list(filters),
    queryFn: () => personsApi.getAll(filters.page, filters.size),
    select: (resp) => (Array.isArray(resp?.items) ? resp.items : []),
    staleTime: options?.ttlMs ?? 5 * 60 * 1000,
  });

  return {
    persons: data,
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : t("common.loading")
      : null,
    refresh: () => refetch(),
  };
}
