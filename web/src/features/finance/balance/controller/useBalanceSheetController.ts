import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useToastMutation } from "@/hooks/useToastMutation";
import { financeApi } from "@/services/api/finance";
import { financeKeys } from "@/services/api/queryKeys";
import {
  invalidateBalanceAccountTree,
  invalidateBalanceAccountTrees,
  invalidateBalanceSnapshots,
  invalidateBalanceSnapshotsAll,
  removeBalanceSnapshotDetailCache,
} from "@/services/api/cacheInvalidation/financeBalance";
import { formatDateTime } from "@/utils/datetime";
import {
  formatDecimalValue,
  useSnapshotSelection,
  useSnapshotToolbarActions,
} from "@/features/finance/shared";
import { useFinanceAccountsExport } from "@/hooks/useExport";
import type {
  BalanceSnapshotDetail,
  BalanceSnapshotListResponse,
  BalanceSnapshotSummary,
  CreateSnapshotPayload,
  FinanceAccountCreatePayload,
  FinanceAccount,
  FinanceAccountUpdatePayload,
  FinanceAccountTreeItem,
} from "@/services/api/finance";
import type { UUID } from "@/types/primitive";
import type {
  SnapshotSectionConfig,
  SnapshotToolbarConfig,
} from "@/features/finance/snapshot/SnapshotModule";

const DRAFT_SNAPSHOT_ID = "__draft__";

export interface BalanceSheetController {
  status: {
    isLoading: boolean;
    error: Error | null;
  };
  snapshotList: {
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
  };
  toolbar: SnapshotToolbarConfig<string>;
  snapshot: SnapshotSectionConfig<
    string,
    BalanceSnapshotSummary,
    BalanceSnapshotDetail,
    CreateSnapshotPayload,
    CreateSnapshotPayload
  >;
  form: {
    accountTree: FinanceAccount[];
    latestSnapshotDetail: BalanceSnapshotDetail | null | undefined;
    editingSnapshotId: UUID | null;
    snapshotTimestamp: string | null;
    onChangeSnapshotTimestamp: (value: string | null) => void;
    primaryCurrency: string;
    treeId: UUID | null;
    treeName: string | null;
    treeOptions: Array<{ value: UUID; label: string }>;
    onChangeTree: (id: UUID) => void;
    treeSelectionDisabled: boolean;
  };
  detail: {
    accountTree: FinanceAccount[];
    treeName: string | null;
  };
  accountManager: {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    accounts: FinanceAccount[];
    treeId: UUID | null;
    treeOptions: Array<{ value: UUID; label: string }>;
    onChangeTree: (id: UUID) => void;
    onManageTree: () => void;
    primaryCurrency: string;
    loading: boolean;
    error: string | null;
    onCreateAccount: (payload: FinanceAccountCreatePayload) => Promise<void>;
    onUpdateAccount: (
      id: UUID,
      payload: FinanceAccountUpdatePayload,
    ) => Promise<void>;
    onDeleteAccount: (id: UUID) => Promise<void>;
    createPending: boolean;
    updatePending: boolean;
    deletePending: boolean;
  };
  treeManager: {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    trees: FinanceAccountTreeItem[];
    loading: boolean;
    error: string | null;
    onCreateTree: (name: string, isDefault?: boolean) => Promise<void>;
    onRenameTree: (id: UUID, name: string) => Promise<void>;
    onDeleteTree: (id: UUID) => Promise<void>;
    onSetDefault: (id: UUID) => Promise<void>;
    onExportTree: (id: UUID) => Promise<void>;
    createPending: boolean;
    updatePending: boolean;
    deletePending: boolean;
  };
  deleteDialog: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
  };
  actions: {
    openAccountManager: () => void;
    openSnapshotForm: () => void;
  };
}

export function useBalanceSheetController(): BalanceSheetController {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { exportData: exportAccounts } = useFinanceAccountsExport();

  const [accountTreeId, setAccountTreeId] = useState<UUID | null>(null);
  const [draftTreeId, setDraftTreeId] = useState<UUID | null>(null);
  const [isTreeManagerOpen, setTreeManagerOpen] = useState(false);

  const [isAccountManagerOpen, setAccountManagerOpen] = useState(false);
  const [isSnapshotFormVisible, setSnapshotFormVisible] = useState(false);
  const [snapshotFormMode, setSnapshotFormMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(
    null,
  );
  const [editingSnapshotTreeId, setEditingSnapshotTreeId] =
    useState<UUID | null>(null);
  const [snapshotPendingDelete, setSnapshotPendingDelete] =
    useState<BalanceSnapshotSummary | null>(null);
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<string | null>(
    null,
  );

  const {
    data: accountTrees,
    isLoading: accountTreesLoading,
    error: accountTreesError,
  } = useQuery({
    queryKey: financeKeys.accountTrees(),
    queryFn: financeApi.listAccountTrees,
  });

  const defaultTreeId = useMemo(() => {
    if (!accountTrees?.length) {
      return null;
    }
    const defaultTree =
      accountTrees.find((tree) => tree.is_default) ?? accountTrees[0];
    return defaultTree.id as UUID;
  }, [accountTrees]);

  useEffect(() => {
    if (!accountTrees?.length) {
      return;
    }
    if (
      accountTreeId &&
      accountTrees.some((tree) => tree.id === accountTreeId)
    ) {
      return;
    }
    if (defaultTreeId) {
      setAccountTreeId(defaultTreeId);
    }
  }, [accountTrees, accountTreeId, defaultTreeId]);

  useEffect(() => {
    if (!accountTrees?.length) {
      return;
    }
    if (draftTreeId && accountTrees.some((tree) => tree.id === draftTreeId)) {
      return;
    }
    if (defaultTreeId) {
      setDraftTreeId(defaultTreeId);
    }
  }, [accountTrees, draftTreeId, defaultTreeId]);

  const createAccountTreeMutation = useToastMutation({
    mutationFn: financeApi.createAccountTree,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.accountTreeCreateSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.accountTreeCreateFailed"),
    }),
    onSuccess: (_data) => {
      invalidateBalanceAccountTrees(queryClient);
    },
  });

  const updateAccountTreeMutation = useToastMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: UUID;
      payload: {
        name?: string;
        is_default?: boolean;
        display_order?: number | null;
      };
    }) => financeApi.updateAccountTree(id, payload),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.accountTreeUpdateSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.accountTreeUpdateFailed"),
    }),
    onSuccess: (_data) => {
      invalidateBalanceAccountTrees(queryClient);
    },
  });

  const deleteAccountTreeMutation = useToastMutation({
    mutationFn: financeApi.deleteAccountTree,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.accountTreeDeleteSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.accountTreeDeleteFailed"),
    }),
    onSuccess: (_, treeId) => {
      invalidateBalanceAccountTrees(queryClient);
      if (treeId && treeId === accountTreeId) {
        setAccountTreeId(null);
      }
      if (treeId && treeId === draftTreeId) {
        setDraftTreeId(null);
      }
    },
  });

  const {
    data: accountTree,
    isLoading: accountTreeLoading,
    error: accountTreeError,
  } = useQuery({
    queryKey: financeKeys.accountTree(accountTreeId),
    queryFn: () =>
      financeApi.getAccountTree({ tree_id: accountTreeId ?? undefined }),
    enabled: Boolean(accountTreeId),
  });

  const treeOptions = useMemo(
    () =>
      (accountTrees ?? []).map((tree) => ({
        value: tree.id as UUID,
        label: tree.name,
      })),
    [accountTrees],
  );
  const handleExportAccounts = async (treeId?: UUID | null) => {
    await exportAccounts(
      { tree_id: treeId ?? undefined },
      { forceFile: true, showToasts: true },
    );
  };

  const {
    data: snapshotSummariesData,
    isLoading: snapshotsLoading,
    fetchNextPage: fetchNextSnapshots,
    hasNextPage: hasMoreSnapshots,
    isFetchingNextPage: snapshotsLoadingMore,
  } = useInfiniteQuery({
    queryKey: financeKeys.snapshotsAll(),
    queryFn: ({ pageParam = 1 }) =>
      financeApi.listSnapshots({
        page: pageParam as number,
        size: 100,
      }),
    getNextPageParam: (lastPage) => {
      const currentPage = lastPage.pagination.page;
      return currentPage < lastPage.pagination.pages
        ? currentPage + 1
        : undefined;
    },
    initialPageParam: 1,
    placeholderData: (previousData) => previousData,
  });
  const snapshotSummaries = useMemo(() => {
    if (!snapshotSummariesData?.pages) {
      return [];
    }
    return snapshotSummariesData.pages.flatMap((page) => page.items ?? []);
  }, [snapshotSummariesData]);

  const formatSnapshotOptionLabel = useCallback(
    (snapshot: BalanceSnapshotSummary) => {
      const timestampLabel = formatDateTime(snapshot.snapshot_ts);
      const netWorthRaw = snapshot.metrics?.net_worth;
      if (!netWorthRaw) {
        return timestampLabel;
      }
      const formattedNetWorth = formatDecimalValue(netWorthRaw) ?? netWorthRaw;
      const netWorthLabel = t("finance.metricNetWorth");
      return `${timestampLabel} · ${netWorthLabel} ${formattedNetWorth} ${snapshot.primary_currency}`;
    },
    [t],
  );

  const {
    orderedSnapshots,
    selectedId: selectedSnapshotId,
    setSelectedId: setSelectedSnapshotId,
    currentSnapshot,
    effectiveIndex,
    hasPrevious,
    hasNext,
    goToPrevious,
    goToNext,
    options: snapshotOptions,
  } = useSnapshotSelection<BalanceSnapshotSummary, UUID>({
    snapshots: snapshotSummaries,
    getId: (snapshot) => snapshot.id as UUID,
    sortSnapshots: (a, b) =>
      new Date(b.snapshot_ts).getTime() - new Date(a.snapshot_ts).getTime(),
    getOptionLabel: formatSnapshotOptionLabel,
  });

  const detailTreeId = currentSnapshot?.tree_id ?? null;

  const detailTreeName = useMemo(() => {
    if (!detailTreeId) {
      return null;
    }
    return accountTrees?.find((tree) => tree.id === detailTreeId)?.name ?? null;
  }, [accountTrees, detailTreeId]);

  const formTreeId = useMemo(() => {
    if (snapshotFormMode === "edit" && isSnapshotFormVisible) {
      return (
        editingSnapshotTreeId ?? detailTreeId ?? draftTreeId ?? defaultTreeId
      );
    }
    return draftTreeId ?? defaultTreeId;
  }, [
    snapshotFormMode,
    isSnapshotFormVisible,
    editingSnapshotTreeId,
    detailTreeId,
    draftTreeId,
    defaultTreeId,
  ]);

  const formTreeName = useMemo(() => {
    if (!formTreeId) {
      return null;
    }
    return accountTrees?.find((tree) => tree.id === formTreeId)?.name ?? null;
  }, [accountTrees, formTreeId]);

  const { data: formAccountTree } = useQuery({
    queryKey: financeKeys.accountTree(formTreeId),
    queryFn: () =>
      financeApi.getAccountTree({ tree_id: formTreeId ?? undefined }),
    enabled: Boolean(formTreeId),
  });

  const { data: detailAccountTree } = useQuery({
    queryKey: financeKeys.accountTree(detailTreeId),
    queryFn: () =>
      financeApi.getAccountTree({ tree_id: detailTreeId ?? undefined }),
    enabled: Boolean(detailTreeId),
  });

  const { data: snapshotDetail, isLoading: snapshotDetailLoading } =
    useQuery<BalanceSnapshotDetail>({
      queryKey:
        selectedSnapshotId && detailTreeId
          ? financeKeys.snapshotDetail(selectedSnapshotId as UUID, detailTreeId)
          : financeKeys.snapshotPlaceholder("detail-none"),
      queryFn: () =>
        financeApi.getSnapshotDetail(selectedSnapshotId as UUID, {
          tree_id: detailTreeId ?? undefined,
        }),
      enabled: Boolean(selectedSnapshotId && detailTreeId),
    });

  const { data: formTreeSnapshotsData } = useQuery({
    queryKey: financeKeys.snapshots(formTreeId),
    queryFn: () =>
      financeApi.listSnapshots({
        page: 1,
        size: 100,
        tree_id: formTreeId ?? undefined,
      }),
    enabled: Boolean(formTreeId),
  });
  const formTreeSnapshots = useMemo(
    () => formTreeSnapshotsData?.items ?? [],
    [formTreeSnapshotsData],
  );
  const latestSnapshot = useMemo(() => {
    if (!formTreeSnapshots.length) {
      return null;
    }
    return [...formTreeSnapshots].sort(
      (a, b) =>
        new Date(b.snapshot_ts).getTime() - new Date(a.snapshot_ts).getTime(),
    )[0];
  }, [formTreeSnapshots]);
  const latestSnapshotId = latestSnapshot?.id ?? null;
  const { data: latestSnapshotDetail } = useQuery<BalanceSnapshotDetail>({
    queryKey:
      latestSnapshotId && formTreeId
        ? financeKeys.snapshotDetail(latestSnapshotId as UUID, formTreeId)
        : financeKeys.snapshotPlaceholder("latest-none", formTreeId),
    queryFn: () =>
      financeApi.getSnapshotDetail(latestSnapshotId as UUID, {
        tree_id: formTreeId ?? undefined,
      }),
    enabled: Boolean(latestSnapshotId && formTreeId),
  });

  const createAccountMutation = useToastMutation({
    mutationFn: financeApi.createAccount,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.createAccountSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.createAccountFailed"),
    }),
    onSuccess: () => {
      invalidateBalanceAccountTree(queryClient, accountTreeId);
    },
  });

  const updateAccountMutation = useToastMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: UUID;
      payload: FinanceAccountUpdatePayload;
    }) => financeApi.updateAccount(id, payload),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.updateAccountSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.updateAccountFailed"),
    }),
    onSuccess: () => {
      invalidateBalanceAccountTree(queryClient, accountTreeId);
    },
  });

  const deleteAccountMutation = useToastMutation({
    mutationFn: financeApi.deleteAccount,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.deleteAccountSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.deleteAccountFailed"),
    }),
    onSuccess: () => {
      invalidateBalanceAccountTree(queryClient, accountTreeId);
    },
  });

  const resetSnapshotsAllPages = useCallback(
    (
      updatePages?: (
        pages: BalanceSnapshotListResponse[],
      ) => BalanceSnapshotListResponse[],
    ) => {
      queryClient.setQueryData<InfiniteData<BalanceSnapshotListResponse>>(
        financeKeys.snapshotsAll(),
        (current) => {
          if (!current) {
            return current;
          }
          const nextPages = updatePages
            ? updatePages(current.pages)
            : current.pages;
          const firstPage = nextPages[0];
          return {
            ...current,
            pages: firstPage ? [firstPage] : [],
            pageParams: firstPage ? [current.pageParams?.[0] ?? 1] : [],
          };
        },
      );
      invalidateBalanceSnapshotsAll(queryClient);
    },
    [queryClient],
  );

  const createSnapshotMutation = useToastMutation({
    mutationFn: financeApi.createSnapshot,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.snapshotCreated"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error ? error.message : t("finance.snapshotFailed"),
    }),
    onSuccess: (data) => {
      const treeId = data?.tree_id ?? formTreeId ?? null;
      resetSnapshotsAllPages();
      invalidateBalanceSnapshots(queryClient, treeId);
      if (treeId) {
        invalidateBalanceAccountTree(queryClient, treeId);
      }
      if (data?.id) {
        setSelectedSnapshotId(data.id as UUID);
      }
      setSnapshotFormVisible(false);
      setSnapshotFormMode("create");
      setEditingSnapshotId(null);
      setEditingSnapshotTreeId(null);
      setSnapshotTimestamp(null);
    },
  });

  const updateSnapshotMutation = useToastMutation({
    mutationFn: (variables: { id: UUID; payload: CreateSnapshotPayload }) =>
      financeApi.updateSnapshot(variables.id, variables.payload),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.updateSnapshotSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.updateSnapshotFailed"),
    }),
    onSuccess: (data) => {
      const treeId = data?.tree_id ?? formTreeId ?? null;
      resetSnapshotsAllPages();
      invalidateBalanceSnapshots(queryClient, treeId);
      if (treeId) {
        invalidateBalanceAccountTree(queryClient, treeId);
      }
      if (data?.id) {
        setSelectedSnapshotId(data.id as UUID);
      }
      setSnapshotFormVisible(false);
      setSnapshotFormMode("create");
      setEditingSnapshotId(null);
      setEditingSnapshotTreeId(null);
      setSnapshotTimestamp(null);
    },
  });

  const deleteSnapshotMutation = useToastMutation({
    mutationFn: (variables: { id: UUID; treeId?: UUID | null }) =>
      financeApi.deleteSnapshot(variables.id),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.deleteSnapshotSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.deleteSnapshotFailed"),
    }),
    onSuccess: (_, variables) => {
      if (variables) {
        const snapshotId = variables.id as UUID;
        const treeId = variables.treeId ?? null;
        const detailKey = financeKeys.snapshotDetail(snapshotId, treeId);
        void queryClient.cancelQueries({ queryKey: detailKey });
        removeBalanceSnapshotDetailCache(queryClient, snapshotId, treeId);

        let nextSnapshotId: UUID | null = null;
        resetSnapshotsAllPages((pages) => {
          const filteredPages = pages.map((page) => ({
            ...page,
            items: page.items.filter((snapshot) => snapshot.id !== snapshotId),
          }));
          const firstPage = filteredPages[0];
          const firstItem = firstPage?.items?.[0];
          nextSnapshotId = firstItem ? (firstItem.id as UUID) : null;
          return filteredPages;
        });

        setSelectedSnapshotId((current) =>
          current === snapshotId ? nextSnapshotId : current,
        );

        if (treeId) {
          invalidateBalanceAccountTree(queryClient, treeId);
          invalidateBalanceSnapshots(queryClient, treeId);
        }
      }
      setSnapshotPendingDelete(null);
    },
  });

  const snapshotSubmissionPending =
    createSnapshotMutation.isPending || updateSnapshotMutation.isPending;

  const accountPrimaryCurrency = accountTree?.primary_currency ?? "RMB";
  const formPrimaryCurrency = formAccountTree?.primary_currency ?? "RMB";

  const handleEditSnapshot = (snapshot: BalanceSnapshotSummary) => {
    if (snapshotSubmissionPending || deleteSnapshotMutation.isPending) {
      return;
    }
    setSnapshotFormMode("edit");
    setEditingSnapshotId(snapshot.id);
    setEditingSnapshotTreeId(snapshot.tree_id as UUID);
    if (snapshot.id !== selectedSnapshotId) {
      setSelectedSnapshotId(snapshot.id as UUID);
    }
    setSnapshotFormVisible(true);
    setSnapshotTimestamp(snapshot.snapshot_ts);
  };

  const handleRequestDeleteSnapshot = (snapshot: BalanceSnapshotSummary) => {
    if (snapshotSubmissionPending || deleteSnapshotMutation.isPending) {
      return;
    }
    setSnapshotPendingDelete(snapshot);
  };

  const handleCancelDeleteSnapshot = () => {
    if (deleteSnapshotMutation.isPending) {
      return;
    }
    setSnapshotPendingDelete(null);
  };

  const handleConfirmDeleteSnapshot = () => {
    if (!snapshotPendingDelete || deleteSnapshotMutation.isPending) {
      return;
    }
    const snapshotId = snapshotPendingDelete.id as UUID;
    const treeId = snapshotPendingDelete.tree_id as UUID;
    setSnapshotPendingDelete(null);
    deleteSnapshotMutation.mutate({ id: snapshotId, treeId });
  };

  const handleOpenSnapshotForm = useCallback(() => {
    setSnapshotFormMode("create");
    setEditingSnapshotId(null);
    setEditingSnapshotTreeId(null);
    setSnapshotFormVisible(true);
    setSnapshotTimestamp(new Date().toISOString());
    if (!draftTreeId && defaultTreeId) {
      setDraftTreeId(defaultTreeId);
    }
    if (orderedSnapshots.length) {
      setSelectedSnapshotId(orderedSnapshots[0].id as UUID);
    }
  }, [orderedSnapshots, setSelectedSnapshotId, draftTreeId, defaultTreeId]);

  const handleCloseSnapshotForm = useCallback(() => {
    if (snapshotSubmissionPending) {
      return;
    }
    setSnapshotFormVisible(false);
    setSnapshotFormMode("create");
    setEditingSnapshotId(null);
    setEditingSnapshotTreeId(null);
    setSnapshotTimestamp(null);
  }, [snapshotSubmissionPending]);

  const snapshotFormRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isSnapshotFormVisible) {
      return;
    }
    const handle = window.requestAnimationFrame(() => {
      snapshotFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(handle);
  }, [isSnapshotFormVisible]);

  const isLoading =
    accountTreesLoading || accountTreeLoading || snapshotsLoading;
  const error =
    (accountTreeError as Error) || (accountTreesError as Error) || null;

  const toolbarOptions = useMemo(() => {
    const baseOptions = snapshotOptions.map((option) => ({
      value: option.value as string,
      label: option.label,
      disabled: false,
    }));
    if (
      isSnapshotFormVisible &&
      snapshotFormMode === "create" &&
      snapshotTimestamp
    ) {
      return [
        {
          value: DRAFT_SNAPSHOT_ID,
          label: formatDateTime(snapshotTimestamp),
          disabled: true,
        },
        ...baseOptions,
      ];
    }
    return baseOptions;
  }, [
    snapshotOptions,
    snapshotTimestamp,
    isSnapshotFormVisible,
    snapshotFormMode,
  ]);

  const toolbarSelectedId =
    isSnapshotFormVisible && snapshotFormMode === "create" && snapshotTimestamp
      ? DRAFT_SNAPSHOT_ID
      : selectedSnapshotId;

  const { handleSelect, handlePrevious, handleNext } =
    useSnapshotToolbarActions<string>({
      isSubmitting: snapshotSubmissionPending,
      isFormVisible: isSnapshotFormVisible,
      onCloseForm: handleCloseSnapshotForm,
      onSelect: (value) => setSelectedSnapshotId(value as UUID),
      onPrevious: goToPrevious,
      onNext: goToNext,
      shouldBlockSelect: (value) => value === DRAFT_SNAPSHOT_ID,
    });

  const orderedSnapshotsCount = orderedSnapshots.length;
  const handleLoadMoreSnapshots = useCallback(() => {
    if (!hasMoreSnapshots || snapshotsLoadingMore) {
      return;
    }
    void fetchNextSnapshots();
  }, [fetchNextSnapshots, hasMoreSnapshots, snapshotsLoadingMore]);

  return {
    status: {
      isLoading,
      error,
    },
    snapshotList: {
      hasMore: Boolean(hasMoreSnapshots),
      loadingMore: snapshotsLoadingMore,
      onLoadMore: handleLoadMoreSnapshots,
    },
    toolbar: {
      show: orderedSnapshotsCount > 0,
      options: toolbarOptions,
      selectedId: toolbarSelectedId,
      onSelect: handleSelect,
      placeholder: t("finance.selectSnapshot"),
      hasPrevious,
      hasNext,
      onPrevious: handlePrevious,
      onNext: handleNext,
      manageLabel: t("finance.accountsButton"),
      onManage: () => setAccountManagerOpen(true),
      createLabel: "",
      createAriaLabel: t("finance.newBalanceSnapshot"),
      createIconOnly: true,
      onCreate: handleOpenSnapshotForm,
      createDisabled: snapshotSubmissionPending || isSnapshotFormVisible,
      previousAriaLabel: t("finance.previousSnapshot"),
      nextAriaLabel: t("finance.nextSnapshot"),
    },
    snapshot: {
      hasSnapshots: orderedSnapshotsCount > 0,
      orderedSnapshotsCount,
      currentSnapshot,
      snapshotDetail,
      snapshotDetailLoading,
      isSnapshotFormVisible,
      snapshotFormRef,
      snapshotFormMode,
      snapshotSubmissionPending,
      hasPrevious,
      hasNext,
      currentPosition: orderedSnapshotsCount ? effectiveIndex + 1 : 0,
      onPrevious: goToPrevious,
      onNext: goToNext,
      onOpenSnapshotForm: handleOpenSnapshotForm,
      onCloseSnapshotForm: handleCloseSnapshotForm,
      onCreateSnapshot: (payload) =>
        createSnapshotMutation.mutate({
          ...payload,
          tree_id: formTreeId ?? undefined,
        }),
      onUpdateSnapshot: (id, payload) =>
        updateSnapshotMutation.mutate({
          id,
          payload: {
            ...payload,
            tree_id:
              editingSnapshotTreeId ?? detailTreeId ?? formTreeId ?? undefined,
          },
        }),
      onEditSnapshot: handleEditSnapshot,
      onDeleteSnapshot: handleRequestDeleteSnapshot,
      snapshotDetailPlaceholder: t("finance.snapshotDetailPlaceholder"),
      emptyStateLabel: t("finance.noSnapshots"),
      emptyCreateLabel: t("finance.newBalanceSnapshot"),
      emptyCreateDisabled: snapshotSubmissionPending || isSnapshotFormVisible,
    },
    form: {
      accountTree: formAccountTree?.accounts ?? [],
      latestSnapshotDetail,
      editingSnapshotId: editingSnapshotId as UUID | null,
      snapshotTimestamp,
      onChangeSnapshotTimestamp: setSnapshotTimestamp,
      primaryCurrency: formPrimaryCurrency,
      treeId: formTreeId ?? null,
      treeName: formTreeName,
      treeOptions,
      onChangeTree: (id: UUID) => setDraftTreeId(id),
      treeSelectionDisabled:
        snapshotFormMode === "edit" && isSnapshotFormVisible,
    },
    detail: {
      accountTree: detailAccountTree?.accounts ?? [],
      treeName: detailTreeName,
    },
    accountManager: {
      isOpen: isAccountManagerOpen,
      open: () => setAccountManagerOpen(true),
      close: () => setAccountManagerOpen(false),
      accounts: accountTree?.accounts ?? [],
      treeId: accountTreeId ?? null,
      treeOptions,
      onChangeTree: (id: UUID) => setAccountTreeId(id),
      onManageTree: () => setTreeManagerOpen(true),
      primaryCurrency: accountPrimaryCurrency,
      loading: accountTreeLoading,
      error: error?.message ?? null,
      onCreateAccount: async (payload) => {
        await createAccountMutation.mutateAsync({
          ...payload,
          tree_id: accountTreeId ?? undefined,
        });
      },
      onUpdateAccount: async (id, payload) => {
        await updateAccountMutation.mutateAsync({ id, payload });
      },
      onDeleteAccount: async (id) => {
        await deleteAccountMutation.mutateAsync(id);
      },
      createPending: createAccountMutation.isPending,
      updatePending: updateAccountMutation.isPending,
      deletePending: deleteAccountMutation.isPending,
    },
    treeManager: {
      isOpen: isTreeManagerOpen,
      open: () => setTreeManagerOpen(true),
      close: () => setTreeManagerOpen(false),
      trees: accountTrees ?? [],
      loading: accountTreesLoading,
      error:
        accountTreesError instanceof Error ? accountTreesError.message : null,
      onCreateTree: async (name, isDefault) => {
        await createAccountTreeMutation.mutateAsync({
          name,
          is_default: Boolean(isDefault),
        });
      },
      onRenameTree: async (id, name) => {
        await updateAccountTreeMutation.mutateAsync({
          id,
          payload: { name },
        });
      },
      onDeleteTree: async (id) => {
        await deleteAccountTreeMutation.mutateAsync(id);
      },
      onSetDefault: async (id) => {
        await updateAccountTreeMutation.mutateAsync({
          id,
          payload: { is_default: true },
        });
      },
      onExportTree: (id: UUID) => handleExportAccounts(id),
      createPending: createAccountTreeMutation.isPending,
      updatePending: updateAccountTreeMutation.isPending,
      deletePending: deleteAccountTreeMutation.isPending,
    },
    deleteDialog: {
      isOpen: Boolean(snapshotPendingDelete),
      title: t("common.delete"),
      message: t("finance.deleteSnapshotWarning", {
        timestamp: snapshotPendingDelete
          ? formatDateTime(snapshotPendingDelete.snapshot_ts)
          : "",
      }),
      confirmText: t("common.confirm"),
      cancelText: t("common.cancel"),
      onConfirm: handleConfirmDeleteSnapshot,
      onCancel: handleCancelDeleteSnapshot,
    },
    actions: {
      openAccountManager: () => setAccountManagerOpen(true),
      openSnapshotForm: handleOpenSnapshotForm,
    },
  };
}
