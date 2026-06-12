import type { QueryClient } from "@tanstack/react-query";

import { personsKeys } from "@/services/api/queryKeys";
import {
  isPersonsListQuery,
  type QueryLike,
} from "@/services/api/queryPredicates";
import type { Person } from "@/services/api/persons";
import type { UUID } from "@/types/primitive";

export const invalidatePersonsLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    predicate: (query) => isPersonsListQuery(query as QueryLike),
  });

export const invalidatePersonDetail = (queryClient: QueryClient, id: UUID) =>
  queryClient.invalidateQueries({
    queryKey: personsKeys.detail(id),
    exact: true,
  });

export const invalidatePersonActivities = (
  queryClient: QueryClient,
  id: UUID,
) =>
  queryClient.invalidateQueries({
    queryKey: personsKeys.activities(id),
  });

export const invalidatePersonAnniversaries = (
  queryClient: QueryClient,
  id: UUID,
) =>
  queryClient.invalidateQueries({
    queryKey: personsKeys.anniversaries(id),
    exact: true,
  });

export const setPersonDetailCache = (
  queryClient: QueryClient,
  person: Person,
) => {
  queryClient.setQueryData(personsKeys.detail(person.id), person);
};

export const removePersonDetailCache = (queryClient: QueryClient, id: UUID) => {
  queryClient.removeQueries({
    queryKey: personsKeys.detail(id),
    exact: true,
  });
};
