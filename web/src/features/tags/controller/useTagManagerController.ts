import { useCallback, useMemo } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { tagsApi } from "@/services/api/tags";
import type {
  Tag,
  TagBulkUpdateResponse,
  TagCategoryOption,
  TagCreate,
  TagUpdate,
  TagUsageStats,
} from "@/services/api/tags";
import {
  notesKeys,
  personsKeys,
  tagsKeys,
  tasksKeys,
  visionsKeys,
} from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";
import {
  removeTagDetailCache,
  setTagDetailCache,
} from "@/services/api/cacheInvalidation/tags";

export interface TagWithStats extends Tag {
  usageStats?: TagUsageStats;
}

interface UseTagManagerControllerParams {
  isOpen: boolean;
  entityTypeScope: string;
  onTagCreated?: (tag: Tag) => void;
  onTagUpdated?: (tag: Tag) => void;
  onTagDeleted?: (tagId: UUID) => void;
}

type TagListFilter = {
  entity_type?: string;
  category?: string;
};

const ENTITY_TYPE_DEFAULT_CATEGORIES: Record<string, string[]> = {
  person: ["location", "relation", "profession", "team"],
  note: ["topic"],
};

const getDefaultCategoryForEntityType = (
  entityType: string | null | undefined,
) => {
  const normalized = (entityType || "").trim();
  return ENTITY_TYPE_DEFAULT_CATEGORIES[normalized]?.[0] || "general";
};

const normalizeTagCategory = (
  category: string | null | undefined,
  entityType: string | null | undefined,
) => category || getDefaultCategoryForEntityType(entityType);

const sortTagsByUsageAndName = (tags: TagWithStats[]): TagWithStats[] => {
  return tags.sort((a, b) => {
    const aUsage = a.usageStats?.total_usage || 0;
    const bUsage = b.usageStats?.total_usage || 0;

    if (aUsage !== bUsage) {
      return bUsage - aUsage;
    }

    return a.name.localeCompare(b.name);
  });
};

const getTagOwnerQueryKeys = (entityType: string | null | undefined) => {
  switch (entityType) {
    case "person":
      return [personsKeys.lists(), personsKeys.details()] as const;
    case "note":
      return [notesKeys.lists(), notesKeys.details()] as const;
    case "task":
      return [tasksKeys.lists(), tasksKeys.details()] as const;
    case "vision":
      return [visionsKeys.lists(), visionsKeys.details()] as const;
    default:
      return [] as const;
  }
};

const getTagListFilters = (
  queryKey: readonly unknown[],
): TagListFilter | null => {
  if (
    queryKey.length < 3 ||
    queryKey[2] === undefined ||
    queryKey[2] === null ||
    Array.isArray(queryKey[2]) ||
    typeof queryKey[2] !== "object"
  ) {
    return null;
  }

  const rawFilters = queryKey[2];
  if (!rawFilters) return null;

  return {
    entity_type:
      typeof (rawFilters as { entity_type?: unknown }).entity_type === "string"
        ? (rawFilters as { entity_type?: string }).entity_type
        : undefined,
    category:
      typeof (rawFilters as { category?: unknown }).category === "string"
        ? (rawFilters as { category?: string }).category
        : undefined,
  };
};

const isTagInTagListFilter = (tag: Tag, filter: TagListFilter | null) => {
  if (!filter) return true;
  if (filter.entity_type && tag.entity_type !== filter.entity_type)
    return false;
  const tagCategory = normalizeTagCategory(tag.category, tag.entity_type);
  if (filter.category && tagCategory !== filter.category) return false;
  return true;
};

const upsertTagIntoTagList = (
  currentTags: Tag[],
  targetTag: Tag,
  action: "create" | "update",
  filter: TagListFilter | null,
): Tag[] => {
  const matched = isTagInTagListFilter(targetTag, filter);
  const index = currentTags.findIndex((tag) => tag.id === targetTag.id);

  if (action === "create") {
    if (!matched) {
      return currentTags;
    }

    if (index === -1) {
      return [...currentTags, targetTag];
    }

    const next = [...currentTags];
    next[index] = {
      ...next[index],
      ...targetTag,
    };
    return next;
  }

  if (index === -1) {
    return matched ? [...currentTags, targetTag] : currentTags;
  }

  const next = [...currentTags];

  if (!matched) {
    next.splice(index, 1);
    return next;
  }

  next[index] = {
    ...next[index],
    ...targetTag,
  };
  return next;
};

const updateTagInStatsList = (
  currentTagsWithStats: TagWithStats[],
  targetTag: Tag,
): TagWithStats[] => {
  const index = currentTagsWithStats.findIndex(
    (tag) => tag.id === targetTag.id,
  );
  if (index === -1) {
    return currentTagsWithStats;
  }

  const next = [...currentTagsWithStats];
  next[index] = {
    ...next[index],
    ...targetTag,
  };
  return next;
};

const invalidateQueriesByKeys = (
  queryClient: QueryClient,
  queryKeys: ReadonlyArray<readonly unknown[]>,
) =>
  Promise.all(
    queryKeys.map((key) =>
      queryClient.invalidateQueries({
        queryKey: key,
      }),
    ),
  );

async function loadTagStatsEfficiently(
  tagsData: Tag[],
): Promise<TagWithStats[]> {
  try {
    const noteTags = tagsData.filter((tag) => tag.entity_type === "note");
    const personTags = tagsData.filter((tag) => tag.entity_type === "person");
    const visionTags = tagsData.filter((tag) => tag.entity_type === "vision");
    const otherTags = tagsData.filter(
      (tag) => !["note", "person", "vision"].includes(tag.entity_type),
    );

    let noteTagsWithStats: TagWithStats[] = [];
    let personTagsWithStats: TagWithStats[] = [];
    let visionTagsWithStats: TagWithStats[] = [];
    let otherTagsWithStats: TagWithStats[] = [];

    if (noteTags.length > 0) {
      try {
        const noteStats = await tagsApi.getStatsBatch("note");
        const noteTagStatsMap = new Map(
          noteStats.tag_stats.map((stat) => [stat.id, stat.usage_count]),
        );

        noteTagsWithStats = noteTags.map((tag) => ({
          ...tag,
          usageStats: {
            tag_id: tag.id,
            tag_name: tag.name,
            entity_type: tag.entity_type,
            category: tag.category,
            usage_by_entity_type: { note: noteTagStatsMap.get(tag.id) || 0 },
            total_usage: noteTagStatsMap.get(tag.id) || 0,
          },
        }));
      } catch (error) {
        console.warn("Failed to load note tag stats in batch:", error);
        noteTagsWithStats = noteTags.map((tag) => ({
          ...tag,
          usageStats: undefined,
        }));
      }
    }

    if (personTags.length > 0) {
      try {
        const personStats = await tagsApi.getStatsBatch("person");
        const personTagStatsMap = new Map(
          personStats.tag_stats.map((stat) => [stat.id, stat.usage_count]),
        );

        personTagsWithStats = personTags.map((tag) => ({
          ...tag,
          usageStats: {
            tag_id: tag.id,
            tag_name: tag.name,
            entity_type: tag.entity_type,
            category: tag.category,
            usage_by_entity_type: {
              person: personTagStatsMap.get(tag.id) || 0,
            },
            total_usage: personTagStatsMap.get(tag.id) || 0,
          },
        }));
      } catch (error) {
        console.warn("Failed to load person tag stats in batch:", error);
        personTagsWithStats = personTags.map((tag) => ({
          ...tag,
          usageStats: undefined,
        }));
      }
    }

    if (visionTags.length > 0) {
      try {
        const visionStats = await tagsApi.getStatsBatch("vision");
        const visionTagStatsMap = new Map(
          visionStats.tag_stats.map((stat) => [stat.id, stat.usage_count]),
        );

        visionTagsWithStats = visionTags.map((tag) => ({
          ...tag,
          usageStats: {
            tag_id: tag.id,
            tag_name: tag.name,
            entity_type: tag.entity_type,
            category: tag.category,
            usage_by_entity_type: {
              vision: visionTagStatsMap.get(tag.id) || 0,
            },
            total_usage: visionTagStatsMap.get(tag.id) || 0,
          },
        }));
      } catch (error) {
        console.warn("Failed to load vision tag stats in batch:", error);
        visionTagsWithStats = visionTags.map((tag) => ({
          ...tag,
          usageStats: undefined,
        }));
      }
    }

    if (otherTags.length > 0) {
      otherTagsWithStats = await Promise.all(
        otherTags.map(async (tag) => {
          try {
            const stats = await tagsApi.getUsage(tag.id);
            return { ...tag, usageStats: stats };
          } catch (error) {
            console.warn(`Failed to load stats for tag ${tag.id}:`, error);
            return { ...tag, usageStats: undefined };
          }
        }),
      );
    }

    return sortTagsByUsageAndName([
      ...noteTagsWithStats,
      ...personTagsWithStats,
      ...visionTagsWithStats,
      ...otherTagsWithStats,
    ]);
  } catch (error) {
    console.warn(
      "Failed to load tag stats efficiently, falling back to individual calls:",
      error,
    );

    const fallbackTags = await Promise.all(
      tagsData.map(async (tag) => {
        try {
          const stats = await tagsApi.getUsage(tag.id);
          return { ...tag, usageStats: stats };
        } catch (innerError) {
          console.warn(`Failed to load stats for tag ${tag.id}:`, innerError);
          return { ...tag, usageStats: undefined };
        }
      }),
    );

    return sortTagsByUsageAndName(fallbackTags);
  }
}

export function useTagManagerController({
  isOpen,
  entityTypeScope,
  onTagCreated,
  onTagUpdated,
  onTagDeleted,
}: UseTagManagerControllerParams) {
  const queryClient = useQueryClient();
  const normalizedEntityTypeScope = entityTypeScope.trim();
  const categoryQueryScope = normalizedEntityTypeScope;

  const refreshTagCaches = useCallback(
    async (
      context: string,
      options: {
        includeEntityTypes?: boolean;
        relatedEntityType?: string | null;
        relatedEntityTypes?: Array<string | null | undefined>;
      } = { includeEntityTypes: false },
    ) => {
      const tasks: Array<Promise<unknown>> = [
        queryClient.invalidateQueries({
          queryKey: tagsKeys.lists(),
        }),
        queryClient.invalidateQueries({
          queryKey: tagsKeys.categories(categoryQueryScope),
        }),
      ];
      if (options.includeEntityTypes) {
        tasks.push(
          queryClient.invalidateQueries({ queryKey: tagsKeys.entityTypes() }),
        );
      }

      const relatedEntityTypes = new Set(
        [
          options.relatedEntityType,
          ...(options.relatedEntityTypes ?? []),
        ].filter(Boolean),
      );

      relatedEntityTypes.forEach((type) => {
        const ownerKeys = getTagOwnerQueryKeys(type);
        if (ownerKeys.length > 0) {
          tasks.push(invalidateQueriesByKeys(queryClient, ownerKeys));
        }
      });

      try {
        await Promise.all(tasks);
      } catch (error) {
        console.warn(context, error);
      }
    },
    [queryClient, categoryQueryScope],
  );

  const syncTagCachesLocally = useCallback(
    (tag: Tag, action: "create" | "update") => {
      const listPredicate = (query: { queryKey?: unknown }) =>
        Array.isArray(query.queryKey) &&
        query.queryKey.length >= 2 &&
        query.queryKey[0] === "tags" &&
        query.queryKey[1] === "list";

      queryClient
        .getQueriesData({
          predicate: listPredicate,
        })
        .forEach(([queryKey, data]) => {
          if (!Array.isArray(data)) {
            return;
          }

          const normalizedQueryKey = queryKey;
          if (!Array.isArray(normalizedQueryKey)) return;

          const listFilters = getTagListFilters(normalizedQueryKey);
          queryClient.setQueryData(
            normalizedQueryKey,
            (prev: Tag[] | undefined) => {
              if (!Array.isArray(prev)) {
                return prev;
              }

              return upsertTagIntoTagList(prev, tag, action, listFilters);
            },
          );
        });

      queryClient
        .getQueriesData({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === "tags" &&
            query.queryKey.includes("with-stats"),
        })
        .forEach(([queryKey, data]) => {
          if (!Array.isArray(data)) {
            return;
          }

          queryClient.setQueryData(
            queryKey,
            (prev: TagWithStats[] | undefined) => {
              if (!Array.isArray(prev)) {
                return prev;
              }
              return action === "update"
                ? updateTagInStatsList(prev, tag)
                : prev;
            },
          );
        });
    },
    [queryClient],
  );

  const removeTagFromLocalCaches = useCallback(
    (tagId: UUID) => {
      const listPredicate = (query: { queryKey?: unknown }) =>
        Array.isArray(query.queryKey) &&
        query.queryKey.length >= 2 &&
        query.queryKey[0] === "tags" &&
        query.queryKey[1] === "list";

      queryClient
        .getQueriesData({ predicate: listPredicate })
        .forEach(([queryKey, data]) => {
          if (!Array.isArray(data)) {
            return;
          }

          queryClient.setQueryData(queryKey, (prev: Tag[] | undefined) => {
            if (!Array.isArray(prev)) {
              return prev;
            }
            return prev.filter((item) => item.id !== tagId);
          });
        });

      queryClient
        .getQueriesData({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === "tags" &&
            query.queryKey.includes("with-stats"),
        })
        .forEach(([queryKey, data]) => {
          if (!Array.isArray(data)) {
            return;
          }

          queryClient.setQueryData(
            queryKey,
            (prev: TagWithStats[] | undefined) => {
              if (!Array.isArray(prev)) {
                return prev;
              }
              return prev.filter((item) => item.id !== tagId);
            },
          );
        });
    },
    [queryClient],
  );

  const {
    data: entityTypesData,
    isLoading: typesLoading,
    error: typesError,
  } = useQuery({
    queryKey: tagsKeys.entityTypes(),
    queryFn: () => tagsApi.getEntityTypes(),
    enabled: isOpen,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });
  const entityTypes = useMemo(() => entityTypesData ?? [], [entityTypesData]);

  const {
    data: categoriesData,
    isLoading: categoriesLoading,
    error: categoriesError,
  } = useQuery({
    queryKey: tagsKeys.categories(categoryQueryScope),
    queryFn: () => tagsApi.getCategories(categoryQueryScope),
    enabled: isOpen,
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  const tagListFilters = useMemo(
    () => ({
      page: 1,
      size: 1000,
      ...(normalizedEntityTypeScope
        ? { entity_type: normalizedEntityTypeScope }
        : {}),
    }),
    [normalizedEntityTypeScope],
  );

  const {
    data: tagsDataRaw,
    isLoading: tagsLoading,
    error: tagsError,
    isFetching: tagsFetching,
  } = useQuery({
    queryKey: tagsKeys.list(tagListFilters),
    queryFn: async () => {
      const response = await tagsApi.getAll(tagListFilters);
      return response.items ?? [];
    },
    enabled: isOpen,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const tagsData = useMemo(() => tagsDataRaw ?? [], [tagsDataRaw]);

  const {
    data: tagsWithStatsRaw,
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = useQuery({
    queryKey: tagsKeys.withStats(tagsData.map((tag) => tag.id)),
    queryFn: () => loadTagStatsEfficiently(tagsData),
    enabled: isOpen && tagsData.length > 0,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
  const tagsWithStats = useMemo(
    () => tagsWithStatsRaw ?? [],
    [tagsWithStatsRaw],
  );

  const createTagMutation = useMutation({
    mutationFn: (payload: TagCreate) => tagsApi.create(payload),
    onSuccess: async (createdTag) => {
      setTagDetailCache(queryClient, createdTag);
      syncTagCachesLocally(createdTag, "create");
      await refreshTagCaches("Failed to refresh tag caches after creation", {
        includeEntityTypes: true,
        relatedEntityType: createdTag.entity_type || normalizedEntityTypeScope,
      });
      onTagCreated?.(createdTag);
    },
  });

  const bulkUpdateTagCategoriesMutation = useMutation({
    mutationFn: (payload: { ids: UUID[]; category: string }) =>
      tagsApi.bulkUpdateCategories(payload),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, updates }: { id: UUID; updates: TagUpdate }) =>
      tagsApi.update(id, updates),
    onSuccess: async (updatedTag) => {
      setTagDetailCache(queryClient, updatedTag);
      syncTagCachesLocally(updatedTag, "update");
      await refreshTagCaches("Failed to refresh tag caches after update", {
        relatedEntityType: updatedTag.entity_type || normalizedEntityTypeScope,
      });
      onTagUpdated?.(updatedTag);
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: UUID) => tagsApi.delete(id),
    onSuccess: async (_, id) => {
      removeTagDetailCache(queryClient, id);
      removeTagFromLocalCaches(id);
      await refreshTagCaches("Failed to refresh tag caches after deletion", {
        includeEntityTypes: true,
        relatedEntityType: normalizedEntityTypeScope,
      });
      onTagDeleted?.(id);
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (label: string) =>
      tagsApi.createCategory({ label }, categoryQueryScope),
    onSuccess: async (createdCategory) => {
      queryClient.setQueryData<TagCategoryOption[]>(
        tagsKeys.categories(categoryQueryScope),
        (prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          if (!next.some((item) => item.value === createdCategory.value)) {
            next.push(createdCategory);
          }
          return next;
        },
      );
      await refreshTagCaches(
        "Failed to refresh tag caches after category create",
        {
          includeEntityTypes: true,
          relatedEntityType: normalizedEntityTypeScope,
        },
      );
    },
  });

  const renameCategoryMutation = useMutation({
    mutationFn: ({ value, label }: { value: string; label: string }) =>
      tagsApi.renameCategory(value, { label }, categoryQueryScope),
    onSuccess: async (updatedCategory) => {
      queryClient.setQueryData<TagCategoryOption[]>(
        tagsKeys.categories(categoryQueryScope),
        (prev) => {
          const next = Array.isArray(prev) ? [...prev] : [];
          return next.map((item) =>
            item.value === updatedCategory.value ? updatedCategory : item,
          );
        },
      );
      await refreshTagCaches(
        "Failed to refresh tag caches after category rename",
        {
          includeEntityTypes: true,
          relatedEntityType: normalizedEntityTypeScope,
        },
      );
    },
  });

  const createTag = useCallback(
    async (payload: TagCreate) => {
      return createTagMutation.mutateAsync(payload);
    },
    [createTagMutation],
  );

  const updateTag = useCallback(
    async (id: UUID, updates: TagUpdate) => {
      return updateTagMutation.mutateAsync({ id, updates });
    },
    [updateTagMutation],
  );

  const deleteTag = useCallback(
    async (id: UUID) => {
      await deleteTagMutation.mutateAsync(id);
    },
    [deleteTagMutation],
  );

  const createCategory = useCallback(
    async (label: string) => {
      return createCategoryMutation.mutateAsync(label);
    },
    [createCategoryMutation],
  );

  const renameCategory = useCallback(
    async (payload: { value: string; label: string }) => {
      return renameCategoryMutation.mutateAsync(payload);
    },
    [renameCategoryMutation],
  );

  const bulkUpdateTagCategories = useCallback(
    async (payload: { ids: UUID[]; category: string }) => {
      const result: TagBulkUpdateResponse =
        await bulkUpdateTagCategoriesMutation.mutateAsync(payload);

      const affectedEntityTypes = new Set<string>();
      result.updated_tags.forEach((tag) => {
        affectedEntityTypes.add(tag.entity_type);
        setTagDetailCache(queryClient, tag);
        syncTagCachesLocally(tag, "update");
      });

      await refreshTagCaches(
        "Failed to refresh tag caches after bulk category update",
        {
          includeEntityTypes: true,
          relatedEntityType: normalizedEntityTypeScope || null,
          relatedEntityTypes: Array.from(affectedEntityTypes),
        },
      );

      return result;
    },
    [
      bulkUpdateTagCategoriesMutation,
      normalizedEntityTypeScope,
      queryClient,
      refreshTagCaches,
      syncTagCachesLocally,
    ],
  );

  return {
    entityTypes,
    categoriesData,
    tagsData,
    tagsWithStats,
    typesLoading,
    categoriesLoading,
    tagsLoading,
    tagsFetching,
    statsLoading,
    statsFetching,
    typesError,
    categoriesError,
    tagsError,
    createTagMutation,
    bulkUpdateTagCategoriesMutation,
    updateTagMutation,
    deleteTagMutation,
    createCategoryMutation,
    renameCategoryMutation,
    createTag,
    updateTag,
    deleteTag,
    createCategory,
    renameCategory,
    bulkUpdateTagCategories,
  };
}
