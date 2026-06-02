import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { invitationsApi, ApiError } from "@/services/api";
import { invitationsKeys } from "@/services/api/queryKeys";
import { invalidateInvitationMineLists } from "@/services/api/cacheInvalidation/invitations";
import { getUser } from "@/services/auth";
import { useToast } from "@/contexts/ToastContext";

const PAGE = 1;
const SIZE = 100;

export function useInvitationsPageController() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const user = getUser();
  const isAdmin = Boolean(user?.is_superuser);
  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const [email, setEmail] = useState("");
  const [memo, setMemo] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: invitedMeResponse, isLoading: loadingInvitedMe } = useQuery({
    queryKey: invitationsKeys.invitedMe({ page: PAGE, size: SIZE }),
    queryFn: () => invitationsApi.getInvitedMe(PAGE, SIZE),
  });

  const { data: myInvitationsResponse, isLoading: loadingMine } = useQuery({
    queryKey: invitationsKeys.mine({ page: PAGE, size: SIZE }),
    queryFn: () => invitationsApi.getMyInvitations(PAGE, SIZE),
  });

  const invitedMe = useMemo(
    () => invitedMeResponse?.items ?? [],
    [invitedMeResponse],
  );
  const myInvitations = useMemo(
    () => myInvitationsResponse?.items ?? [],
    [myInvitationsResponse],
  );

  const createMutation = useMutation({
    mutationFn: invitationsApi.createInvitation,
    onSuccess: () => {
      invalidateInvitationMineLists(queryClient);
      setEmail("");
      setMemo("");
      setFormError(null);
      toast.showSuccess(t("invitations.toast.createSuccess"));
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiError
          ? error.message
          : t("invitations.toast.createFailed");
      toast.showError(t("invitations.toast.createFailed"), message);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: invitationsApi.revokeInvitation,
    onSuccess: () => {
      invalidateInvitationMineLists(queryClient);
      toast.showSuccess(t("invitations.toast.revokeSuccess"));
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiError
          ? error.message
          : t("invitations.toast.revokeFailed");
      toast.showError(t("invitations.toast.revokeFailed"), message);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: invitationsApi.restoreInvitation,
    onSuccess: () => {
      invalidateInvitationMineLists(queryClient);
      toast.showSuccess(t("invitations.toast.restoreSuccess"));
    },
    onError: (error: unknown) => {
      const message =
        error instanceof ApiError
          ? error.message
          : t("invitations.toast.restoreFailed");
      toast.showError(t("invitations.toast.restoreFailed"), message);
    },
  });

  const revokingId = revokeMutation.variables ?? null;
  const restoringId = restoreMutation.variables ?? null;
  const isCreating = createMutation.status === "pending";
  const isRevoking = revokeMutation.status === "pending";
  const isRestoring = restoreMutation.status === "pending";

  const sortedInvitations = useMemo(() => {
    return [...myInvitations].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  }, [myInvitations]);

  const createInvitation = async () => {
    if (!isAdmin) return false;

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setFormError(t("invitations.validation.emailRequired"));
      return false;
    }

    setFormError(null);
    await createMutation.mutateAsync({
      email: normalizedEmail,
      memo: memo.trim() ? memo.trim() : undefined,
    });
    return true;
  };

  return {
    appOrigin,
    isAdmin,
    email,
    memo,
    formError,
    setEmail,
    setMemo,
    invitedMe,
    sortedInvitations,
    loadingInvitedMe,
    loadingMine,
    createInvitation,
    revokeInvitation: revokeMutation.mutate,
    restoreInvitation: restoreMutation.mutate,
    isCreating,
    isRevoking,
    isRestoring,
    revokingId,
    restoringId,
  };
}
