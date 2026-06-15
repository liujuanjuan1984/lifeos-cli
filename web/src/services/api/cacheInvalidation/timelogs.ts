import type { QueryClient } from "@tanstack/react-query";

import { timelogsKeys } from "@/services/api/queryKeys";
import {
  isTimelogsAdvancedSearchQuery,
  isTimelogsListQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";
import type { Timelog } from "@/services/api/timelogs";
import type { UUID } from "@/types/primitive";

type TimelogListFilters = Parameters<typeof timelogsKeys.list>[0];

export const invalidateTimelogLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isTimelogsListQuery(query as QueryLike),
  });

export const invalidateTimelogList = (
  queryClient: QueryClient,
  filters: TimelogListFilters,
) =>
  queryClient.invalidateQueries({
    queryKey: timelogsKeys.list(filters),
    exact: true,
  });

export const invalidateTimelogsAdvancedSearch = (
  queryClient: QueryClient,
) =>
  queryClient.invalidateQueries({
    predicate: (query) => isTimelogsAdvancedSearchQuery(query as QueryLike),
  });

export const setTimelogDetailCache = (
  queryClient: QueryClient,
  event: Timelog,
) => {
  queryClient.setQueryData(timelogsKeys.detail(event.id), event);
};

export const removeTimelogDetailCache = (
  queryClient: QueryClient,
  id: UUID,
) => {
  queryClient.removeQueries({
    queryKey: timelogsKeys.detail(id),
    exact: true,
  });
};
