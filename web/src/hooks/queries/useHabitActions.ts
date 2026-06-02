import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { habitsApi, type HabitAction } from "@/services/api/habits";
import { habitsKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";
import { MAX_HABIT_ACTION_WINDOW_DAYS } from "@/utils/constants";
import { formatDateKey } from "@/utils/datetime";

interface UseHabitActionsOptions {
  enabled?: boolean;
  page?: number;
  size?: number;
  statusFilter?: string;
  centerDate?: Date | string;
  windowSize?: number;
  staleTimeMs?: number;
  gcTimeMs?: number;
}

interface UseHabitActionsResult {
  actions: HabitAction[];
  query: UseQueryResult<HabitAction[], Error>;
}

export function useHabitActions(
  habitId: UUID,
  {
    enabled = true,
    page = 1,
    size = 100,
    statusFilter,
    centerDate,
    windowSize = MAX_HABIT_ACTION_WINDOW_DAYS,
    staleTimeMs = 60 * 1000,
    gcTimeMs = 5 * 60 * 1000,
  }: UseHabitActionsOptions = {},
): UseHabitActionsResult {
  const formattedCenterDate =
    typeof centerDate === "string"
      ? centerDate
      : centerDate
        ? formatDateKey(centerDate)
        : undefined;
  const normalizedWindow = Math.max(
    1,
    Math.min(windowSize, MAX_HABIT_ACTION_WINDOW_DAYS),
  );
  const daysBefore =
    formattedCenterDate !== undefined
      ? Math.floor((normalizedWindow - 1) / 2)
      : undefined;
  const daysAfter =
    formattedCenterDate !== undefined
      ? normalizedWindow - 1 - (daysBefore || 0)
      : undefined;

  const query = useQuery({
    // Keep key aligned with mutation updates; include pagination params
    queryKey: habitsKeys.actions(habitId, {
      centerDate: formattedCenterDate ?? null,
      windowSize: normalizedWindow,
      statusFilter: statusFilter ?? null,
      page,
      size,
    }),
    queryFn: async () => {
      const res = await habitsApi.getActions(habitId, {
        page,
        size,
        statusFilter,
        centerDate: formattedCenterDate,
        daysBefore,
        daysAfter,
      });
      return res.items;
    },
    enabled,
    staleTime: staleTimeMs,
    gcTime: gcTimeMs,
  });

  return {
    actions: query.data ?? [],
    query,
  };
}
