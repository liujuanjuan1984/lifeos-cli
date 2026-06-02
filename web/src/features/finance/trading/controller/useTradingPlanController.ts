import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useToastMutation } from "@/hooks/useToastMutation";
import { useToast } from "@/contexts/ToastContext";
import { financeKeys } from "@/services/api/queryKeys";
import {
  invalidateTradingEntries,
  invalidateTradingPlanInstruments,
  invalidateTradingPlanLists,
  invalidateTradingPlanSummary,
} from "@/services/api/cacheInvalidation/financeTrading";
import { useSnapshotSelection } from "@/features/finance/shared";
import {
  financeTradingApi,
  type TradingEntryPayload,
  type TradingEntryResponse,
  type TradingInstrumentPayload,
  type TradingInstrumentResponse,
  type TradingInstrumentSummary,
  type TradingPlanListResponse,
  type TradingPlanPayload,
  type TradingPlanResponse,
  type TradingPlanRateUsage,
  type TradingRateMode,
  type TradingPlanSummaryTotals,
} from "@/services/api/finance";
import type { UUID } from "@/types/primitive";
import {
  financeExchangeRateApi,
  type CreateExchangeRatePayload,
} from "@/services/api/finance/exchangeRates";
import { useFinanceTradingExport } from "@/hooks/useExport";
import { exportApi } from "@/services/api";
import { ApiError } from "@/services/api/client";
import {
  formatPercentValue,
  formatTradingPlanPeriod,
} from "@/features/finance/trading/utils";

export interface EntryFilters {
  instrumentId: UUID | "";
  startDate: string;
  endDate: string;
}

interface RateDraftState {
  base?: string | null;
  quote?: string | null;
  rate?: string | null;
}

export interface TradingPlanController {
  status: {
    plansLoading: boolean;
    plansError: Error | null;
  };
  planSelector: {
    plans: TradingPlanResponse[];
    planOptions: { value: UUID; label: string }[];
    selectedPlanId: UUID | null;
    selectedPlan: TradingPlanResponse | null;
    hasPrevious: boolean;
    hasNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
    includeArchived: boolean;
    onToggleIncludeArchived: () => void;
    onSelectPlan: (id: UUID) => void;
    onCreatePlan: () => void;
    onEditSelectedPlan: () => void;
    onArchiveSelectedPlan: () => void;
    onAddExchangeRate: () => void;
  };
  summary: {
    planName: string;
    summaryTotals: TradingPlanSummaryTotals | null | undefined;
    summaryPrimaryCurrency: string;
    summaryInstruments: TradingInstrumentSummary[];
    summaryInstrumentMap: Map<UUID, TradingInstrumentSummary>;
    isSummaryLoading: boolean;
    isSummaryFetching: boolean;
    planPrimaryCurrency: string;
    netValue: string | null | undefined;
    hasSummaryData: boolean;
    summaryError: Error | null;
    summaryErrorStatus: number | null;
    ratesUpdatedAt: string | null | undefined;
    planRateUsages: TradingPlanRateUsage[];
    canManageRates: boolean;
    rateMode: TradingRateMode;
    onRateModeChange: (mode: TradingRateMode) => void;
    onExportJson: () => void;
    onExportCsv: () => void;
    exportCsvDisabled: boolean;
    onRefreshSummary: () => void;
    onOpenRateModal: () => void;
    onRateOverride: (usage: TradingPlanRateUsage) => void;
  };
  instruments: {
    instrumentItems: TradingInstrumentResponse[];
    summaryInstrumentMap: Map<UUID, TradingInstrumentSummary>;
    planPrimaryCurrency: string;
    selectedPlanId: UUID | null;
    onAddInstrument: () => void;
    onQuickAddEntry: (instrumentId: UUID) => void;
    onEditInstrument: (instrument: TradingInstrumentResponse) => void;
    onDeleteInstrument: (instrument: TradingInstrumentResponse) => void;
  };
  entries: {
    selectedPlanId: UUID | null;
    instrumentItems: TradingInstrumentResponse[];
    instrumentMap: Map<UUID, TradingInstrumentResponse>;
    entries: TradingEntryResponse[];
    entriesLoading: boolean;
    entryFilters: EntryFilters;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;
    onResetFilters: () => void;
    onInstrumentFilterChange: (value: UUID | "") => void;
    onEntryDelete: (entry: TradingEntryResponse) => void;
    onEntryEdit: (entry: TradingEntryResponse) => void;
    onImportCsv: () => void;
    onExportCsv: () => void;
    exportCsvDisabled: boolean;
    quickEntrySubmitting: boolean;
    quickEntryPresetInstrumentId: UUID | null;
    onQuickEntryPresetConsumed: () => void;
    quickEntryContainerRef: RefObject<HTMLDivElement | null>;
    onQuickEntrySubmit: (payload: TradingEntryPayload) => Promise<void>;
  };
  modals: {
    planModalState:
      | { mode: "create" }
      | { mode: "edit"; plan: TradingPlanResponse }
      | null;
    instrumentModalState:
      | { mode: "create" }
      | { mode: "edit"; instrument: TradingInstrumentResponse }
      | null;
    importModalOpen: boolean;
    entryModalState:
      | { mode: "create"; instrumentId?: UUID | null }
      | { mode: "edit"; entry: TradingEntryResponse }
      | null;
    rateModalOpen: boolean;
    rateDraft: RateDraftState | null;
    instrumentPendingDelete: TradingInstrumentResponse | null;
    entryPendingDelete: TradingEntryResponse | null;
    planPendingArchive: TradingPlanResponse | null;
    setPlanModalState: Dispatch<
      SetStateAction<
        { mode: "create" } | { mode: "edit"; plan: TradingPlanResponse } | null
      >
    >;
    setInstrumentModalState: Dispatch<
      SetStateAction<
        | { mode: "create" }
        | { mode: "edit"; instrument: TradingInstrumentResponse }
        | null
      >
    >;
    setImportModalOpen: Dispatch<SetStateAction<boolean>>;
    setEntryModalState: Dispatch<
      SetStateAction<
        | { mode: "create"; instrumentId?: UUID | null }
        | { mode: "edit"; entry: TradingEntryResponse }
        | null
      >
    >;
    openRateModal: (draft?: RateDraftState | null) => void;
    closeRateModal: () => void;
    setInstrumentPendingDelete: Dispatch<
      SetStateAction<TradingInstrumentResponse | null>
    >;
    setEntryPendingDelete: Dispatch<
      SetStateAction<TradingEntryResponse | null>
    >;
    setPlanPendingArchive: Dispatch<SetStateAction<TradingPlanResponse | null>>;
    handlePlanSubmit: (payload: TradingPlanPayload) => Promise<void>;
    handleInstrumentSubmit: (
      payload: TradingInstrumentPayload,
    ) => Promise<void>;
    handleEntryModalSubmit: (payload: TradingEntryPayload) => Promise<void>;
    handleImportSubmit: (rows: TradingEntryPayload[]) => Promise<void>;
    handleExchangeRateSubmit: (
      payload: CreateExchangeRatePayload,
    ) => Promise<void>;
    confirmDeleteInstrument: () => Promise<void>;
    confirmDeleteEntry: () => Promise<void>;
    confirmArchivePlan: () => Promise<void>;
    submitStatus: {
      createPlanPending: boolean;
      updatePlanPending: boolean;
      createInstrumentPending: boolean;
      updateInstrumentPending: boolean;
      deleteInstrumentPending: boolean;
      createEntryPending: boolean;
      updateEntryPending: boolean;
      deleteEntryPending: boolean;
      archivePlanPending: boolean;
      createExchangeRatePending: boolean;
    };
  };
}

export function useTradingPlanController(): TradingPlanController {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [planModalState, setPlanModalState] = useState<
    { mode: "create" } | { mode: "edit"; plan: TradingPlanResponse } | null
  >(null);
  const [instrumentModalState, setInstrumentModalState] = useState<
    | { mode: "create" }
    | { mode: "edit"; instrument: TradingInstrumentResponse }
    | null
  >(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [entryFilters, setEntryFilters] = useState<EntryFilters>({
    instrumentId: "",
    startDate: "",
    endDate: "",
  });
  const [instrumentPendingDelete, setInstrumentPendingDelete] =
    useState<TradingInstrumentResponse | null>(null);
  const [entryPendingDelete, setEntryPendingDelete] =
    useState<TradingEntryResponse | null>(null);
  const [entryModalState, setEntryModalState] = useState<
    | { mode: "create"; instrumentId?: UUID | null }
    | { mode: "edit"; entry: TradingEntryResponse }
    | null
  >(null);
  const [quickEntryInstrumentId, setQuickEntryInstrumentId] =
    useState<UUID | null>(null);
  const [planPendingArchive, setPlanPendingArchive] =
    useState<TradingPlanResponse | null>(null);
  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateDraft, setRateDraft] = useState<RateDraftState | null>(null);
  const [rateMode, setRateMode] = useState<TradingRateMode>("snapshot");
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const quickEntryRef = useRef<HTMLDivElement | null>(null);
  const { exportData: exportTradingData } = useFinanceTradingExport();

  const openRateModal = (draft: RateDraftState | null = null) => {
    setRateDraft(draft);
    setRateModalOpen(true);
  };

  const closeRateModal = () => {
    setRateModalOpen(false);
    setRateDraft(null);
  };

  const plansQueryKey = financeKeys.tradingPlanList({
    includeArchived: includeArchived || undefined,
  });

  const {
    data: plansData,
    isLoading: plansLoading,
    error: plansError,
  } = useQuery({
    queryKey: plansQueryKey,
    queryFn: () =>
      financeTradingApi.listPlans(
        includeArchived
          ? { include_archived: true, page: 1, size: 500 }
          : { page: 1, size: 500 },
      ),
  });

  const plans = useMemo<TradingPlanResponse[]>(
    () => plansData?.items ?? [],
    [plansData],
  );

  const formatPlanOptionLabel = useCallback(
    (plan: TradingPlanResponse) => {
      const statusLabel = t(`finance.trading.status.${plan.status}` as const);
      const periodLabel = formatTradingPlanPeriod(
        plan.period_start,
        plan.period_end,
        t("finance.trading.labels.noPeriod"),
      );
      const roiLabel = formatPercentValue(plan.target_roi);
      const targetLabel = t("finance.trading.labels.targetRoi");
      return `${plan.name} · ${statusLabel} · ${periodLabel} · ${targetLabel}: ${roiLabel}`;
    },
    [t],
  );

  const {
    selectedId: selectedPlanId,
    setSelectedId: setSelectedPlanId,
    currentSnapshot: selectedPlan,
    hasPrevious,
    hasNext,
    goToPrevious,
    goToNext,
    options: planOptions,
  } = useSnapshotSelection<TradingPlanResponse, UUID>({
    snapshots: plans,
    getId: (plan) => plan.id,
    getOptionLabel: formatPlanOptionLabel,
  });

  useEffect(() => {
    if (!selectedPlanId) {
      setEntryModalState(null);
    }
  }, [selectedPlanId]);

  const summaryQueryKey = selectedPlanId
    ? financeKeys.tradingPlanSummary(selectedPlanId, { rateMode })
    : financeKeys.tradingPlaceholder("summary-null");

  const summaryQuery = useQuery({
    queryKey: summaryQueryKey,
    queryFn: () =>
      financeTradingApi.getPlanSummary(selectedPlanId as UUID, {
        rate_mode: rateMode,
      }),
    enabled: Boolean(selectedPlanId),
  });

  const instrumentsQuery = useQuery({
    queryKey: selectedPlanId
      ? financeKeys.tradingInstruments(selectedPlanId)
      : financeKeys.tradingPlaceholder("instruments-null"),
    queryFn: () =>
      financeTradingApi.listInstruments(selectedPlanId as UUID, {
        page: 1,
        size: 500,
      }),
    enabled: Boolean(selectedPlanId),
  });

  const instrumentItems = useMemo<TradingInstrumentResponse[]>(
    () => instrumentsQuery.data?.items ?? [],
    [instrumentsQuery.data],
  );
  const instrumentMap = useMemo(() => {
    const map = new Map<UUID, TradingInstrumentResponse>();
    instrumentItems.forEach((instrument) => map.set(instrument.id, instrument));
    return map;
  }, [instrumentItems]);

  const normalizedEntryFilters = useMemo(() => {
    if (!selectedPlanId) return null;
    return {
      plan_id: selectedPlanId,
      instrument_id:
        entryFilters.instrumentId !== ""
          ? entryFilters.instrumentId
          : undefined,
      start_time: entryFilters.startDate
        ? new Date(`${entryFilters.startDate}T00:00:00`).toISOString()
        : undefined,
      end_time: entryFilters.endDate
        ? new Date(`${entryFilters.endDate}T23:59:59`).toISOString()
        : undefined,
      page: 1,
      size: 200,
    };
  }, [selectedPlanId, entryFilters]);

  const entriesQuery = useQuery({
    queryKey: normalizedEntryFilters
      ? financeKeys.tradingEntries(normalizedEntryFilters)
      : financeKeys.tradingPlaceholder("entries-null"),
    queryFn: () => financeTradingApi.listEntries(normalizedEntryFilters!),
    enabled: Boolean(normalizedEntryFilters),
  });

  const planPrimaryCurrency = summaryQuery.data?.primary_currency ?? "USD";
  const planRateUsages = summaryQuery.data?.rates_used ?? [];
  const ratesUpdatedAt = summaryQuery.data?.rates_updated_at ?? null;

  const planListInvalidator = () => {
    return invalidateTradingPlanLists(queryClient);
  };
  const planSummaryInvalidator = () => {
    if (!selectedPlanId) return;
    return invalidateTradingPlanSummary(queryClient, selectedPlanId, {
      rateMode,
    });
  };
  const instrumentInvalidator = () => {
    if (!selectedPlanId) return;
    return invalidateTradingPlanInstruments(queryClient, selectedPlanId);
  };
  const entriesInvalidator = () => {
    if (!normalizedEntryFilters) return;
    return invalidateTradingEntries(queryClient, normalizedEntryFilters);
  };

  const refreshSummary = async () => {
    if (!selectedPlanId) return;
    setSummaryRefreshing(true);
    try {
      if (rateMode === "snapshot") {
        await financeTradingApi.refreshPlanRateSnapshot(selectedPlanId);
      }
      const data = await financeTradingApi.getPlanSummary(selectedPlanId, {
        rate_mode: rateMode,
      });
      queryClient.setQueryData(summaryQueryKey, data);
    } finally {
      setSummaryRefreshing(false);
    }
  };

  const createPlanMutation = useToastMutation({
    mutationFn: financeTradingApi.createPlan,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.trading.toasts.planCreated"),
    }),
    onSuccess: (data) => {
      if (data) {
        setSelectedPlanId(data.id);
        queryClient.setQueryData<TradingPlanListResponse>(
          plansQueryKey,
          (prev) => {
            if (!prev) {
              return {
                items: [data],
                pagination: {
                  page: 1,
                  size: 500,
                  total: 1,
                  pages: 1,
                },
                meta: { include_archived: includeArchived },
              };
            }
            const items = prev.items ?? [];
            const exists = items.some((plan) => plan.id === data.id);
            const nextTotal = exists
              ? prev.pagination.total
              : prev.pagination.total + 1;
            const nextPages = prev.pagination.size
              ? Math.ceil(nextTotal / prev.pagination.size)
              : prev.pagination.pages;
            return {
              ...prev,
              items: exists ? items : [data, ...items],
              pagination: {
                ...prev.pagination,
                total: nextTotal,
                pages: nextPages,
              },
            };
          },
        );
      }
      planListInvalidator();
    },
  });

  const updatePlanMutation = useToastMutation({
    mutationFn: ({ id, payload }: { id: UUID; payload: TradingPlanPayload }) =>
      financeTradingApi.updatePlan(id, payload),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.trading.toasts.planUpdated"),
    }),
    onSuccess: () => {
      planListInvalidator();
      planSummaryInvalidator();
    },
  });

  const archivePlanMutation = useToastMutation({
    mutationFn: (id: UUID) => financeTradingApi.archivePlan(id),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.trading.toasts.planArchived"),
    }),
    onSuccess: () => {
      planListInvalidator();
      planSummaryInvalidator();
    },
  });

  const createInstrumentMutation = useToastMutation({
    mutationFn: ({
      planId,
      payload,
    }: {
      planId: UUID;
      payload: TradingInstrumentPayload;
    }) => financeTradingApi.createInstrument(planId, payload),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.trading.toasts.instrumentCreated"),
    }),
    onSuccess: () => {
      instrumentInvalidator();
      planSummaryInvalidator();
    },
  });

  const updateInstrumentMutation = useToastMutation({
    mutationFn: ({
      planId,
      instrumentId,
      payload,
    }: {
      planId: UUID;
      instrumentId: UUID;
      payload: TradingInstrumentPayload;
    }) => financeTradingApi.updateInstrument(planId, instrumentId, payload),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.trading.toasts.instrumentUpdated"),
    }),
    onSuccess: () => {
      instrumentInvalidator();
      planSummaryInvalidator();
    },
  });

  const deleteInstrumentMutation = useToastMutation({
    mutationFn: ({
      planId,
      instrumentId,
    }: {
      planId: UUID;
      instrumentId: UUID;
    }) => financeTradingApi.deleteInstrument(planId, instrumentId),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.trading.toasts.instrumentDeleted"),
    }),
    onSuccess: () => {
      instrumentInvalidator();
      planSummaryInvalidator();
      entriesInvalidator();
    },
  });

  const createEntryMutation = useToastMutation({
    mutationFn: financeTradingApi.createEntry,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.trading.toasts.entryCreated"),
    }),
    onSuccess: () => {
      entriesInvalidator();
      planSummaryInvalidator();
    },
  });

  const updateEntryMutation = useToastMutation({
    mutationFn: ({ id, payload }: { id: UUID; payload: TradingEntryPayload }) =>
      financeTradingApi.updateEntry(id, payload),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.trading.toasts.entryUpdated"),
    }),
    onSuccess: () => {
      entriesInvalidator();
      planSummaryInvalidator();
    },
  });

  const deleteEntryMutation = useToastMutation({
    mutationFn: (id: UUID) => financeTradingApi.deleteEntry(id),
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.trading.toasts.entryDeleted"),
    }),
    onSuccess: () => {
      entriesInvalidator();
      planSummaryInvalidator();
    },
  });

  const createExchangeRateMutation = useToastMutation({
    mutationFn: financeExchangeRateApi.createRate,
    getSuccessToast: () => ({
      title: t("common.success"),
      description: t("finance.trading.exchangeRates.toasts.created"),
    }),
    onSuccess: () => {
      planSummaryInvalidator();
    },
  });

  const handlePlanSubmit = async (payload: TradingPlanPayload) => {
    if (planModalState?.mode === "edit" && planModalState.plan) {
      await updatePlanMutation.mutateAsync({
        id: planModalState.plan.id,
        payload,
      });
    } else {
      await createPlanMutation.mutateAsync(payload);
    }
  };

  const handleInstrumentSubmit = async (payload: TradingInstrumentPayload) => {
    if (!selectedPlanId) return;
    if (
      instrumentModalState?.mode === "edit" &&
      instrumentModalState.instrument
    ) {
      await updateInstrumentMutation.mutateAsync({
        planId: selectedPlanId,
        instrumentId: instrumentModalState.instrument.id,
        payload,
      });
    } else {
      await createInstrumentMutation.mutateAsync({
        planId: selectedPlanId,
        payload,
      });
    }
  };

  const handleEntryModalSubmit = async (payload: TradingEntryPayload) => {
    if (!entryModalState) return;
    const currentState = entryModalState;
    setEntryModalState(null);
    if (currentState.mode === "edit") {
      await updateEntryMutation.mutateAsync({
        id: currentState.entry.id,
        payload,
      });
    } else {
      await createEntryMutation.mutateAsync(payload);
    }
  };

  const handleExchangeRateSubmit = async (
    payload: CreateExchangeRatePayload,
  ) => {
    await createExchangeRateMutation.mutateAsync(payload);
  };

  const handleRateOverride = (usage: TradingPlanRateUsage) => {
    openRateModal({
      base: usage.base_asset,
      quote: usage.quote_asset,
      rate: usage.rate,
    });
  };

  const handleImportSubmit = async (rows: TradingEntryPayload[]) => {
    try {
      for (const row of rows) {
        await financeTradingApi.createEntry(row);
      }
      toast.showSuccess(
        t("common.success"),
        t("finance.trading.import.success"),
      );
      entriesInvalidator();
      planSummaryInvalidator();
    } catch (err) {
      toast.showError(
        t("common.error"),
        err instanceof Error ? err.message : t("finance.trading.import.failed"),
      );
    }
  };

  const handleExportEntries = async (format: "csv" | "json") => {
    if (!selectedPlanId) return;
    const payload = {
      plan_id: selectedPlanId,
      instrument_id:
        entryFilters.instrumentId !== "" ? entryFilters.instrumentId : null,
      start_time: entryFilters.startDate
        ? `${entryFilters.startDate}T00:00:00`
        : null,
      end_time: entryFilters.endDate
        ? `${entryFilters.endDate}T23:59:59`
        : null,
      format,
    };

    let estimatedSizeBytes: number | undefined;
    try {
      const estimate = await exportApi.estimate("finance-trading", payload);
      estimatedSizeBytes = estimate.estimated_size_bytes;
    } catch (err) {
      // Continue without estimate.
    }

    await exportTradingData(payload, {
      forceFile: true,
      showToasts: true,
      estimatedSizeBytes,
    });
  };

  const handleExportJson = async () => {
    await handleExportEntries("json");
  };

  const handleExportCsv = async () => {
    await handleExportEntries("csv");
  };

  const confirmDeleteInstrument = async () => {
    if (!selectedPlanId || !instrumentPendingDelete) return;
    const payload = {
      planId: selectedPlanId,
      instrumentId: instrumentPendingDelete.id,
    };
    setInstrumentPendingDelete(null);
    await deleteInstrumentMutation.mutateAsync(payload);
  };

  const confirmDeleteEntry = async () => {
    if (!entryPendingDelete) return;
    const entryId = entryPendingDelete.id;
    setEntryPendingDelete(null);
    await deleteEntryMutation.mutateAsync(entryId);
  };

  const confirmArchivePlan = async () => {
    if (!planPendingArchive) return;
    const planId = planPendingArchive.id;
    setPlanPendingArchive(null);
    await archivePlanMutation.mutateAsync(planId);
  };

  const filteredEntries = entriesQuery.data?.items ?? [];

  const summaryTotals = summaryQuery.data?.totals;
  const summaryPrimaryCurrency = summaryQuery.data?.primary_currency ?? "USD";
  const summaryError =
    summaryQuery.error instanceof Error ? summaryQuery.error : null;
  const summaryErrorStatus =
    summaryQuery.error instanceof ApiError ? summaryQuery.error.status : null;
  const summaryInstruments = useMemo(
    () => summaryQuery.data?.instruments ?? [],
    [summaryQuery.data?.instruments],
  );
  const summaryInstrumentMap = useMemo(() => {
    const map = new Map<UUID, TradingInstrumentSummary>();
    summaryInstruments.forEach((instrument) =>
      map.set(instrument.instrument_id, instrument),
    );
    return map;
  }, [summaryInstruments]);
  const hasSummaryData = Boolean(summaryQuery.data);

  return {
    status: {
      plansLoading,
      plansError: plansError instanceof Error ? plansError : null,
    },
    planSelector: {
      plans,
      planOptions,
      selectedPlanId,
      selectedPlan,
      hasPrevious,
      hasNext,
      onPrevious: goToPrevious,
      onNext: goToNext,
      includeArchived,
      onToggleIncludeArchived: () => setIncludeArchived((prev) => !prev),
      onSelectPlan: (id) => setSelectedPlanId(id),
      onCreatePlan: () => setPlanModalState({ mode: "create" }),
      onEditSelectedPlan: () =>
        selectedPlan && setPlanModalState({ mode: "edit", plan: selectedPlan }),
      onArchiveSelectedPlan: () =>
        selectedPlan && setPlanPendingArchive(selectedPlan),
      onAddExchangeRate: () => openRateModal(),
    },
    summary: {
      planName: selectedPlan?.name ?? "",
      summaryTotals,
      summaryPrimaryCurrency,
      summaryInstruments,
      summaryInstrumentMap,
      isSummaryLoading: summaryQuery.isLoading,
      isSummaryFetching: summaryQuery.isFetching || summaryRefreshing,
      planPrimaryCurrency,
      netValue: summaryTotals?.net_value ?? null,
      hasSummaryData,
      summaryError,
      summaryErrorStatus,
      ratesUpdatedAt,
      planRateUsages,
      canManageRates: Boolean(selectedPlanId),
      rateMode,
      onRateModeChange: setRateMode,
      onExportJson: handleExportJson,
      onExportCsv: handleExportCsv,
      exportCsvDisabled: !filteredEntries.length,
      onRefreshSummary: refreshSummary,
      onOpenRateModal: () => openRateModal(),
      onRateOverride: handleRateOverride,
    },
    instruments: {
      instrumentItems,
      summaryInstrumentMap,
      planPrimaryCurrency,
      selectedPlanId,
      onAddInstrument: () => setInstrumentModalState({ mode: "create" }),
      onQuickAddEntry: (instrumentId) =>
        setQuickEntryInstrumentId(instrumentId),
      onEditInstrument: (instrument) =>
        setInstrumentModalState({ mode: "edit", instrument }),
      onDeleteInstrument: (instrument) =>
        setInstrumentPendingDelete(instrument),
    },
    entries: {
      selectedPlanId,
      instrumentItems,
      instrumentMap,
      entries: filteredEntries,
      entriesLoading: entriesQuery.isLoading,
      entryFilters,
      onDateFromChange: (value) =>
        setEntryFilters((prev) => ({ ...prev, startDate: value })),
      onDateToChange: (value) =>
        setEntryFilters((prev) => ({ ...prev, endDate: value })),
      onResetFilters: () =>
        setEntryFilters({ instrumentId: "", startDate: "", endDate: "" }),
      onInstrumentFilterChange: (value) =>
        setEntryFilters((prev) => ({ ...prev, instrumentId: value })),
      onEntryDelete: (entry) => setEntryPendingDelete(entry),
      onEntryEdit: (entry) => setEntryModalState({ mode: "edit", entry }),
      onImportCsv: () => setImportModalOpen(true),
      onExportCsv: handleExportCsv,
      exportCsvDisabled: !filteredEntries.length,
      quickEntrySubmitting: createEntryMutation.isPending,
      quickEntryPresetInstrumentId: quickEntryInstrumentId,
      onQuickEntryPresetConsumed: () => setQuickEntryInstrumentId(null),
      quickEntryContainerRef: quickEntryRef,
      onQuickEntrySubmit: async (payload) => {
        await createEntryMutation.mutateAsync(payload);
      },
    },
    modals: {
      planModalState,
      instrumentModalState,
      importModalOpen,
      entryModalState,
      rateModalOpen,
      rateDraft,
      instrumentPendingDelete,
      entryPendingDelete,
      planPendingArchive,
      setPlanModalState,
      setInstrumentModalState,
      setImportModalOpen,
      setEntryModalState,
      openRateModal,
      closeRateModal,
      setInstrumentPendingDelete,
      setEntryPendingDelete,
      setPlanPendingArchive,
      handlePlanSubmit,
      handleInstrumentSubmit,
      handleEntryModalSubmit,
      handleImportSubmit,
      handleExchangeRateSubmit,
      confirmDeleteInstrument,
      confirmDeleteEntry,
      confirmArchivePlan,
      submitStatus: {
        createPlanPending: createPlanMutation.isPending,
        updatePlanPending: updatePlanMutation.isPending,
        createInstrumentPending: createInstrumentMutation.isPending,
        updateInstrumentPending: updateInstrumentMutation.isPending,
        deleteInstrumentPending: deleteInstrumentMutation.isPending,
        createEntryPending: createEntryMutation.isPending,
        updateEntryPending: updateEntryMutation.isPending,
        deleteEntryPending: deleteEntryMutation.isPending,
        archivePlanPending: archivePlanMutation.isPending,
        createExchangeRatePending: createExchangeRateMutation.isPending,
      },
    },
  };
}
