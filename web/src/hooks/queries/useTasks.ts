import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/services/api/tasks";
import { tasksKeys } from "@/services/api/queryKeys";
import { normalizeTaskSelectorSourceFilters } from "@/services/api/taskFilters";

export function useAllTasks(
  options: {
    excludeStatus?: string[];
    enabled?: boolean;
    maxPages?: number;
    staleTime?: number;
    gcTime?: number;
    refetchOnWindowFocus?: boolean;
    refetchOnReconnect?: boolean;
  } = {},
) {
  const excludeStatusKey = useMemo(() => {
    if (!options.excludeStatus || options.excludeStatus.length === 0) {
      return "";
    }
    return [...options.excludeStatus].sort().join("|");
  }, [options.excludeStatus]);
  const normalizedFilters = useMemo(() => {
    const derivedExcludeStatus =
      excludeStatusKey === "" ? undefined : excludeStatusKey.split("|");

    return normalizeTaskSelectorSourceFilters({
      exclude_status: derivedExcludeStatus,
    });
  }, [excludeStatusKey]);

  return useQuery({
    queryKey: tasksKeys.selectorSource(normalizedFilters),
    queryFn: () =>
      tasksApi.getAllPaged({
        excludeStatus: normalizedFilters.exclude_status,
        pageSize: 100,
        maxPages: options.maxPages ?? 20, // Reduced from 50 to 20 (2000 tasks)
        fields: "basic",
      }),
    staleTime: options.staleTime ?? 10 * 60 * 1000, // Increased to 10 minutes
    gcTime: options.gcTime ?? 30 * 60 * 1000,
    enabled: options.enabled ?? true,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
    refetchOnReconnect: options.refetchOnReconnect ?? false,
  });
}
