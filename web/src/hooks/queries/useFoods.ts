import { useQuery, useQueryClient } from "@tanstack/react-query";
import { foodsApi } from "@/services/api";
import { foodsKeys } from "@/services/api/queryKeys";

interface UseFoodsParams {
  search?: string;
  commonOnly?: boolean;
  size?: number;
  staleTimeMs?: number;
  gcTimeMs?: number;
}

export function useFoods({
  search,
  commonOnly = false,
  size = 100,
  staleTimeMs = 60 * 1000,
  gcTimeMs = 5 * 60 * 1000,
}: UseFoodsParams) {
  const queryClient = useQueryClient();
  const page = 1;

  const query = useQuery({
    queryKey: foodsKeys.list({
      search: search || "",
      common_only: commonOnly,
      page,
      size,
    }),
    queryFn: async () => {
      const list = await foodsApi.getFoods({
        search: search || undefined,
        common_only: commonOnly,
        page,
        size,
      });
      return list;
    },
    staleTime: staleTimeMs,
    gcTime: gcTimeMs,
    // v5 replacement for keepPreviousData
    placeholderData: (prev) => prev ?? undefined,
  });

  const prefetch = (params: {
    search?: string;
    commonOnly?: boolean;
    size?: number;
  }) => {
    const s = params.search || "";
    const c = params.commonOnly ?? false;
    const nextSize = params.size ?? size;
    return queryClient.prefetchQuery({
      queryKey: foodsKeys.list({
        search: s,
        common_only: c,
        page,
        size: nextSize,
      }),
      queryFn: () =>
        foodsApi.getFoods({
          search: s || undefined,
          common_only: c,
          page,
          size: nextSize,
        }),
      staleTime: staleTimeMs,
      gcTime: gcTimeMs,
    });
  };

  return {
    foods: query.data?.items ?? [],
    query,
    prefetch,
  };
}
