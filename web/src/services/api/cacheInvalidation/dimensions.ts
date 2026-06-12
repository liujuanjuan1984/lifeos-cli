import type { QueryClient } from "@tanstack/react-query";

import { dimensionsKeys } from "@/services/api/queryKeys";
import {
  isDimensionsListQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";
import type { Dimension } from "@/services/api/dimensions";
import type { UUID } from "@/types/primitive";

export const invalidateDimensionsLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isDimensionsListQuery(query as QueryLike),
  });

export const invalidateDimensionDetail = (queryClient: QueryClient, id: UUID) =>
  queryClient.invalidateQueries({
    queryKey: dimensionsKeys.detail(id),
    exact: true,
  });

export const invalidateDimensionOrder = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: dimensionsKeys.order(),
    exact: true,
  });

export const setDimensionDetailCache = (
  queryClient: QueryClient,
  dimension: Dimension,
) => {
  queryClient.setQueryData(dimensionsKeys.detail(dimension.id), dimension);
};

export const removeDimensionDetailCache = (
  queryClient: QueryClient,
  id: UUID,
) => {
  queryClient.removeQueries({
    queryKey: dimensionsKeys.detail(id),
    exact: true,
  });
};
