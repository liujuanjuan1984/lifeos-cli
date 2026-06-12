import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { dimensionsApi } from "@/services/api/dimensions";
import { dimensionsKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";

export function useDimensions(options?: {
  ttlMs?: number;
  includeInactive?: boolean;
}) {
  const { t } = useTranslation();
  const page = 1;
  const size = 100;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: dimensionsKeys.list({
      include_inactive: options?.includeInactive ?? false,
      page,
      size,
    }),
    queryFn: () =>
      dimensionsApi.getDimensions(
        options?.includeInactive ?? false,
        page,
        size,
      ),
    staleTime: options?.ttlMs ?? 5 * 60 * 1000,
  });

  const dimensionItems = useMemo(() => data?.items ?? [], [data?.items]);

  const dimensionMap = useMemo(() => {
    const map = new Map<UUID, { name: string; color: string }>();
    for (const d of dimensionItems) {
      map.set(d.id, { name: d.name, color: d.color || "#6B7280" });
    }
    return map;
  }, [dimensionItems]);

  return {
    dimensions: dimensionItems,
    dimensionMap,
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : t("common.loading")
      : null,
    refresh: () => refetch(),
  };
}
