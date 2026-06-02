import type { QueryClient } from "@tanstack/react-query";

import { foodEntriesKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";

export const invalidateFoodEntryListByDate = (
  queryClient: QueryClient,
  start: string,
  end: string,
  page: number = 1,
  size: number = 100,
) =>
  queryClient.invalidateQueries({
    queryKey: foodEntriesKeys.list({
      start_date: start,
      end_date: end,
      page,
      size,
    }),
  });

export const invalidateDailyNutrition = (
  queryClient: QueryClient,
  date: string,
) =>
  queryClient.invalidateQueries({
    queryKey: foodEntriesKeys.dailyNutrition(date),
  });

export const removeFoodEntryDetailCache = (
  queryClient: QueryClient,
  entryId: UUID,
) => {
  queryClient.removeQueries({
    queryKey: foodEntriesKeys.detail(entryId),
    exact: true,
  });
};
