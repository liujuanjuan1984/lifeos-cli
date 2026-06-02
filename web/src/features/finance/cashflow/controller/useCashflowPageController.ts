import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type InfiniteData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useToastMutation } from "@/hooks/useToastMutation";
import { usePreferenceWithBootstrap } from "@/hooks/queries/usePreferenceWithBootstrap";
import { useFinanceCashflowExport } from "@/hooks/useExport";
import { financeApi } from "@/services/api/finance";
import { financeKeys } from "@/services/api/queryKeys";
import {
  invalidateCashflowSnapshotDetail,
  invalidateCashflowSnapshots,
  invalidateCashflowSnapshotsAll,
  invalidateCashflowSources,
  invalidateCashflowTrees,
  removeCashflowSnapshotDetailCache,
  setCashflowSnapshotDetailCache,
} from "@/services/api/cacheInvalidation/financeCashflow";
import type {
  CashflowSnapshotCreatePayload,
  CashflowSnapshotDetail,
  CashflowSnapshotListResponse,
  CashflowSnapshotSummary,
  CashflowSnapshotUpdatePayload,
  CashflowSourceCreatePayload,
  CashflowSourceNode,
  CashflowSourceUpdatePayload,
  CashflowSourceTreeItem,
} from "@/services/api/finance";
import type { UUID } from "@/types/primitive";
import { formatMonthInTimezone } from "@/utils/datetime";
import { resolvePreferredTimezone } from "@/utils/datetime";
import { exportApi } from "@/services/api";
import {
  formatSignedDecimalValue,
  flattenTree,
  useSnapshotSelection,
  useSnapshotToolbarActions,
} from "@/features/finance/shared";
import type {
  SnapshotSectionConfig,
  SnapshotToolbarConfig,
} from "@/features/finance/snapshot/SnapshotModule";

export interface CashflowPageController {
  status: {
    isLoading: boolean;
    error: Error | null;
  };
  snapshotList: {
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
  };
  toolbar: SnapshotToolbarConfig<UUID>;
  snapshot: SnapshotSectionConfig<
    UUID,
    CashflowSnapshotSummary,
    CashflowSnapshotDetail,
    CashflowSnapshotCreatePayload,
    CashflowSnapshotUpdatePayload
  >;
  snapshotExtras: {
    formSources: CashflowSourceNode[];
    detailSources: CashflowSourceNode[];
    latestSnapshotDetail: CashflowSnapshotDetail | null | undefined;
    editingSnapshotDetail: CashflowSnapshotDetail | null;
    timezone: string;
    formTreeId: UUID | null;
    formTreeName: string | null;
    treeOptions: Array<{ value: UUID; label: string }>;
    onChangeTree: (id: UUID) => void;
    treeSelectionDisabled: boolean;
    detailTreeName: string | null;
    snapshotActionsDisabled: boolean;
    hideSnapshotActions: boolean;
    autoBillingSources: CashflowSourceNode[];
    manualBillingSources: CashflowSourceNode[];
    onApplyBillingCycles?: (month: string) => Promise<void> | void;
    onManageBillingSource?: (month: string, source: CashflowSourceNode) => void;
    applyBillingPending: boolean;
  };
  sourceManager: {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    sources: CashflowSourceNode[];
    treeId: UUID | null;
    treeOptions: Array<{ value: UUID; label: string }>;
    onChangeTree: (id: UUID) => void;
    onManageTree: () => void;
    loading: boolean;
    error: string | null;
    onCreateSource: (payload: CashflowSourceCreatePayload) => Promise<void>;
    onUpdateSource: (
      id: UUID,
      payload: CashflowSourceUpdatePayload,
    ) => Promise<void>;
    creating: boolean;
    updating: boolean;
    onManualBillingSaved: () => void;
  };
  treeManager: {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    trees: CashflowSourceTreeItem[];
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
  billingModal: {
    source: CashflowSourceNode | null;
    month: string;
    close: () => void;
    onSaved: () => void;
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
    openSourceManager: () => void;
    openSnapshotForm: () => void;
  };
}

export function useCashflowPageController(): CashflowPageController {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const timezonePreference = usePreferenceWithBootstrap<string>({
    key: "system.timezone",
    defaultValue: resolvePreferredTimezone(),
  });
  const activeTimezone = resolvePreferredTimezone(timezonePreference.value);
  const { exportData: exportCashflow } = useFinanceCashflowExport();

  const [sourceTreeId, setSourceTreeId] = useState<UUID | null>(null);
  const [draftTreeId, setDraftTreeId] = useState<UUID | null>(null);
  const [isTreeManagerOpen, setTreeManagerOpen] = useState(false);

  const [isSourceModalOpen, setSourceModalOpen] = useState(false);
  const [isSnapshotFormVisible, setSnapshotFormVisible] = useState(false);
  const [snapshotFormMode, setSnapshotFormMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingSnapshotDetail, setEditingSnapshotDetail] =
    useState<CashflowSnapshotDetail | null>(null);
  const [editingSnapshotTreeId, setEditingSnapshotTreeId] =
    useState<UUID | null>(null);
  const snapshotFormRef = useRef<HTMLDivElement | null>(null);
  const [billingModalSource, setBillingModalSource] =
    useState<CashflowSourceNode | null>(null);
  const [billingModalMonth, setBillingModalMonth] = useState<string>("");
  const [snapshotPendingDelete, setSnapshotPendingDelete] =
    useState<CashflowSnapshotSummary | null>(null);

  const {
    data: cashflowTrees,
    isLoading: cashflowTreesLoading,
    error: cashflowTreesError,
  } = useQuery({
    queryKey: financeKeys.cashflowTrees(),
    queryFn: financeApi.listCashflowTrees,
  });

  const defaultTreeId = useMemo(() => {
    if (!cashflowTrees?.length) {
      return null;
    }
    const defaultTree =
      cashflowTrees.find((tree) => tree.is_default) ?? cashflowTrees[0];
    return defaultTree.id as UUID;
  }, [cashflowTrees]);

  useEffect(() => {
    if (!cashflowTrees?.length) {
      return;
    }
    if (
      sourceTreeId &&
      cashflowTrees.some((tree) => tree.id === sourceTreeId)
    ) {
      return;
    }
    if (defaultTreeId) {
      setSourceTreeId(defaultTreeId);
    }
  }, [cashflowTrees, sourceTreeId, defaultTreeId]);

  useEffect(() => {
    if (!cashflowTrees?.length) {
      return;
    }
    if (draftTreeId && cashflowTrees.some((tree) => tree.id === draftTreeId)) {
      return;
    }
    if (defaultTreeId) {
      setDraftTreeId(defaultTreeId);
    }
  }, [cashflowTrees, draftTreeId, defaultTreeId]);

  const treeOptions = useMemo(
    () =>
      (cashflowTrees ?? []).map((tree) => ({
        value: tree.id as UUID,
        label: tree.name,
      })),
    [cashflowTrees],
  );
  const createCashflowTreeMutation = useToastMutation({
    mutationFn: financeApi.createCashflowTree,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.cashflowTreeCreateSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.cashflowTreeCreateFailed"),
    }),
    onSuccess: (_data) => {
      invalidateCashflowTrees(queryClient);
    },
  });

  const updateCashflowTreeMutation = useToastMutation({
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
    }) => financeApi.updateCashflowTree(id, payload),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.cashflowTreeUpdateSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.cashflowTreeUpdateFailed"),
    }),
    onSuccess: (_data) => {
      invalidateCashflowTrees(queryClient);
    },
  });

  const deleteCashflowTreeMutation = useToastMutation({
    mutationFn: financeApi.deleteCashflowTree,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.cashflowTreeDeleteSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error
          ? error.message
          : t("finance.cashflowTreeDeleteFailed"),
    }),
    onSuccess: (_, treeId) => {
      invalidateCashflowTrees(queryClient);
      if (treeId && treeId === sourceTreeId) {
        setSourceTreeId(null);
      }
      if (treeId && treeId === draftTreeId) {
        setDraftTreeId(null);
      }
    },
  });

  const handleExportCashflow = async (treeId?: UUID | null) => {
    const payload = {
      format: "csv" as const,
      start_time: null,
      end_time: null,
      tree_id: treeId ?? undefined,
    };
    let estimatedSizeBytes: number | undefined;
    try {
      const estimate = await exportApi.estimate("finance-cashflow", payload);
      estimatedSizeBytes = estimate.estimated_size_bytes;
    } catch (err) {
      /* silent */
    }
    await exportCashflow(payload, {
      forceFile: true,
      estimatedSizeBytes,
      showToasts: true,
    });
  };

  const {
    data: sourceTree,
    isLoading: sourcesLoading,
    error: sourcesError,
  } = useQuery({
    queryKey: financeKeys.cashflowSources(sourceTreeId),
    queryFn: () =>
      financeApi.getCashflowSources({ tree_id: sourceTreeId ?? undefined }),
    enabled: Boolean(sourceTreeId),
  });

  const {
    data: cashflowSnapshotsData,
    isLoading: snapshotsLoading,
    error: snapshotsError,
    fetchNextPage: fetchNextSnapshots,
    hasNextPage: hasMoreSnapshots,
    isFetchingNextPage: snapshotsLoadingMore,
  } = useInfiniteQuery({
    queryKey: financeKeys.cashflowSnapshotsAll(),
    queryFn: ({ pageParam = 1 }) =>
      financeApi.listCashflowSnapshots({
        page: pageParam as number,
        size: 20,
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
  const cashflowSnapshots = useMemo(() => {
    if (!cashflowSnapshotsData?.pages) {
      return [];
    }
    return cashflowSnapshotsData.pages.flatMap((page) => page.items ?? []);
  }, [cashflowSnapshotsData]);

  const formatSnapshotOption = useCallback(
    (snapshot: CashflowSnapshotSummary) => {
      const monthLabel = formatMonthInTimezone(
        snapshot.period_start,
        activeTimezone,
      );
      const formattedNet =
        formatSignedDecimalValue(snapshot.net_cashflow) ??
        snapshot.net_cashflow;
      return t("finance.snapshotOptionValue", {
        month: monthLabel,
        value: formattedNet,
        currency: snapshot.primary_currency,
      });
    },
    [activeTimezone, t],
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
  } = useSnapshotSelection<CashflowSnapshotSummary, UUID>({
    snapshots: cashflowSnapshots,
    getId: (snapshot) => snapshot.id,
    sortSnapshots: (a, b) =>
      new Date(b.period_start).getTime() - new Date(a.period_start).getTime(),
    getOptionLabel: formatSnapshotOption,
  });

  const detailTreeId = currentSnapshot?.tree_id ?? null;

  const detailTreeName = useMemo(() => {
    if (!detailTreeId) {
      return null;
    }
    return (
      cashflowTrees?.find((tree) => tree.id === detailTreeId)?.name ?? null
    );
  }, [cashflowTrees, detailTreeId]);

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
    return cashflowTrees?.find((tree) => tree.id === formTreeId)?.name ?? null;
  }, [cashflowTrees, formTreeId]);

  const { data: formSourceTree } = useQuery({
    queryKey: financeKeys.cashflowSources(formTreeId),
    queryFn: () =>
      financeApi.getCashflowSources({ tree_id: formTreeId ?? undefined }),
    enabled: Boolean(formTreeId),
  });

  const { data: detailSourceTree } = useQuery({
    queryKey: financeKeys.cashflowSources(detailTreeId),
    queryFn: () =>
      financeApi.getCashflowSources({ tree_id: detailTreeId ?? undefined }),
    enabled: Boolean(detailTreeId),
  });

  const formSources = useMemo(
    () => formSourceTree?.sources ?? [],
    [formSourceTree],
  );

  const detailSources = useMemo(
    () => detailSourceTree?.sources ?? [],
    [detailSourceTree],
  );

  const flattenedSources = useMemo(
    () => flattenTree(formSources ?? []),
    [formSources],
  );

  const billingSources = useMemo(
    () => flattenedSources.filter((item) => item.kind === "billing"),
    [flattenedSources],
  );

  const autoBillingSources = useMemo(
    () => billingSources.filter((item) => !item.billing_requires_manual_input),
    [billingSources],
  );

  const manualBillingSources = useMemo(
    () => billingSources.filter((item) => item.billing_requires_manual_input),
    [billingSources],
  );

  const { data: snapshotDetail, isLoading: snapshotDetailLoading } = useQuery({
    queryKey:
      selectedSnapshotId && detailTreeId
        ? financeKeys.cashflowSnapshotDetail(selectedSnapshotId, detailTreeId)
        : financeKeys.cashflowSnapshotPlaceholder("detail-none"),
    queryFn: () =>
      financeApi.getCashflowSnapshotDetail(selectedSnapshotId as UUID, {
        tree_id: detailTreeId ?? undefined,
      }),
    enabled: Boolean(selectedSnapshotId && detailTreeId),
  });

  const { data: formTreeSnapshotsData } = useQuery({
    queryKey: financeKeys.cashflowSnapshots(formTreeId),
    queryFn: () =>
      financeApi.listCashflowSnapshots({
        page: 1,
        size: 20,
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
        new Date(b.period_start).getTime() - new Date(a.period_start).getTime(),
    )[0];
  }, [formTreeSnapshots]);

  const latestSnapshotId = latestSnapshot?.id ?? null;

  const { data: latestSnapshotDetail } = useQuery<CashflowSnapshotDetail>({
    queryKey:
      latestSnapshotId && formTreeId
        ? financeKeys.cashflowSnapshotDetail(latestSnapshotId, formTreeId)
        : financeKeys.cashflowSnapshotPlaceholder("latest-none", formTreeId),
    queryFn: () =>
      financeApi.getCashflowSnapshotDetail(latestSnapshotId as UUID, {
        tree_id: formTreeId ?? undefined,
      }),
    enabled: Boolean(latestSnapshotId && formTreeId),
  });

  const handleOpenSnapshotForm = useCallback(() => {
    setSnapshotFormMode("create");
    setEditingSnapshotDetail(null);
    setEditingSnapshotTreeId(null);
    setSnapshotFormVisible(true);
    if (!draftTreeId && defaultTreeId) {
      setDraftTreeId(defaultTreeId);
    }
  }, [draftTreeId, defaultTreeId]);

  const createSourceMutation = useToastMutation({
    mutationFn: financeApi.createCashflowSource,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.addSourceSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description:
        error instanceof Error ? error.message : t("finance.addSourceFailed"),
    }),
    onSuccess: () => {
      invalidateCashflowSources(queryClient, sourceTreeId);
    },
  });

  const updateSourceMutation = useToastMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: UUID;
      payload: CashflowSourceUpdatePayload;
    }) => financeApi.updateCashflowSource(id, payload),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.updateSourceSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description: error instanceof Error ? error.message : undefined,
    }),
    onSuccess: () => {
      invalidateCashflowSources(queryClient, sourceTreeId);
    },
  });

  const resetCashflowSnapshotsAllPages = useCallback(
    (
      updatePages?: (
        pages: CashflowSnapshotListResponse[],
      ) => CashflowSnapshotListResponse[],
    ) => {
      queryClient.setQueryData<InfiniteData<CashflowSnapshotListResponse>>(
        financeKeys.cashflowSnapshotsAll(),
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
      invalidateCashflowSnapshotsAll(queryClient);
    },
    [queryClient],
  );

  const createSnapshotMutation = useToastMutation({
    mutationFn: (payload: CashflowSnapshotCreatePayload) =>
      financeApi.createCashflowSnapshot(payload),
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
      const treeId = data.tree_id ?? formTreeId ?? null;
      resetCashflowSnapshotsAllPages();
      invalidateCashflowSnapshots(queryClient, treeId);
      if (treeId) {
        invalidateCashflowSources(queryClient, treeId);
      }
      if (data.id) {
        setSelectedSnapshotId(data.id as UUID);
        setCashflowSnapshotDetailCache(queryClient, data, treeId);
      }
      setSnapshotFormVisible(false);
      setSnapshotFormMode("create");
      setEditingSnapshotDetail(null);
      setEditingSnapshotTreeId(null);
    },
  });

  const updateSnapshotMutation = useToastMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: UUID;
      payload: CashflowSnapshotUpdatePayload;
    }) => financeApi.updateCashflowSnapshot(id, payload),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.updateSnapshotSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description: error instanceof Error ? error.message : undefined,
    }),
    onSuccess: (data) => {
      const treeId = data.tree_id ?? formTreeId ?? null;
      resetCashflowSnapshotsAllPages();
      invalidateCashflowSnapshots(queryClient, treeId);
      if (data.id) {
        setCashflowSnapshotDetailCache(queryClient, data, treeId);
        setSelectedSnapshotId(data.id as UUID);
      }
      setSnapshotFormVisible(false);
      setSnapshotFormMode("create");
      setEditingSnapshotDetail(null);
      setEditingSnapshotTreeId(null);
    },
  });

  const deleteSnapshotMutation = useToastMutation({
    mutationFn: (variables: { id: UUID; treeId?: UUID | null }) =>
      financeApi.deleteCashflowSnapshot(variables.id),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.deleteSnapshotSuccess"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description: error instanceof Error ? error.message : undefined,
    }),
    onSuccess: (_, variables) => {
      if (variables?.id) {
        const treeId = variables.treeId ?? null;
        const deletedId = variables.id;
        removeCashflowSnapshotDetailCache(queryClient, deletedId, treeId);
        resetCashflowSnapshotsAllPages((pages) =>
          pages.map((page) => ({
            ...page,
            items: page.items.filter((snapshot) => snapshot.id !== deletedId),
          })),
        );
        setSelectedSnapshotId((current) =>
          current === deletedId ? null : current,
        );
        if (treeId) {
          invalidateCashflowSnapshots(queryClient, treeId);
          invalidateCashflowSources(queryClient, treeId);
        }
      }
      setSnapshotPendingDelete(null);
      setSnapshotFormVisible(false);
      setSnapshotFormMode("create");
      setEditingSnapshotDetail(null);
      setEditingSnapshotTreeId(null);
    },
  });

  const snapshotSubmitting =
    createSnapshotMutation.isPending || updateSnapshotMutation.isPending;

  const snapshotActionsDisabled =
    snapshotSubmitting || deleteSnapshotMutation.isPending;
  const hideSnapshotActions =
    isSnapshotFormVisible && snapshotFormMode === "edit";

  const handleCloseSnapshotForm = useCallback(() => {
    if (snapshotSubmitting) {
      return;
    }
    setSnapshotFormVisible(false);
    setSnapshotFormMode("create");
    setEditingSnapshotDetail(null);
    setEditingSnapshotTreeId(null);
  }, [snapshotSubmitting]);

  const handleLoadMoreSnapshots = useCallback(() => {
    if (!hasMoreSnapshots || snapshotsLoadingMore) {
      return;
    }
    void fetchNextSnapshots();
  }, [fetchNextSnapshots, hasMoreSnapshots, snapshotsLoadingMore]);

  const applyBillingMutation = useToastMutation({
    mutationFn: async ({ month }: { month: string }) => {
      if (!month) {
        throw new Error("缺少月份参数");
      }
      if (!autoBillingSources.length) {
        throw new Error("暂无可自动生成的账期来源");
      }
      return financeApi.applyBillingCycles({
        month,
        source_ids: autoBillingSources.map((item) => item.id),
        tree_id: formTreeId ?? undefined,
      });
    },
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.billingApplied"),
    }),
    getErrorToast: ({ error }) => ({
      title: t("common.error"),
      description: error instanceof Error ? error.message : undefined,
    }),
    suppressErrorToast: false,
    suppressSuccessToast: false,
    onSuccess: (data) => {
      resetCashflowSnapshotsAllPages();
      invalidateCashflowSnapshots(queryClient, formTreeId);
      if (data.id) {
        const treeId = data.tree_id ?? formTreeId ?? null;
        setCashflowSnapshotDetailCache(queryClient, data, treeId);
        setSelectedSnapshotId(data.id as UUID);
        setSnapshotFormMode("edit");
        setEditingSnapshotDetail(data);
        setEditingSnapshotTreeId(treeId);
        setSnapshotFormVisible(true);
      }
    },
  });

  const handleApplyBillingCycles = useCallback(
    async (month: string) => {
      if (!month) return;
      await applyBillingMutation.mutateAsync({ month });
    },
    [applyBillingMutation],
  );

  const handleOpenBillingModal = useCallback(
    (month: string, source: CashflowSourceNode) => {
      setBillingModalMonth(month);
      setBillingModalSource(source);
    },
    [],
  );

  const handleCloseBillingModal = useCallback(() => {
    setBillingModalSource(null);
  }, []);

  const handleBillingSaved = useCallback(() => {
    invalidateCashflowSnapshotsAll(queryClient);
    if (detailTreeId) {
      invalidateCashflowSnapshots(queryClient, detailTreeId);
    }
    if (selectedSnapshotId && detailTreeId) {
      invalidateCashflowSnapshotDetail(
        queryClient,
        selectedSnapshotId as UUID,
        detailTreeId,
      );
    }
  }, [queryClient, selectedSnapshotId, detailTreeId]);

  const handleManualBillingSaved = useCallback(() => {
    invalidateCashflowSnapshotsAll(queryClient);
    if (detailTreeId) {
      invalidateCashflowSnapshots(queryClient, detailTreeId);
    }
    if (selectedSnapshotId && detailTreeId) {
      invalidateCashflowSnapshotDetail(
        queryClient,
        selectedSnapshotId as UUID,
        detailTreeId,
      );
    }
  }, [queryClient, selectedSnapshotId, detailTreeId]);

  const handleStartEditSnapshot = useCallback(() => {
    if (!snapshotDetail) {
      return;
    }
    setSnapshotFormMode("edit");
    setEditingSnapshotDetail(snapshotDetail);
    setEditingSnapshotTreeId(snapshotDetail.tree_id ?? detailTreeId ?? null);
    setSnapshotFormVisible(true);
  }, [snapshotDetail, detailTreeId]);

  const handleRequestDeleteSnapshot = useCallback(() => {
    if (!currentSnapshot) {
      return;
    }
    setSnapshotPendingDelete(currentSnapshot);
  }, [currentSnapshot]);

  const handleConfirmDeleteSnapshot = useCallback(() => {
    if (!snapshotPendingDelete || deleteSnapshotMutation.isPending) {
      return;
    }
    const snapshotId = snapshotPendingDelete.id as UUID;
    const treeId = snapshotPendingDelete.tree_id as UUID;
    setSnapshotPendingDelete(null);
    deleteSnapshotMutation.mutate({ id: snapshotId, treeId });
  }, [snapshotPendingDelete, deleteSnapshotMutation]);

  const handleCancelDeleteSnapshot = useCallback(() => {
    if (deleteSnapshotMutation.isPending) {
      return;
    }
    setSnapshotPendingDelete(null);
  }, [deleteSnapshotMutation]);

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

  const isLoading = cashflowTreesLoading || sourcesLoading || snapshotsLoading;
  const error = cashflowTreesError || sourcesError || snapshotsError;

  const hasSnapshots = orderedSnapshots.length > 0;
  const { handleSelect, handlePrevious, handleNext } =
    useSnapshotToolbarActions<UUID>({
      isSubmitting: snapshotSubmitting,
      isFormVisible: isSnapshotFormVisible,
      onCloseForm: handleCloseSnapshotForm,
      onSelect: (value) => setSelectedSnapshotId(value),
      onPrevious: goToPrevious,
      onNext: goToNext,
    });

  return {
    status: {
      isLoading,
      error: error ? (error as Error) : null,
    },
    snapshotList: {
      hasMore: Boolean(hasMoreSnapshots),
      loadingMore: snapshotsLoadingMore,
      onLoadMore: handleLoadMoreSnapshots,
    },
    toolbar: {
      show: true,
      options: snapshotOptions,
      selectedId: selectedSnapshotId,
      onSelect: (value) => handleSelect(value),
      placeholder: t("finance.selectSnapshot"),
      hasPrevious,
      hasNext,
      onPrevious: handlePrevious,
      onNext: handleNext,
      manageLabel: t("finance.sourcesButton"),
      onManage: () => setSourceModalOpen(true),
      createLabel: "",
      createAriaLabel: t("finance.addCashflowSnapshot"),
      createIconOnly: true,
      onCreate: handleOpenSnapshotForm,
      createDisabled: snapshotSubmitting || isSnapshotFormVisible,
      previousAriaLabel: t("finance.previousSnapshot"),
      nextAriaLabel: t("finance.nextSnapshot"),
      disabled: !hasSnapshots,
    },
    snapshot: {
      hasSnapshots,
      orderedSnapshotsCount: orderedSnapshots.length,
      currentSnapshot,
      snapshotDetail,
      snapshotDetailLoading,
      isSnapshotFormVisible,
      snapshotFormRef,
      snapshotFormMode,
      snapshotSubmissionPending: snapshotSubmitting,
      hasPrevious,
      hasNext,
      currentPosition: orderedSnapshots.length ? effectiveIndex + 1 : 0,
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
      onEditSnapshot: (_snapshot) => handleStartEditSnapshot(),
      onDeleteSnapshot: (_snapshot) => handleRequestDeleteSnapshot(),
      snapshotDetailPlaceholder: t("finance.selectCashflowSnapshot"),
      emptyStateLabel: t("finance.noCashflowSnapshots"),
      emptyCreateLabel: t("finance.addCashflowSnapshot"),
      emptyCreateDisabled: snapshotSubmitting,
      emptySelectLabel: t("finance.selectCashflowSnapshot"),
    },
    snapshotExtras: {
      formSources,
      detailSources,
      latestSnapshotDetail,
      editingSnapshotDetail,
      timezone: activeTimezone,
      formTreeId: formTreeId ?? null,
      formTreeName,
      treeOptions,
      onChangeTree: (id: UUID) => setDraftTreeId(id),
      treeSelectionDisabled:
        snapshotFormMode === "edit" && isSnapshotFormVisible,
      detailTreeName,
      snapshotActionsDisabled,
      hideSnapshotActions,
      autoBillingSources,
      manualBillingSources,
      onApplyBillingCycles: autoBillingSources.length
        ? handleApplyBillingCycles
        : undefined,
      onManageBillingSource: manualBillingSources.length
        ? handleOpenBillingModal
        : undefined,
      applyBillingPending: applyBillingMutation.isPending,
    },
    sourceManager: {
      isOpen: isSourceModalOpen,
      open: () => setSourceModalOpen(true),
      close: () => setSourceModalOpen(false),
      sources: sourceTree?.sources ?? [],
      treeId: sourceTreeId ?? null,
      treeOptions,
      onChangeTree: (id: UUID) => setSourceTreeId(id),
      onManageTree: () => setTreeManagerOpen(true),
      loading: sourcesLoading,
      error: (sourcesError as Error)?.message ?? null,
      onCreateSource: async (payload) => {
        await createSourceMutation.mutateAsync({
          ...payload,
          tree_id: sourceTreeId ?? undefined,
        });
      },
      onUpdateSource: async (id, payload) => {
        await updateSourceMutation.mutateAsync({ id, payload });
      },
      creating: createSourceMutation.isPending,
      updating: updateSourceMutation.isPending,
      onManualBillingSaved: handleManualBillingSaved,
    },
    treeManager: {
      isOpen: isTreeManagerOpen,
      open: () => setTreeManagerOpen(true),
      close: () => setTreeManagerOpen(false),
      trees: cashflowTrees ?? [],
      loading: cashflowTreesLoading,
      error:
        cashflowTreesError instanceof Error ? cashflowTreesError.message : null,
      onCreateTree: async (name, isDefault) => {
        await createCashflowTreeMutation.mutateAsync({
          name,
          is_default: Boolean(isDefault),
        });
      },
      onRenameTree: async (id, name) => {
        await updateCashflowTreeMutation.mutateAsync({
          id,
          payload: { name },
        });
      },
      onDeleteTree: async (id) => {
        await deleteCashflowTreeMutation.mutateAsync(id);
      },
      onSetDefault: async (id) => {
        await updateCashflowTreeMutation.mutateAsync({
          id,
          payload: { is_default: true },
        });
      },
      onExportTree: (id: UUID) => handleExportCashflow(id),
      createPending: createCashflowTreeMutation.isPending,
      updatePending: updateCashflowTreeMutation.isPending,
      deletePending: deleteCashflowTreeMutation.isPending,
    },
    billingModal: {
      source: billingModalSource,
      month: billingModalMonth,
      close: handleCloseBillingModal,
      onSaved: handleBillingSaved,
    },
    deleteDialog: {
      isOpen: Boolean(snapshotPendingDelete),
      title: t("common.delete"),
      message: t("finance.deleteSnapshotWarning", {
        period: snapshotPendingDelete
          ? formatMonthInTimezone(
              snapshotPendingDelete.period_start,
              activeTimezone,
            )
          : "",
      }),
      confirmText: t("common.confirm"),
      cancelText: t("common.cancel"),
      onConfirm: handleConfirmDeleteSnapshot,
      onCancel: handleCancelDeleteSnapshot,
    },
    actions: {
      openSourceManager: () => setSourceModalOpen(true),
      openSnapshotForm: handleOpenSnapshotForm,
    },
  };
}
