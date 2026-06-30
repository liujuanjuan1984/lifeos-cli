import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  invalidateTagList,
  setTagDetailCache,
} from "@/services/api/cacheInvalidation/tags";
import { tagsApi } from "@/services/api/tags";
import { tagsKeys } from "@/services/api/queryKeys";
import type { Tag } from "@/services/api/tags";

interface UseTagSelectorSourceOptions {
  /** Tag entity 类型，例如 note/person */
  entityType: string;
  /** Tag category 过滤，例如 general/location */
  category?: string;
  /** React Query 缓存时间，默认 5 分钟 */
  ttlMs?: number;
}

interface UseTagSelectorSourceResult {
  tags: Tag[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<unknown>;
  createTag: (name: string) => Promise<Tag>;
}

const DEFAULT_TTL = 5 * 60 * 1000;
const DEFAULT_PAGE = 1;
const DEFAULT_SIZE = 1000;

export const useTagSelectorSource = (
  options: UseTagSelectorSourceOptions,
): UseTagSelectorSourceResult => {
  const { entityType, category, ttlMs = DEFAULT_TTL } = options;
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const listFilters = {
    entity_type: entityType,
    category,
    page: DEFAULT_PAGE,
    size: DEFAULT_SIZE,
    fields: "selector" as const,
  };

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: tagsKeys.list(listFilters),
    queryFn: async () => {
      const list = await tagsApi.getAll(listFilters);
      return Array.isArray(list?.items) ? list.items : [];
    },
    staleTime: ttlMs,
  });

  const createTag = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error(
        t("tagSelector.errors.nameRequired", {
          defaultValue: "Tag name required",
        }),
      );
    }

    const created = await tagsApi.create({
      name: trimmed,
      entity_type: entityType,
      category,
    });
    setTagDetailCache(queryClient, created);

    await invalidateTagList(queryClient, listFilters);

    return created;
  };

  return {
    tags: data,
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : t("common.loading")
      : null,
    refresh: () => refetch(),
    createTag,
  };
};
