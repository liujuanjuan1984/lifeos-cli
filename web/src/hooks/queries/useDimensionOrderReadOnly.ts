import { useQuery } from "@tanstack/react-query";
import { dimensionsApi } from "@/services/api/dimensions";
import { dimensionsKeys } from "@/services/api/queryKeys";

import type { UUID } from "@/types/primitive";

interface UseDimensionOrderReadOnlyResult {
  order: UUID[];
  isLoading: boolean;
  error: Error | null;
}

export function useDimensionOrderReadOnly(): UseDimensionOrderReadOnlyResult {
  const { data, isLoading, error } = useQuery({
    queryKey: dimensionsKeys.order(),
    queryFn: () => dimensionsApi.getOrder(),
    // Long-lived stable preference; rarely changes
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7d
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 2,
    placeholderData: [] as UUID[],
  });

  return {
    order: (data as UUID[]) || [],
    isLoading,
    error: (error as Error) || null,
  };
}
