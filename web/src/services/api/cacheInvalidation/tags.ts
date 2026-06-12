import type { QueryClient } from "@tanstack/react-query";

import { tagsKeys } from "@/services/api/queryKeys";
import type { Tag } from "@/services/api/tags";
import type { UUID } from "@/types/primitive";

type TagListFilters = Parameters<typeof tagsKeys.list>[0];

export const invalidateTagList = (
  queryClient: QueryClient,
  filters: TagListFilters,
) =>
  queryClient.invalidateQueries({
    queryKey: tagsKeys.list(filters),
    exact: true,
  });

export const setTagDetailCache = (queryClient: QueryClient, tag: Tag) => {
  queryClient.setQueryData(tagsKeys.detail(tag.id), tag);
};

export const removeTagDetailCache = (queryClient: QueryClient, id: UUID) => {
  queryClient.removeQueries({
    queryKey: tagsKeys.detail(id),
    exact: true,
  });
};
