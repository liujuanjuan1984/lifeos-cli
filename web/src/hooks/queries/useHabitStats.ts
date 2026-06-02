import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { habitsApi, type HabitStats } from "@/services/api/habits";
import { habitsKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";

interface UseHabitStatsOptions {
  enabled?: boolean;
  staleTimeMs?: number;
  gcTimeMs?: number;
}

interface UseHabitStatsResult {
  stats: HabitStats | null;
  query: UseQueryResult<HabitStats, Error>;
}

export function useHabitStats(
  habitId: UUID,
  {
    enabled = true,
    staleTimeMs = 60 * 1000,
    gcTimeMs = 5 * 60 * 1000,
  }: UseHabitStatsOptions = {},
): UseHabitStatsResult {
  const query = useQuery({
    queryKey: habitsKeys.stats(habitId),
    queryFn: async () => {
      const overview = await habitsApi.getOverview(habitId);
      return overview.stats;
    },
    enabled,
    staleTime: staleTimeMs,
    gcTime: gcTimeMs,
  });

  return {
    stats: query.data ?? null,
    query,
  };
}
