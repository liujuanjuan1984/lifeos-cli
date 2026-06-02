import type { QueryClient } from "@tanstack/react-query";

import { actualEventsKeys } from "@/services/api/queryKeys";
import {
  isActualEventsAdvancedSearchQuery,
  isActualEventsListQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";
import type { ActualEvent } from "@/services/api/actualEvents";
import type { UUID } from "@/types/primitive";

type ActualEventListFilters = Parameters<typeof actualEventsKeys.list>[0];

export const invalidateActualEventLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isActualEventsListQuery(query as QueryLike),
  });

export const invalidateActualEventList = (
  queryClient: QueryClient,
  filters: ActualEventListFilters,
) =>
  queryClient.invalidateQueries({
    queryKey: actualEventsKeys.list(filters),
    exact: true,
  });

export const invalidateActualEventsAdvancedSearch = (
  queryClient: QueryClient,
) =>
  queryClient.invalidateQueries({
    predicate: (query) => isActualEventsAdvancedSearchQuery(query as QueryLike),
  });

export const setActualEventDetailCache = (
  queryClient: QueryClient,
  event: ActualEvent,
) => {
  queryClient.setQueryData(actualEventsKeys.detail(event.id), event);
};

export const removeActualEventDetailCache = (
  queryClient: QueryClient,
  id: UUID,
) => {
  queryClient.removeQueries({
    queryKey: actualEventsKeys.detail(id),
    exact: true,
  });
};
