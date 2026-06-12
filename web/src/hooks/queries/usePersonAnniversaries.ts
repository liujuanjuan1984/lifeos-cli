import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  personsApi,
  type Anniversary,
  type AnniversaryCreate,
} from "@/services/api";
import type { AnniversaryUpdate } from "@/services/api/persons";
import { personsKeys } from "@/services/api/queryKeys";
import { useToast } from "@/contexts/ToastContext";
import type { UUID } from "@/types/primitive";
import {
  invalidatePersonAnniversaries,
  invalidatePersonDetail,
} from "@/services/api/cacheInvalidation/persons";

interface UsePersonAnniversariesResult {
  anniversaries: Anniversary[];
  isLoading: boolean;
  createAnniversary: (payload: AnniversaryCreate) => void;
  updateAnniversary: (anniversaryId: UUID, payload: AnniversaryUpdate) => void;
  deleteAnniversary: (anniversaryId: UUID) => void;
  creating: boolean;
  updatingId: UUID | null;
  deletingId: UUID | null;
}

export function usePersonAnniversaries(
  personId: UUID | null,
): UsePersonAnniversariesResult {
  const queryClient = useQueryClient();
  const toast = useToast();

  const enabled = Boolean(personId);

  const safeKey = personsKeys.anniversaries((personId || "") as UUID);

  const { data, isLoading } = useQuery({
    queryKey: safeKey,
    queryFn: async () => {
      if (!personId) {
        return [];
      }
      const response = await personsApi.getAnniversaries(personId as UUID);
      return response.items ?? [];
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation<Anniversary, Error, AnniversaryCreate>({
    mutationFn: (payload: AnniversaryCreate) =>
      personsApi.createAnniversary(personId as UUID, payload),
    onSuccess: async () => {
      toast.showSuccess("纪念日已创建");
      if (personId) {
        await Promise.all([
          invalidatePersonAnniversaries(queryClient, personId),
          invalidatePersonDetail(queryClient, personId),
        ]);
      }
    },
    onError: (err: Error) => {
      toast.showError("纪念日创建失败", err.message);
    },
  });

  const deleteMutation = useMutation<void, Error, UUID>({
    mutationFn: (anniversaryId: UUID) =>
      personsApi.deleteAnniversary(personId as UUID, anniversaryId),
    onSuccess: async () => {
      toast.showSuccess("纪念日已删除");
      if (personId) {
        await Promise.all([
          invalidatePersonAnniversaries(queryClient, personId),
          invalidatePersonDetail(queryClient, personId),
        ]);
      }
    },
    onError: (err: Error) => {
      toast.showError("纪念日删除失败", err.message);
    },
  });

  const updateMutation = useMutation<
    Anniversary,
    Error,
    { anniversaryId: UUID; payload: AnniversaryUpdate }
  >({
    mutationFn: ({ anniversaryId, payload }) =>
      personsApi.updateAnniversary(personId as UUID, anniversaryId, payload),
    onSuccess: async () => {
      toast.showSuccess("纪念日已更新");
      if (personId) {
        await Promise.all([
          invalidatePersonAnniversaries(queryClient, personId),
          invalidatePersonDetail(queryClient, personId),
        ]);
      }
    },
    onError: (err: Error) => {
      toast.showError("纪念日更新失败", err.message);
    },
  });

  return {
    anniversaries: data || [],
    isLoading,
    createAnniversary: (payload) => {
      if (!personId) {
        toast.showError("无法创建纪念日", "缺少联系人信息");
        return;
      }
      createMutation.mutate(payload);
    },
    updateAnniversary: (anniversaryId, payload) => {
      if (!personId) {
        toast.showError("无法更新纪念日", "缺少联系人信息");
        return;
      }
      updateMutation.mutate({ anniversaryId, payload });
    },
    deleteAnniversary: (anniversaryId) => {
      if (!personId) {
        toast.showError("无法删除纪念日", "缺少联系人信息");
        return;
      }
      deleteMutation.mutate(anniversaryId);
    },
    creating: createMutation.isPending,
    updatingId:
      (updateMutation.variables as { anniversaryId: UUID } | null)
        ?.anniversaryId ?? null,
    deletingId: (deleteMutation.variables as UUID | null) ?? null,
  };
}
