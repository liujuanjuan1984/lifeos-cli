import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  timelogTemplatesApi,
  type TimelogTemplate,
  type TimelogTemplateCreateRequest,
  type TimelogTemplateUpdateRequest,
  type TimelogTemplatesListResponse,
} from "@/services/api/timelogTemplates";
import { timelogTemplatesKeys } from "@/services/api/queryKeys";
import { invalidateTimelogTemplateLists } from "@/services/api/cacheInvalidation/timelogTemplates";

const DEFAULT_SIZE = 50;

const DEFAULT_LIST_PARAMS = {
  page: 1,
  size: DEFAULT_SIZE,
  order_by: "position" as const,
};

export function useTimelogTemplates() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const query = useQuery<TimelogTemplatesListResponse>({
    queryKey: timelogTemplatesKeys.list(DEFAULT_LIST_PARAMS),
    queryFn: async () => timelogTemplatesApi.list(DEFAULT_LIST_PARAMS),
    staleTime: 5 * 60 * 1000,
  });

  const templates = useMemo<TimelogTemplate[]>(() => {
    const items = query.data?.items ?? [];
    return [...items].sort((a, b) => a.position - b.position);
  }, [query.data]);

  const invalidate = useCallback(() => {
    return invalidateTimelogTemplateLists(queryClient);
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: (payload: TimelogTemplateCreateRequest) =>
      timelogTemplatesApi.create(payload),
    onSuccess: () => invalidate(),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: TimelogTemplate["id"];
      payload: TimelogTemplateUpdateRequest;
    }) => timelogTemplatesApi.update(id, payload),
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: TimelogTemplate["id"]) =>
      timelogTemplatesApi.remove(id),
    onSuccess: () => invalidate(),
  });

  const reorderMutation = useMutation({
    mutationFn: (
      items: { id: TimelogTemplate["id"]; position: number }[],
    ) => timelogTemplatesApi.reorder(items),
    onSuccess: () => invalidate(),
  });

  const bumpMutation = useMutation({
    mutationFn: (id: TimelogTemplate["id"]) =>
      timelogTemplatesApi.bumpUsage(id),
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
