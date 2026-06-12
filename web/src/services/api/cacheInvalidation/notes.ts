import type { QueryClient } from "@tanstack/react-query";

import {
  isNotesListQuery,
  isNotesAdvancedSearchQuery,
  isNotesStatsQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";

export const invalidateNotesLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isNotesListQuery(query as QueryLike),
  });

export const invalidateNotesAdvancedSearch = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isNotesAdvancedSearchQuery(query as QueryLike),
  });

export const invalidateNotesStats = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isNotesStatsQuery(query as QueryLike),
  });
