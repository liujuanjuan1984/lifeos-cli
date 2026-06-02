import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  actualEventTemplatesApi,
  type ActualEventTemplate,
  type ActualEventTemplateCreateRequest,
  type ActualEventTemplateUpdateRequest,
  type ActualEventTemplatesListResponse,
} from "@/services/api/actualEventTemplates";
import { actualEventTemplatesKeys } from "@/services/api/queryKeys";
import { invalidateActualEventTemplateLists } from "@/services/api/cacheInvalidation/actualEventTemplates";

const DEFAULT_SIZE = 50;

const DEFAULT_LIST_PARAMS = {
  page: 1,
  size: DEFAULT_SIZE,
  order_by: "position" as const,
};

export function useActualEventTemplates() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const query = useQuery<ActualEventTemplatesListResponse>({
    queryKey: actualEventTemplatesKeys.list(DEFAULT_LIST_PARAMS),
    queryFn: async () => actualEventTemplatesApi.list(DEFAULT_LIST_PARAMS),
    staleTime: 5 * 60 * 1000,
  });

  const templates = useMemo<ActualEventTemplate[]>(() => {
    const items = query.data?.items ?? [];
    return [...items].sort((a, b) => a.position - b.position);
  }, [query.data]);

  const invalidate = useCallback(() => {
    return invalidateActualEventTemplateLists(queryClient);
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (payload: ActualEventTemplateCreateRequest) =>
      actualEventTemplatesApi.create(payload),
    onSuccess: () => invalidate(),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: ActualEventTemplate["id"];
      payload: ActualEventTemplateUpdateRequest;
    }) => actualEventTemplatesApi.update(id, payload),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: ActualEventTemplate["id"]) =>
      actualEventTemplatesApi.remove(id),
    onSuccess: () => invalidate(),
  });

  const reorderMutation = useMutation({
    mutationFn: (
      items: { id: ActualEventTemplate["id"]; position: number }[],
    ) => actualEventTemplatesApi.reorder(items),
    onSuccess: () => invalidate(),
  });

  const bumpMutation = useMutation({
    mutationFn: (id: ActualEventTemplate["id"]) =>
      actualEventTemplatesApi.bumpUsage(id),
    onSuccess: () => invalidate(),
  });

  const errorMessage = useMemo(() => {
    if (!query.error) return null;
    if (query.error instanceof Error) return query.error.message;
    return t("common.unknown_error");
  }, [query.error, t]);

  return {
    templates,
    total: query.data?.pagination.total ?? templates.length,
    loading: query.isLoading,
    refreshing: query.isFetching,
    error: errorMessage,
    refetch: query.refetch,
    createTemplate: createMutation.mutateAsync,
    updateTemplate: updateMutation.mutateAsync,
    deleteTemplate: deleteMutation.mutateAsync,
    reorderTemplates: reorderMutation.mutateAsync,
    bumpTemplateUsage: bumpMutation.mutateAsync,
    isMutating:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      reorderMutation.isPending,
  };
}
