import type { QueryClient } from "@tanstack/react-query";

import { areasKeys } from "@/services/api/queryKeys";
import {
  isAreasListQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";
import type { Area } from "@/services/api/areas";
import type { UUID } from "@/types/primitive";

export const invalidateAreasLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isAreasListQuery(query as QueryLike),
  });

export const invalidateAreaDetail = (queryClient: QueryClient, id: UUID) =>
  queryClient.invalidateQueries({
    queryKey: areasKeys.detail(id),
    exact: true,
  });

export const invalidateAreaOrder = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: areasKeys.order(),
    exact: true,
  });

export const setAreaDetailCache = (
  queryClient: QueryClient,
  area: Area,
) => {
  queryClient.setQueryData(areasKeys.detail(area.id), area);
};

export const removeAreaDetailCache = (
  queryClient: QueryClient,
  id: UUID,
) => {
  queryClient.removeQueries({
    queryKey: areasKeys.detail(id),
    exact: true,
  });
};
