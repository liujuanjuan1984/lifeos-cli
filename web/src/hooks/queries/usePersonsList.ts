import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { personsApi } from "@/services/api/persons";
import { personsKeys } from "@/services/api/queryKeys";
import type { PersonSummary } from "@/services/api";

export function usePersonsList(options?: { ttlMs?: number }) {
  const { t } = useTranslation();

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery<PersonSummary[]>({
    queryKey: personsKeys.list({}),
    queryFn: async () => {
      const resp = await personsApi.getAll();
      return Array.isArray(resp?.items) ? resp.items : [];
    },
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
