import type { QueryClient } from "@tanstack/react-query";

import {
  isPlannedEventsListQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";

export const invalidatePlannedEventLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isPlannedEventsListQuery(query as QueryLike),
  });
