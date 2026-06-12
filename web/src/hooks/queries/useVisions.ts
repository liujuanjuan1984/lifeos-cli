import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { visionsApi } from "@/services/api/visions";
import { visionsKeys } from "@/services/api/queryKeys";

export function useVisions(options?: { ttlMs?: number }) {
  const { t } = useTranslation();
  const page = 1;
  const size = 100;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: visionsKeys.list({ page, size }),
    queryFn: async () => {
      const response = await visionsApi.getAll(undefined, page, size);
      return response.items ?? [];
    },
    staleTime: options?.ttlMs ?? 5 * 60 * 1000,
  });

  return {
    visions: data ?? [],
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : t("common.loading")
      : null,
    refresh: () => refetch(),
  };
}
