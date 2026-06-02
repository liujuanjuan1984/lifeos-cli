import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { llmCredentialApi } from "@/services/api/llmCredentials";
import { llmCredentialKeys } from "@/services/api/queryKeys";
import { invalidateLlmCredentialList } from "@/services/api/cacheInvalidation/llmCredentials";
import { useToast } from "@/contexts/ToastContext";
import type {
  LlmCredential,
  LlmCredentialPayload,
  LlmCredentialUpdatePayload,
  LlmCredentialTestRequest,
} from "@/services/api/llmCredentials";

interface UserLlmCredential {
  id: string;
  provider: string;
  displayName: string | null;
  tokenLast4: string | null;
  apiBase: string | null;
  modelOverride: string | null;
  isDefault: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const normalizeCredential = (record: LlmCredential): UserLlmCredential => ({
  id: record.id,
  provider: record.provider,
  displayName: record.display_name ?? null,
  tokenLast4: record.token_last4 ?? null,
  apiBase: record.api_base ?? null,
  modelOverride: record.model_override ?? null,
  isDefault: Boolean(record.is_default),
  lastUsedAt: record.last_used_at ?? null,
  createdAt: record.created_at,
  updatedAt: record.updated_at,
});

export function useUserLlmCredentials() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();

  const listQuery = useQuery({
    queryKey: llmCredentialKeys.list(),
    queryFn: async () => {
      return await llmCredentialApi.list();
    },
    staleTime: 60_000,
  });

  const invalidateList = async () => {
    await invalidateLlmCredentialList(queryClient);
  };

  const createMutation = useMutation({
    mutationFn: (payload: LlmCredentialPayload) =>
      llmCredentialApi.create(payload),
    onSuccess: async () => {
      await invalidateList();
      toast.showSuccess(t("settings.llm.toasts.saveSuccess"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: LlmCredentialUpdatePayload;
    }) => llmCredentialApi.update(id, payload),
    onSuccess: async () => {
      await invalidateList();
      toast.showSuccess(t("settings.llm.toasts.updateSuccess"));
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => llmCredentialApi.setDefault(id),
    onSuccess: async () => {
      await invalidateList();
      toast.showSuccess(t("settings.llm.toasts.defaultSuccess"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => llmCredentialApi.remove(id),
    onSuccess: async () => {
      await invalidateList();
      toast.showSuccess(t("settings.llm.toasts.deleteSuccess"));
    },
  });

  const testMutation = useMutation({
    mutationFn: (payload: LlmCredentialTestRequest) =>
      llmCredentialApi.test(payload),
    onSuccess: () => {
      toast.showSuccess(t("settings.llm.toasts.testSuccess"));
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error
          ? error.message
          : t("settings.llm.toasts.testFail");
      toast.showError(t("settings.llm.toasts.testFail"), message);
    },
  });

  const isLoading =
    listQuery.isLoading ||
    createMutation.isPending ||
    updateMutation.isPending ||
    setDefaultMutation.isPending ||
    deleteMutation.isPending;

  const error = listQuery.error instanceof Error ? listQuery.error : undefined;

  return {
    credentials: listQuery.data?.items.map(normalizeCredential) ?? [],
    total: listQuery.data?.pagination?.total ?? 0,
    isLoading,
    isFetching: listQuery.isFetching,
    error,
    refresh: async () => {
      await listQuery.refetch();
    },
    createCredential: createMutation.mutateAsync,
    updateCredential: updateMutation.mutateAsync,
    setDefaultCredential: setDefaultMutation.mutateAsync,
    deleteCredential: deleteMutation.mutateAsync,
    testCredential: testMutation.mutateAsync,
    isTesting: testMutation.isPending,
  };
}
