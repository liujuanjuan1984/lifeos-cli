import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import ActionButton, { CreateNewButton } from "@/components/ActionButton";
import Badge from "@/components/common/Badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import ErrorDisplay from "@/components/ErrorDisplay";
import { FormField, TextArea, TextInput } from "@/components/forms";
import LoadingSpinner from "@/components/LoadingSpinner";
import AssetSelect from "@/components/selects/AssetSelect";
import EnumSelect from "@/components/selects/EnumSelect";
import ToolbarContainer from "@/components/ToolbarContainer";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { useToast } from "@/contexts/ToastContext";
import ModalBase from "@/layouts/ModalBase";
import PageLayout from "@/layouts/PageLayout";
import {
  financeApi,
  type FinanceAsset,
  type FinancePurpose,
  type FinanceRateSnapshot,
  type FinanceRateSnapshotCreate,
  type FinanceSnapshot,
  type FinanceSnapshotEntryCreate,
  type FinanceTree,
  type FinanceTreeNode,
} from "@/services/api/finance";
import {
  addFinanceRateSnapshotToListCache,
  invalidateFinanceAssets,
  invalidateFinanceRateSnapshots,
  invalidateFinanceSnapshot,
  invalidateFinanceSnapshots,
  invalidateFinanceTreeByPurpose,
  removeFinanceSnapshotCache,
  removeFinanceSnapshotFromListCache,
  setFinanceRateSnapshotCache,
  setFinanceSnapshotCache,
} from "@/services/api/cacheInvalidation/finance";
import { financeKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";
import { formatDate, formatDateTime } from "@/utils/datetime";

type PresetConfig = {
  purpose: FinancePurpose;
  titleKey: string;
  descriptionKey: string;
  amountLabelKey: string;
  timeMode: "instant" | "period";
};
type FinanceTab = FinancePurpose | "rates";

type TreeNodeWithChildren = FinanceTreeNode & {
  children: TreeNodeWithChildren[];
};

type SnapshotAmountState = Record<UUID, string>;
type SnapshotNoteState = Record<UUID, string>;
type FinanceNodeFormState =
  | { mode: "create"; parentId?: UUID | null }
  | { mode: "edit"; node: TreeNodeWithChildren };

const PRESETS: PresetConfig[] = [
  {
    purpose: "balance",
    titleKey: "finance.balance.title",
    descriptionKey: "finance.balance.description",
    amountLabelKey: "finance.balance.amountLabel",
    timeMode: "instant",
  },
  {
    purpose: "cashflow",
    titleKey: "finance.cashflow.title",
    descriptionKey: "finance.cashflow.description",
    amountLabelKey: "finance.cashflow.amountLabel",
    timeMode: "period",
  },
];

const todayDate = () => new Date().toISOString().slice(0, 10);

const nowDateTimeLocal = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
};

const localDateTimeToIso = (value: string) => {
  if (!value) return null;
  return new Date(value).toISOString();
};

const isoToDateTimeLocal = (value?: string | null) => {
  if (!value) return nowDateTimeLocal();
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const isoToDateInput = (value?: string | null) => {
  if (!value) return todayDate();
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
};

const dateToStartIso = (value: string) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toISOString();
};

const dateToEndIso = (value: string) => {
  if (!value) return null;
  return new Date(`${value}T23:59:59`).toISOString();
};

const formatMoney = (value?: string | null, currency = "") => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return `${value ?? "0"} ${currency}`.trim();
  }
  return `${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`.trim();
};

const buildTree = (nodes: FinanceTreeNode[]): TreeNodeWithChildren[] => {
  const sorted = [...nodes].sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return a.display_order - b.display_order;
  });
  const map = new Map<UUID, TreeNodeWithChildren>();
  sorted.forEach((node) => {
    map.set(node.id, { ...node, children: [] });
  });
  const roots: TreeNodeWithChildren[] = [];
  sorted.forEach((node) => {
    const current = map.get(node.id);
    if (!current) return;
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)?.children.push(current);
      return;
    }
    roots.push(current);
  });
  return roots;
};

const flattenTree = (nodes: TreeNodeWithChildren[]): TreeNodeWithChildren[] => {
  const result: TreeNodeWithChildren[] = [];
  const walk = (items: TreeNodeWithChildren[]) => {
    items.forEach((item) => {
      result.push(item);
      walk(item.children);
    });
  };
  walk(nodes);
  return result;
};

function snapshotLabel(snapshot: FinanceSnapshot) {
  if (snapshot.period_start && snapshot.period_end) {
    return `${formatDate(snapshot.period_start)} - ${formatDate(snapshot.period_end)}`;
  }
  if (snapshot.snapshot_ts) {
    return formatDateTime(snapshot.snapshot_ts);
  }
  return snapshot.created_at;
}

function rateSnapshotLabel(snapshot: FinanceRateSnapshot) {
  const pairs = (snapshot.entries ?? [])
    .slice(0, 3)
    .map((entry) => `${entry.base_currency}/${entry.quote_currency}`)
    .join(", ");
  return pairs
    ? `${formatDateTime(snapshot.captured_at)} · ${pairs}`
    : formatDateTime(snapshot.captured_at);
}

function FinancePage() {
  const { t } = useTranslation();
  const { setHeader } = usePageHeader();
  const [activeTab, setActiveTab] = useState<FinanceTab>("balance");

  useEffect(() => {
    setHeader({
      title: t("finance.title"),
      subtitle: t("finance.subtitle"),
    });
    return () => setHeader({ title: undefined, subtitle: undefined, actions: undefined });
  }, [setHeader, t]);

  const preset = PRESETS.find((item) => item.purpose === activeTab) ?? PRESETS[0];
  const tabs: { id: FinanceTab; label: string }[] = [
    ...PRESETS.map((item) => ({ id: item.purpose, label: t(item.titleKey) })),
    { id: "rates", label: t("finance.rates.tabTitle") },
  ];

  return (
    <PageLayout>
      <ToolbarContainer className="mb-6" variant="compact" padding="sm">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((item) => (
            <ActionButton
              key={item.id}
              label={item.label}
              onClick={() => setActiveTab(item.id)}
              color={activeTab === item.id ? "primary" : "neutral"}
              variant={activeTab === item.id ? "solid" : "ghost"}
              size="sm"
            />
          ))}
        </div>
      </ToolbarContainer>

      {activeTab === "rates" ? (
        <RateSnapshotsWorkspace />
      ) : (
        <FinancePresetWorkspace key={preset.purpose} preset={preset} />
      )}
    </PageLayout>
  );
}

function useFinanceAssetSource() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();

  const assetsQuery = useQuery({
    queryKey: financeKeys.assets(),
    queryFn: () => financeApi.listAssets(),
    staleTime: 60_000,
  });

  const createAssetMutation = useMutation({
    mutationFn: (code: string) => financeApi.createAsset({ code }),
    onSuccess: async () => {
      await invalidateFinanceAssets(queryClient);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  return {
    assets: assetsQuery.data?.items ?? [],
    assetsLoading: assetsQuery.isLoading,
    createAsset: (code: string) => createAssetMutation.mutateAsync(code),
  };
}

function FinancePresetWorkspace({ preset }: { preset: PresetConfig }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { assets, createAsset } = useFinanceAssetSource();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<UUID | null>(null);
  const [snapshotFormVisible, setSnapshotFormVisible] = useState(false);
  const [snapshotFormMode, setSnapshotFormMode] = useState<"create" | "edit">("create");
  const [treeManagerOpen, setTreeManagerOpen] = useState(false);
  const [nodeFormState, setNodeFormState] = useState<FinanceNodeFormState | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<TreeNodeWithChildren | null>(null);
  const [pendingDeleteSnapshot, setPendingDeleteSnapshot] = useState<FinanceSnapshot | null>(null);
  const [deletedSnapshotIds, setDeletedSnapshotIds] = useState<Set<UUID>>(() => new Set());

  const treeQuery = useQuery({
    queryKey: financeKeys.treesByPurpose(preset.purpose),
    queryFn: () => financeApi.ensureDefaultTree(preset.purpose),
    staleTime: 60_000,
  });

  const tree = treeQuery.data;
  const treeNodes = useMemo(() => buildTree(tree?.nodes ?? []), [tree?.nodes]);
  const flatNodes = useMemo(() => flattenTree(treeNodes), [treeNodes]);
  const entryNodes = useMemo(
    () => flatNodes.filter((node) => node.children_count === 0),
    [flatNodes],
  );
  const requiredRateCurrencies = useMemo(
    () => getRequiredRateCurrencies(entryNodes, tree?.primary_currency ?? ""),
    [entryNodes, tree?.primary_currency],
  );

  const snapshotsQuery = useQuery({
    queryKey: financeKeys.snapshots(tree?.id ?? null),
    queryFn: () => financeApi.listSnapshots(tree!.id),
    enabled: Boolean(tree?.id),
  });

  const rawSnapshots = snapshotsQuery.data?.items ?? [];
  const snapshots = rawSnapshots.filter((snapshot) => !deletedSnapshotIds.has(snapshot.id));

  const rateSnapshotsQuery = useQuery({
    queryKey: financeKeys.rateSnapshots(),
    queryFn: () => financeApi.listRateSnapshots(),
  });
  const rateSnapshots = rateSnapshotsQuery.data?.items ?? [];
  const latestSnapshot = snapshots[0] ?? null;
  const detailSnapshotId = selectedSnapshotId ?? latestSnapshot?.id ?? null;
  const currentSnapshot =
    snapshots.find((snapshot) => snapshot.id === detailSnapshotId) ?? latestSnapshot;
  const currentPosition = currentSnapshot
    ? snapshots.findIndex((snapshot) => snapshot.id === currentSnapshot.id) + 1
    : 0;
  const hasPrevious = currentPosition > 1;
  const hasNext = currentPosition > 0 && currentPosition < snapshots.length;

  const selectedSnapshotQuery = useQuery({
    queryKey: financeKeys.snapshot(detailSnapshotId),
    queryFn: () => financeApi.getSnapshot(detailSnapshotId!),
    enabled: Boolean(detailSnapshotId),
  });

  const createNodeMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      parent_id?: UUID | null;
      currency_code?: string | null;
    }) => financeApi.createNode(tree!.id, payload),
    onSuccess: async () => {
      toast.showSuccess(t("finance.messages.nodeCreated"));
      await invalidateFinanceTreeByPurpose(queryClient, preset.purpose);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: ({
      nodeId,
      payload,
    }: {
      nodeId: UUID;
      payload: {
        name?: string;
        currency_code?: string | null;
      };
    }) => financeApi.updateNode(nodeId, payload),
    onSuccess: async () => {
      toast.showSuccess(t("finance.messages.nodeUpdated"));
      setNodeFormState(null);
      await invalidateFinanceTreeByPurpose(queryClient, preset.purpose);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (nodeId: UUID) => financeApi.deleteNode(nodeId),
    onSuccess: async () => {
      toast.showSuccess(t("finance.messages.nodeDeleted"));
      setPendingDeleteNode(null);
      await invalidateFinanceTreeByPurpose(queryClient, preset.purpose);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const createSnapshotMutation = useMutation({
    mutationFn: (payload: {
      snapshot_ts?: string | null;
      period_start?: string | null;
      period_end?: string | null;
      primary_currency?: string | null;
      rate_snapshot_id?: UUID | null;
      note?: string | null;
      entries: FinanceSnapshotEntryCreate[];
    }) => financeApi.createSnapshot(tree!.id, payload),
    onSuccess: async (snapshot) => {
      toast.showSuccess(t("finance.messages.snapshotCreated"));
      setSnapshotFormVisible(false);
      setSelectedSnapshotId(snapshot.id);
      setFinanceSnapshotCache(queryClient, snapshot);
      await Promise.all([
        invalidateFinanceSnapshots(queryClient, tree?.id ?? null),
        invalidateFinanceSnapshot(queryClient, snapshot.id),
      ]);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const updateSnapshotMutation = useMutation({
    mutationFn: ({
      snapshotId,
      payload,
    }: {
      snapshotId: UUID;
      payload: {
        snapshot_ts?: string | null;
        period_start?: string | null;
        period_end?: string | null;
        primary_currency?: string | null;
        rate_snapshot_id?: UUID | null;
        note?: string | null;
        entries: FinanceSnapshotEntryCreate[];
      };
    }) => financeApi.updateSnapshot(snapshotId, payload),
    onSuccess: async (snapshot) => {
      toast.showSuccess(t("finance.messages.snapshotUpdated"));
      setSnapshotFormVisible(false);
      setSnapshotFormMode("create");
      setSelectedSnapshotId(snapshot.id);
      setFinanceSnapshotCache(queryClient, snapshot);
      await Promise.all([
        invalidateFinanceSnapshots(queryClient, tree?.id ?? null),
        invalidateFinanceSnapshot(queryClient, snapshot.id),
      ]);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: (snapshotId: UUID) => financeApi.deleteSnapshot(snapshotId),
    onMutate: async (snapshotId) => {
      const deletedIndex = snapshots.findIndex((snapshot) => snapshot.id === snapshotId);
      const nextSnapshot = snapshots[deletedIndex + 1] ?? snapshots[deletedIndex - 1] ?? null;
      await queryClient.cancelQueries({
        queryKey: financeKeys.snapshot(snapshotId),
        exact: true,
      });
      setDeletedSnapshotIds((existing) => new Set(existing).add(snapshotId));
      if (detailSnapshotId === snapshotId) {
        setSelectedSnapshotId(nextSnapshot?.id ?? null);
      }
      removeFinanceSnapshotFromListCache(queryClient, tree?.id ?? null, snapshotId);
      removeFinanceSnapshotCache(queryClient, snapshotId);
      return { previousSelectedSnapshotId: selectedSnapshotId };
    },
    onSuccess: async () => {
      toast.showSuccess(t("finance.messages.snapshotDeleted"));
      setPendingDeleteSnapshot(null);
      setSnapshotFormVisible(false);
      setSnapshotFormMode("create");
      await invalidateFinanceSnapshots(queryClient, tree?.id ?? null);
    },
    onError: (error, snapshotId, context) => {
      setDeletedSnapshotIds((existing) => {
        const next = new Set(existing);
        next.delete(snapshotId);
        return next;
      });
      setSelectedSnapshotId(context?.previousSelectedSnapshotId ?? null);
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  if (treeQuery.isLoading) {
    return <LoadingSpinner />;
  }

  if (treeQuery.error) {
    return (
      <ErrorDisplay
        error={treeQuery.error instanceof Error ? treeQuery.error.message : String(treeQuery.error)}
      />
    );
  }

  if (!tree) {
    return <ErrorDisplay error={t("finance.messages.treeMissing")} />;
  }

  const selectSnapshot = (snapshotId: UUID) => {
    setSelectedSnapshotId(snapshotId);
    setSnapshotFormVisible(false);
    setSnapshotFormMode("create");
  };

  const openCreateSnapshotForm = () => {
    setSnapshotFormMode("create");
    setSnapshotFormVisible(true);
  };

  const openEditSnapshotForm = () => {
    setSnapshotFormMode("edit");
    setSnapshotFormVisible(true);
  };

  const closeSnapshotForm = () => {
    setSnapshotFormVisible(false);
    setSnapshotFormMode("create");
  };

  const moveSnapshot = (direction: -1 | 1) => {
    if (!currentSnapshot) return;
    const index = snapshots.findIndex((snapshot) => snapshot.id === currentSnapshot.id);
    const next = snapshots[index + direction];
    if (next) {
      selectSnapshot(next.id);
    }
  };

  return (
    <div className="space-y-6">
      <SnapshotToolbar
        tree={tree}
        preset={preset}
        snapshots={snapshots}
        selectedSnapshotId={detailSnapshotId}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onSelect={selectSnapshot}
        onPrevious={() => moveSnapshot(-1)}
        onNext={() => moveSnapshot(1)}
        onManageTree={() => setTreeManagerOpen(true)}
        onCreateSnapshot={openCreateSnapshotForm}
        createDisabled={!entryNodes.length}
      />

      <SnapshotModule
        preset={preset}
        tree={tree}
        entryNodes={entryNodes}
        treeNodes={treeNodes}
        rateSnapshots={rateSnapshots}
        requiredRateCurrencies={requiredRateCurrencies}
        snapshots={snapshots}
        currentSnapshot={currentSnapshot}
        currentPosition={currentPosition}
        snapshotDetail={selectedSnapshotQuery.data ?? null}
        snapshotDetailLoading={selectedSnapshotQuery.isLoading || selectedSnapshotQuery.isFetching}
        snapshotFormVisible={snapshotFormVisible}
        snapshotFormMode={snapshotFormMode}
        snapshotSubmitting={createSnapshotMutation.isPending}
        snapshotUpdating={updateSnapshotMutation.isPending}
        snapshotDeleting={deleteSnapshotMutation.isPending}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={() => moveSnapshot(-1)}
        onNext={() => moveSnapshot(1)}
        onOpenSnapshotForm={openCreateSnapshotForm}
        onEditSnapshot={openEditSnapshotForm}
        onDeleteSnapshot={setPendingDeleteSnapshot}
        onCloseSnapshotForm={closeSnapshotForm}
        onCreateSnapshot={(payload) => createSnapshotMutation.mutate(payload)}
        onUpdateSnapshot={(snapshotId, payload) =>
          updateSnapshotMutation.mutate({ snapshotId, payload })
        }
      />

      <FinanceTreeManagerModal
        isOpen={treeManagerOpen}
        onClose={() => setTreeManagerOpen(false)}
        tree={tree}
        preset={preset}
        treeNodes={treeNodes}
        deletingNodeId={
          deleteNodeMutation.variables && deleteNodeMutation.isPending
            ? deleteNodeMutation.variables
            : null
        }
        onCreateRootNode={() => setNodeFormState({ mode: "create", parentId: null })}
        onCreateChildNode={(node) => setNodeFormState({ mode: "create", parentId: node.id })}
        onEditNode={(node) => setNodeFormState({ mode: "edit", node })}
        onDeleteNode={setPendingDeleteNode}
      />

      <FinanceNodeFormModal
        isOpen={Boolean(nodeFormState)}
        onClose={() => {
          if (!createNodeMutation.isPending && !updateNodeMutation.isPending) {
            setNodeFormState(null);
          }
        }}
        tree={tree}
        flatNodes={flatNodes}
        assets={assets}
        formState={nodeFormState}
        submitting={createNodeMutation.isPending || updateNodeMutation.isPending}
        onCreateAsset={createAsset}
        onCreateNode={(payload) => createNodeMutation.mutate(payload, {
          onSuccess: () => setNodeFormState(null),
        })}
        onUpdateNode={(nodeId, payload) => updateNodeMutation.mutate({ nodeId, payload })}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteNode)}
        title={t("finance.tree.deleteTitle")}
        message={t("finance.tree.deleteMessage", {
          name: pendingDeleteNode?.name ?? "",
        })}
        confirmText={t("finance.tree.deleteConfirm")}
        onCancel={() => setPendingDeleteNode(null)}
        onConfirm={() => {
          if (pendingDeleteNode) {
            deleteNodeMutation.mutate(pendingDeleteNode.id);
          }
        }}
        loading={deleteNodeMutation.isPending}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteSnapshot)}
        title={t("finance.snapshot.deleteTitle")}
        message={t("finance.snapshot.deleteMessage", {
          name: pendingDeleteSnapshot ? snapshotLabel(pendingDeleteSnapshot) : "",
        })}
        confirmText={t("finance.snapshot.deleteConfirm")}
        onCancel={() => setPendingDeleteSnapshot(null)}
        onConfirm={() => {
          if (pendingDeleteSnapshot) {
            deleteSnapshotMutation.mutate(pendingDeleteSnapshot.id);
          }
        }}
        loading={deleteSnapshotMutation.isPending}
      />
    </div>
  );
}

function RateSnapshotsWorkspace() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { assets, createAsset } = useFinanceAssetSource();
  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [editingAssetId, setEditingAssetId] = useState<UUID | null>(null);
  const [editingAssetCode, setEditingAssetCode] = useState("");
  const [editingAssetName, setEditingAssetName] = useState("");
  const [capturedAt, setCapturedAt] = useState(nowDateTimeLocal());
  const [source, setSource] = useState("manual");
  const [note, setNote] = useState("");
  const [rateRows, setRateRows] = useState([
    { baseAmount: "1", baseCurrency: "BTC", quoteAmount: "", quoteCurrency: "USDT" },
  ]);

  const rateSnapshotsQuery = useQuery({
    queryKey: financeKeys.rateSnapshots(),
    queryFn: () => financeApi.listRateSnapshots(),
  });

  const createRateSnapshotMutation = useMutation({
    mutationFn: (payload: FinanceRateSnapshotCreate) => financeApi.createRateSnapshot(payload),
    onSuccess: async (rateSnapshot) => {
      toast.showSuccess(t("finance.messages.rateSnapshotCreated"));
      setRateRows([
        { baseAmount: "1", baseCurrency: "BTC", quoteAmount: "", quoteCurrency: "USDT" },
      ]);
      setNote("");
      setFinanceRateSnapshotCache(queryClient, rateSnapshot);
      addFinanceRateSnapshotToListCache(queryClient, rateSnapshot);
      await invalidateFinanceRateSnapshots(queryClient);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const updateAssetMutation = useMutation({
    mutationFn: ({
      assetId,
      code,
      name,
    }: {
      assetId: UUID;
      code: string;
      name: string | null;
    }) => financeApi.updateAsset(assetId, { code, name }),
    onSuccess: async () => {
      toast.showSuccess(t("finance.messages.assetUpdated"));
      setEditingAssetId(null);
      await invalidateFinanceAssets(queryClient);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetId: UUID) => financeApi.deleteAsset(assetId),
    onSuccess: async () => {
      toast.showSuccess(t("finance.messages.assetDeleted"));
      await invalidateFinanceAssets(queryClient);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const submitAsset = (event: React.FormEvent) => {
    event.preventDefault();
    const code = assetCode.trim().toUpperCase();
    if (!code) return;
    createAsset(code)
      .then(async (asset) => {
        if (assetName.trim()) {
          await financeApi.updateAsset(asset.id, { name: assetName.trim() });
          await invalidateFinanceAssets(queryClient);
        }
        toast.showSuccess(t("finance.messages.assetCreated"));
        setAssetCode("");
        setAssetName("");
      })
      .catch(() => undefined);
  };

  const submitRateSnapshot = (event: React.FormEvent) => {
    event.preventDefault();
    const entries = rateRows
      .map((row) => {
        const baseAmount = Number(row.baseAmount);
        const quoteAmount = Number(row.quoteAmount);
        const baseCurrency = row.baseCurrency.trim().toUpperCase();
        const quoteCurrency = row.quoteCurrency.trim().toUpperCase();
        return {
          base_currency: baseCurrency,
          quote_currency: quoteCurrency,
          rate:
            Number.isFinite(baseAmount) && baseAmount > 0 && Number.isFinite(quoteAmount)
              ? String(quoteAmount / baseAmount)
              : "",
          source: source.trim() || "manual",
        };
      })
      .filter((entry) => entry.base_currency || entry.quote_currency || entry.rate);
    if (!entries.length) {
      toast.showWarning(t("finance.messages.rateSnapshotRatesRequired"));
      return;
    }
    if (
      entries.some((entry) => {
        const numericRate = Number(entry.rate);
        return (
          !entry.base_currency ||
          !entry.quote_currency ||
          entry.base_currency === entry.quote_currency ||
          !Number.isFinite(numericRate) ||
          numericRate <= 0
        );
      })
    ) {
      toast.showWarning(t("finance.messages.rateSnapshotRatesRequired"));
      return;
    }
    createRateSnapshotMutation.mutate({
      captured_at: localDateTimeToIso(capturedAt),
      source: source.trim() || "manual",
      note: note.trim() || null,
      entries,
    });
  };

  const snapshots = rateSnapshotsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="font-semibold text-base-content">{t("finance.assets.title")}</h3>
          <p className="text-sm text-base-content/60">{t("finance.assets.description")}</p>
        </div>
        <form className="grid grid-cols-1 gap-2 sm:grid-cols-[8rem_minmax(0,1fr)_auto]" onSubmit={submitAsset}>
          <TextInput
            size="sm"
            value={assetCode}
            onChange={(event) => setAssetCode(event.target.value.toUpperCase())}
            placeholder={t("finance.assets.code")}
          />
          <TextInput
            size="sm"
            value={assetName}
            onChange={(event) => setAssetName(event.target.value)}
            placeholder={t("finance.assets.name")}
          />
          <ActionButton
            type="submit"
            label={t("finance.assets.addAsset")}
            iconName="plus"
            size="sm"
            color="primary"
            variant="outline"
            disabled={!assetCode.trim()}
          />
        </form>
        <div className="mt-3 overflow-x-auto">
          <table className="table table-sm">
            <thead className="bg-base-200/60 text-xs uppercase text-base-content/60">
              <tr>
                <th>{t("finance.assets.code")}</th>
                <th>{t("finance.assets.name")}</th>
                <th className="w-24 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const editing = editingAssetId === asset.id;
                return (
                  <tr key={asset.id}>
                    <td>
                      {editing ? (
                        <TextInput
                          size="sm"
                          value={editingAssetCode}
                          onChange={(event) =>
                            setEditingAssetCode(event.target.value.toUpperCase())
                          }
                        />
                      ) : (
                        <span className="font-medium">{asset.code}</span>
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <TextInput
                          size="sm"
                          value={editingAssetName}
                          onChange={(event) => setEditingAssetName(event.target.value)}
                        />
                      ) : (
                        asset.name || "-"
                      )}
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {editing ? (
                          <>
                            <ActionButton
                              label=""
                              iconName="check"
                              iconOnly
                              size="xs"
                              variant="ghost"
                              ariaLabel={t("common.save")}
                              disabled={updateAssetMutation.isPending}
                              onClick={() =>
                                updateAssetMutation.mutate({
                                  assetId: asset.id,
                                  code: editingAssetCode,
                                  name: editingAssetName.trim() || null,
                                })
                              }
                            />
                            <ActionButton
                              label=""
                              iconName="x-mark"
                              iconOnly
                              size="xs"
                              variant="ghost"
                              ariaLabel={t("common.cancel")}
                              onClick={() => setEditingAssetId(null)}
                            />
                          </>
                        ) : (
                          <>
                            <ActionButton
                              label=""
                              iconName="edit"
                              iconOnly
                              size="xs"
                              variant="ghost"
                              ariaLabel={t("common.edit")}
                              onClick={() => {
                                setEditingAssetId(asset.id);
                                setEditingAssetCode(asset.code);
                                setEditingAssetName(asset.name ?? "");
                              }}
                            />
                            <ActionButton
                              label=""
                              iconName="trash"
                              iconOnly
                              size="xs"
                              variant="ghost"
                              color="error"
                              ariaLabel={t("common.delete")}
                              disabled={deleteAssetMutation.isPending}
                              onClick={() => deleteAssetMutation.mutate(asset.id)}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-base-content">{t("finance.rates.title")}</h3>
            <p className="text-sm text-base-content/60">{t("finance.rates.tabDescription")}</p>
          </div>
        </div>

        <form className="mt-4 space-y-4" onSubmit={submitRateSnapshot}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label={t("finance.rates.capturedAt")}>
              <TextInput
                type="datetime-local"
                value={capturedAt}
                onChange={(event) => setCapturedAt(event.target.value)}
              />
            </FormField>
            <FormField label={t("finance.rates.source")}>
              <TextInput value={source} onChange={(event) => setSource(event.target.value)} />
            </FormField>
            <FormField label={t("finance.rates.note")}>
              <TextInput value={note} onChange={(event) => setNote(event.target.value)} />
            </FormField>
          </div>

          <div className="rounded-lg border border-base-200">
            <div className="grid grid-cols-[minmax(5rem,0.7fr)_minmax(7rem,1fr)_auto_minmax(5rem,0.7fr)_minmax(7rem,1fr)_auto] gap-2 border-b border-base-200 bg-base-200/40 px-3 py-2 text-xs uppercase text-base-content/60">
              <span>{t("finance.rates.baseAmount")}</span>
              <span>{t("finance.rates.baseAsset")}</span>
              <span />
              <span>{t("finance.rates.quoteAmount")}</span>
              <span>{t("finance.rates.quoteAsset")}</span>
              <span />
            </div>
            <div className="space-y-2 p-3">
              {rateRows.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[minmax(5rem,0.7fr)_minmax(7rem,1fr)_auto_minmax(5rem,0.7fr)_minmax(7rem,1fr)_auto] items-center gap-2"
                >
                  <TextInput
                    size="sm"
                    inputMode="decimal"
                    value={row.baseAmount}
                    onChange={(event) =>
                      setRateRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, baseAmount: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                  <AssetSelect
                    assets={assets}
                    value={row.baseCurrency}
                    onChange={(assetCode) =>
                      setRateRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, baseCurrency: assetCode } : item,
                        ),
                      )
                    }
                    onCreateAsset={createAsset}
                    disabled={createRateSnapshotMutation.isPending}
                  />
                  <span className="text-center text-base-content/60">=</span>
                  <TextInput
                    size="sm"
                    inputMode="decimal"
                    value={row.quoteAmount}
                    onChange={(event) =>
                      setRateRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, quoteAmount: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <AssetSelect
                    assets={assets}
                    value={row.quoteCurrency}
                    onChange={(assetCode) =>
                      setRateRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, quoteCurrency: assetCode } : item,
                        ),
                      )
                    }
                    onCreateAsset={createAsset}
                    disabled={createRateSnapshotMutation.isPending}
                  />
                  <ActionButton
                    type="button"
                    label=""
                    iconName="trash"
                    iconOnly
                    size="sm"
                    variant="ghost"
                    color="error"
                    ariaLabel={t("common.delete")}
                    disabled={rateRows.length === 1}
                    onClick={() =>
                      setRateRows((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  />
                </div>
              ))}
              <ActionButton
                type="button"
                label={t("finance.rates.addRate")}
                iconName="plus"
                size="sm"
                variant="ghost"
                onClick={() =>
                  setRateRows((current) =>
                    current.concat({
                      baseAmount: "1",
                      baseCurrency: "",
                      quoteAmount: "",
                      quoteCurrency: "",
                    }),
                  )
                }
              />
            </div>
          </div>

          <div className="flex justify-end">
            <ActionButton
              type="submit"
              label={
                createRateSnapshotMutation.isPending
                  ? t("common.saving")
                  : t("finance.rates.createSnapshot")
              }
              iconName="check"
              color="primary"
              variant="solid"
              disabled={createRateSnapshotMutation.isPending}
            />
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
        {rateSnapshotsQuery.isLoading ? (
          <LoadingSpinner />
        ) : snapshots.length ? (
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead className="bg-base-200/60 text-xs uppercase text-base-content/60">
                <tr>
                  <th>{t("finance.rates.capturedAt")}</th>
                  <th>{t("finance.rates.source")}</th>
                  <th>{t("finance.rates.rates")}</th>
                  <th>{t("finance.rates.note")}</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{formatDateTime(snapshot.captured_at)}</td>
                    <td>{snapshot.source}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(snapshot.entries ?? []).map((entry) => (
                          <Badge key={entry.id} tone="neutral" variant="outline" size="xs">
                            {entry.base_currency}/{entry.quote_currency} {entry.rate}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td>{snapshot.note || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-base-300 p-6 text-center text-sm text-base-content/60">
            {t("finance.rates.empty")}
          </div>
        )}
      </section>
    </div>
  );
}

function SnapshotToolbar({
  tree,
  preset,
  snapshots,
  selectedSnapshotId,
  hasPrevious,
  hasNext,
  onSelect,
  onPrevious,
  onNext,
  onManageTree,
  onCreateSnapshot,
  createDisabled,
}: {
  tree: FinanceTree;
  preset: PresetConfig;
  snapshots: FinanceSnapshot[];
  selectedSnapshotId: UUID | null;
  hasPrevious: boolean;
  hasNext: boolean;
  onSelect: (snapshotId: UUID) => void;
  onPrevious: () => void;
  onNext: () => void;
  onManageTree: () => void;
  onCreateSnapshot: () => void;
  createDisabled: boolean;
}) {
  const { t } = useTranslation();
  const options = snapshots.map((snapshot) => ({
    value: snapshot.id,
    label: snapshotLabel(snapshot),
  }));

  return (
    <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="primary" variant="outline" size="sm">
            {tree.name}
          </Badge>
          <Badge tone="neutral" variant="outline" size="sm">
            {tree.primary_currency}
          </Badge>
          <ActionButton
            label={t("finance.tree.manage")}
            onClick={onManageTree}
            size="sm"
            variant="outline"
            iconName="settings"
          />
        </div>

        <div className="flex flex-1 items-center justify-center gap-1 sm:gap-2 min-w-0 whitespace-nowrap">
          <ActionButton
            label=""
            iconName="chevron-left"
            iconOnly
            ariaLabel={t("finance.snapshot.previous")}
            size="sm"
            variant="ghost"
            shape="circle"
            onClick={onPrevious}
            disabled={!snapshots.length || !hasPrevious}
          />

          <EnumSelect
            value={selectedSnapshotId ?? undefined}
            onChange={(value) => {
              if (value) onSelect(String(value) as UUID);
            }}
            options={options}
            placeholder={t("finance.snapshot.selectSnapshot")}
            showLabel={false}
            size="sm"
            className="w-auto min-w-[12rem] sm:min-w-[16rem] max-w-full"
            autoWidth
            disabled={!options.length}
          />

          <ActionButton
            label=""
            iconName="chevron-right"
            iconOnly
            ariaLabel={t("finance.snapshot.next")}
            size="sm"
            variant="ghost"
            shape="circle"
            onClick={onNext}
            disabled={!snapshots.length || !hasNext}
          />
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <CreateNewButton
            label={t("finance.snapshot.new")}
            onClick={onCreateSnapshot}
            size="sm"
            color="primary"
            variant="solid"
            disabled={createDisabled}
            ariaLabel={t("finance.snapshot.new")}
          />
        </div>
      </div>

      <p className="mt-3 text-sm text-base-content/70">{t(preset.descriptionKey)}</p>
    </section>
  );
}

function SnapshotModule({
  preset,
  tree,
  entryNodes,
  treeNodes,
  rateSnapshots,
  requiredRateCurrencies,
  snapshots,
  currentSnapshot,
  currentPosition,
  snapshotDetail,
  snapshotDetailLoading,
  snapshotFormVisible,
  snapshotFormMode,
  snapshotSubmitting,
  snapshotUpdating,
  snapshotDeleting,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onOpenSnapshotForm,
  onEditSnapshot,
  onDeleteSnapshot,
  onCloseSnapshotForm,
  onCreateSnapshot,
  onUpdateSnapshot,
}: {
  preset: PresetConfig;
  tree: FinanceTree;
  entryNodes: TreeNodeWithChildren[];
  treeNodes: TreeNodeWithChildren[];
  rateSnapshots: FinanceRateSnapshot[];
  requiredRateCurrencies: string[];
  snapshots: FinanceSnapshot[];
  currentSnapshot: FinanceSnapshot | null;
  currentPosition: number;
  snapshotDetail: FinanceSnapshot | null;
  snapshotDetailLoading: boolean;
  snapshotFormVisible: boolean;
  snapshotFormMode: "create" | "edit";
  snapshotSubmitting: boolean;
  snapshotUpdating: boolean;
  snapshotDeleting: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onOpenSnapshotForm: () => void;
  onEditSnapshot: () => void;
  onDeleteSnapshot: (snapshot: FinanceSnapshot) => void;
  onCloseSnapshotForm: () => void;
  onCreateSnapshot: (payload: {
    snapshot_ts?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    primary_currency?: string | null;
    rate_snapshot_id?: UUID | null;
    note?: string | null;
    entries: FinanceSnapshotEntryCreate[];
  }) => void;
  onUpdateSnapshot: (
    snapshotId: UUID,
    payload: {
      snapshot_ts?: string | null;
      period_start?: string | null;
      period_end?: string | null;
      primary_currency?: string | null;
      rate_snapshot_id?: UUID | null;
      note?: string | null;
      entries: FinanceSnapshotEntryCreate[];
    },
  ) => void;
}) {
  const { t } = useTranslation();
  const hasSnapshots = snapshots.length > 0;

  if (!hasSnapshots) {
    if (snapshotFormVisible) {
      return (
        <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
          <SnapshotFormPanel
            tree={tree}
            preset={preset}
            treeNodes={treeNodes}
            rateSnapshots={rateSnapshots}
            requiredRateCurrencies={requiredRateCurrencies}
            submitting={snapshotSubmitting}
            mode="create"
            onSubmit={onCreateSnapshot}
            onCancel={onCloseSnapshotForm}
          />
        </section>
      );
    }

    return (
      <div className="rounded-2xl border border-dashed border-base-200 bg-base-100 p-8 text-center text-sm text-base-content/70">
        <p>{t("finance.history.empty")}</p>
        <div className="mt-4 flex justify-center">
          <CreateNewButton
            label={t("finance.snapshot.new")}
            onClick={onOpenSnapshotForm}
            size="sm"
            color="primary"
            variant="solid"
            disabled={!entryNodes.length}
          />
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
      <SnapshotNavigator
        title={currentSnapshot ? snapshotLabel(currentSnapshot) : t("finance.history.noSelection")}
        positionLabel={
          currentPosition > 0
            ? t("finance.snapshot.position", {
                current: currentPosition,
                total: snapshots.length,
              })
            : undefined
        }
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={onPrevious}
        onNext={onNext}
        rightSlot={
          currentSnapshot ? (
            <div className="flex justify-end gap-2">
              <ActionButton
                label=""
                iconName="edit"
                iconOnly
                ariaLabel={t("finance.snapshot.edit")}
                size="sm"
                variant="ghost"
                onClick={onEditSnapshot}
                disabled={snapshotDetailLoading || snapshotDeleting}
              />
              <ActionButton
                label=""
                iconName="trash"
                iconOnly
                ariaLabel={t("finance.snapshot.delete")}
                size="sm"
                variant="ghost"
                color="error"
                onClick={() => onDeleteSnapshot(currentSnapshot)}
                disabled={snapshotDeleting}
              />
            </div>
          ) : null
        }
      />

      <div className="mt-4">
        {snapshotFormVisible ? (
          snapshotFormMode === "edit" && snapshotDetailLoading ? (
            <div className="py-6">
              <LoadingSpinner />
            </div>
          ) : (
            <SnapshotFormPanel
              tree={tree}
              preset={preset}
              treeNodes={treeNodes}
              rateSnapshots={rateSnapshots}
              requiredRateCurrencies={requiredRateCurrencies}
              submitting={
                snapshotFormMode === "edit" ? snapshotUpdating : snapshotSubmitting
              }
              mode={snapshotFormMode}
              initialSnapshot={snapshotFormMode === "edit" ? snapshotDetail : null}
              onSubmit={(payload) => {
                if (snapshotFormMode === "edit" && snapshotDetail) {
                  onUpdateSnapshot(snapshotDetail.id, payload);
                  return;
                }
                onCreateSnapshot(payload);
              }}
              onCancel={onCloseSnapshotForm}
            />
          )
        ) : snapshotDetailLoading ? (
          <div className="py-6">
            <LoadingSpinner />
          </div>
        ) : snapshotDetail ? (
          <SnapshotDetail
            snapshot={snapshotDetail}
            tree={tree}
            treeNodes={treeNodes}
          />
        ) : (
          <p className="py-4 text-sm text-base-content/70">
            {t("finance.history.noSelection")}
          </p>
        )}
      </div>
    </section>
  );
}

function SnapshotNavigator({
  title,
  positionLabel,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  rightSlot,
}: {
  title: string;
  positionLabel?: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  rightSlot?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-grow flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ActionButton
            label=""
            iconName="chevron-left"
            iconOnly
            ariaLabel={t("finance.snapshot.previous")}
            size="sm"
            variant="ghost"
            shape="circle"
            onClick={onPrevious}
            disabled={!hasPrevious}
          />
          <ActionButton
            label=""
            iconName="chevron-right"
            iconOnly
            ariaLabel={t("finance.snapshot.next")}
            size="sm"
            variant="ghost"
            shape="circle"
            onClick={onNext}
            disabled={!hasNext}
          />
        </div>
        <div>
          {positionLabel ? (
            <p className="text-xs uppercase tracking-wide text-base-content/60">
              {positionLabel}
            </p>
          ) : null}
          <p className="text-lg font-semibold text-base-content">{title}</p>
        </div>
      </div>
      {rightSlot ? <div className="text-right text-sm text-base-content/70">{rightSlot}</div> : null}
    </header>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-base-300 rounded-lg bg-base-200/40 px-3 py-2 min-w-0">
      <div className="text-xs uppercase tracking-wide text-base-content/60 truncate">
        {label}
      </div>
      <div className="font-semibold tabular-nums text-base-content truncate">{value}</div>
    </div>
  );
}

function CurrencyAmountList({
  amountsByCurrency,
  fallbackCurrency,
}: {
  amountsByCurrency: Record<string, { net_amount: string }>;
  fallbackCurrency: string;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(amountsByCurrency);
  if (!entries.length) {
    return (
      <Metric
        label={t("finance.metrics.net")}
        value={formatMoney("0", fallbackCurrency)}
      />
    );
  }
  return (
    <div className="sm:col-span-3 rounded-lg border border-base-300 bg-base-200/40 px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-base-content/60">
        {t("finance.metrics.amountsByCurrency")}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {entries.map(([currency, totals]) => (
          <Badge key={currency} tone="neutral" variant="outline" size="sm">
            {formatMoney(totals.net_amount, currency)}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function FinanceTreeManagerModal({
  isOpen,
  onClose,
  tree,
  preset,
  treeNodes,
  deletingNodeId,
  onCreateRootNode,
  onCreateChildNode,
  onEditNode,
  onDeleteNode,
}: {
  isOpen: boolean;
  onClose: () => void;
  tree: FinanceTree;
  preset: PresetConfig;
  treeNodes: TreeNodeWithChildren[];
  deletingNodeId: UUID | null;
  onCreateRootNode: () => void;
  onCreateChildNode: (node: TreeNodeWithChildren) => void;
  onEditNode: (node: TreeNodeWithChildren) => void;
  onDeleteNode: (node: TreeNodeWithChildren) => void;
}) {
  const { t } = useTranslation();
  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={t("finance.tree.manage")}
      size="xl"
      bodyOverflow="auto"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-200 bg-base-200/40 px-4 py-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-base-content truncate">{tree.name}</span>
              <Badge tone="neutral" size="xs" variant="outline">
                {tree.primary_currency}
              </Badge>
              <Badge tone="info" size="xs" variant="outline">
                {tree.time_mode}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-base-content/60">{t(`finance.${preset.purpose}.treeHint`)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-base-content/60">{t("finance.tree.manageHint")}</p>
          <CreateNewButton
            label={t("finance.tree.addNode")}
            onClick={onCreateRootNode}
            size="sm"
            color="primary"
            variant="solid"
            ariaLabel={t("finance.tree.addNode")}
          />
        </div>

        <FinanceTreeView
          treeNodes={treeNodes}
          deletingNodeId={deletingNodeId}
          onCreateChildNode={onCreateChildNode}
          onEditNode={onEditNode}
          onDeleteNode={onDeleteNode}
        />
      </div>
    </ModalBase>
  );
}

function FinanceNodeFormModal({
  isOpen,
  onClose,
  tree,
  flatNodes,
  assets,
  formState,
  submitting,
  onCreateAsset,
  onCreateNode,
  onUpdateNode,
}: {
  isOpen: boolean;
  onClose: () => void;
  tree: FinanceTree;
  flatNodes: TreeNodeWithChildren[];
  assets: FinanceAsset[];
  formState: FinanceNodeFormState | null;
  submitting: boolean;
  onCreateAsset: (code: string) => Promise<FinanceAsset>;
  onCreateNode: (payload: {
    name: string;
    parent_id?: UUID | null;
    currency_code?: string | null;
  }) => void;
  onUpdateNode: (
    nodeId: UUID,
    payload: {
      name?: string;
      currency_code?: string | null;
    },
  ) => void;
}) {
  const { t } = useTranslation();
  const isEditing = formState?.mode === "edit";
  const editingNode = isEditing ? formState.node : null;
  const initialParentId =
    formState?.mode === "create" ? formState.parentId ?? null : editingNode?.parent_id ?? null;
  const initialCurrency =
    editingNode?.currency_code ||
    flatNodes.find((node) => node.id === initialParentId)?.currency_code ||
    tree.primary_currency;
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<UUID | "">("");
  const [currency, setCurrency] = useState(tree.primary_currency);

  useEffect(() => {
    if (!formState) return;
    setName(editingNode?.name ?? "");
    setParentId(initialParentId ?? "");
    setCurrency(initialCurrency);
  }, [editingNode, formState, initialCurrency, initialParentId]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      currency_code: currency || tree.primary_currency,
    };
    if (editingNode) {
      onUpdateNode(editingNode.id, payload);
      return;
    }
    onCreateNode({
      ...payload,
      parent_id: parentId || null,
    });
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t("finance.tree.editNodeTitle") : t("finance.tree.createNodeTitle")}
      size="md"
      bodyOverflow="auto"
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <FormField label={t("finance.tree.nodeNamePlaceholder")}>
          <TextInput
            size="sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("finance.tree.nodeNamePlaceholder")}
          />
        </FormField>
        <label className="form-control">
          <span className="label-text">{t("finance.tree.parent")}</span>
          <select
            className="select select-bordered select-sm"
            value={parentId}
            onChange={(event) => setParentId(event.target.value as UUID | "")}
            disabled={isEditing}
          >
            <option value="">{t("finance.tree.root")}</option>
            {flatNodes
              .filter((node) => node.id !== editingNode?.id)
              .map((node) => (
                <option key={node.id} value={node.id}>
                  {"  ".repeat(node.depth)}
                  {node.name}
                </option>
              ))}
          </select>
        </label>
        <FormField label={t("finance.tree.currency")}>
          <AssetSelect
            assets={assets}
            value={currency}
            onChange={setCurrency}
            onCreateAsset={onCreateAsset}
            disabled={submitting}
          />
        </FormField>
        <div className="flex justify-end gap-2 pt-2">
          <ActionButton
            type="button"
            label={t("common.cancel")}
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          />
          <ActionButton
            type="submit"
            label={
              submitting
                ? t("common.saving")
                : isEditing
                  ? t("common.save")
                  : t("finance.tree.createNode")
            }
            color="primary"
            variant="solid"
            iconName={isEditing ? "check" : "plus"}
            disabled={submitting || !name.trim()}
          />
        </div>
      </form>
    </ModalBase>
  );
}

function FinanceTreeView({
  treeNodes,
  deletingNodeId,
  onCreateChildNode,
  onEditNode,
  onDeleteNode,
}: {
  treeNodes: TreeNodeWithChildren[];
  deletingNodeId: UUID | null;
  onCreateChildNode: (node: TreeNodeWithChildren) => void;
  onEditNode: (node: TreeNodeWithChildren) => void;
  onDeleteNode: (node: TreeNodeWithChildren) => void;
}) {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<UUID>>(new Set());

  useEffect(() => {
    setExpandedIds(new Set(flattenTree(treeNodes).map((node) => node.id)));
  }, [treeNodes]);

  const toggleNode = (nodeId: UUID) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (!treeNodes.length) {
    return (
      <div className="rounded-lg border border-dashed border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/60">
        {t("finance.tree.empty")}
      </div>
    );
  }

  return (
    <div className="max-h-[520px] overflow-y-auto pr-1">
      <ul className="space-y-2">
        {treeNodes.map((node) => (
          <TreeNodeRow
            key={node.id}
            node={node}
            expandedIds={expandedIds}
            deletingNodeId={deletingNodeId}
            onToggleNode={toggleNode}
            onCreateChildNode={onCreateChildNode}
            onEditNode={onEditNode}
            onDeleteNode={onDeleteNode}
          />
        ))}
      </ul>
    </div>
  );
}

function TreeNodeRow({
  node,
  expandedIds,
  deletingNodeId,
  onToggleNode,
  onCreateChildNode,
  onEditNode,
  onDeleteNode,
}: {
  node: TreeNodeWithChildren;
  expandedIds: Set<UUID>;
  deletingNodeId: UUID | null;
  onToggleNode: (nodeId: UUID) => void;
  onCreateChildNode: (node: TreeNodeWithChildren) => void;
  onEditNode: (node: TreeNodeWithChildren) => void;
  onDeleteNode: (node: TreeNodeWithChildren) => void;
}) {
  const { t } = useTranslation();
  const deleting = deletingNodeId === node.id;
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  return (
    <li>
      <div className="flex items-center gap-2 rounded-md border border-base-300 bg-base-100 px-2 py-2 hover:border-base-300/80">
        <ActionButton
          label=""
          ariaLabel={isExpanded ? t("common.collapse") : t("common.expand")}
          iconName={isExpanded ? "chevron-down" : "chevron-right"}
          iconOnly
          shape="square"
          size="xs"
          variant="ghost"
          disabled={!hasChildren}
          onClick={() => onToggleNode(node.id)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{node.name}</span>
          </div>
          <div className="text-xs text-base-content/60 truncate">{node.currency_code || "-"}</div>
        </div>
        <ActionButton
          label=""
          ariaLabel={t("finance.tree.createChild")}
          iconName="plus"
          iconOnly
          shape="square"
          size="xs"
          variant="ghost"
          onClick={() => onCreateChildNode(node)}
        />
        <ActionButton
          label=""
          ariaLabel={t("finance.tree.editNode")}
          iconName="edit"
          iconOnly
          shape="square"
          size="xs"
          variant="ghost"
          onClick={() => onEditNode(node)}
        />
        <ActionButton
          label={deleting ? "..." : ""}
          ariaLabel={t("finance.tree.deleteConfirm")}
          iconName="trash"
          iconOnly
          shape="square"
          size="xs"
          variant="ghost"
          color="error"
          disabled={deleting}
          onClick={() => onDeleteNode(node)}
        />
      </div>
      {hasChildren && isExpanded ? (
        <ul className="ml-4 mt-2 space-y-2 border-l border-base-300 pl-3">
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              expandedIds={expandedIds}
              deletingNodeId={deletingNodeId}
              onToggleNode={onToggleNode}
              onCreateChildNode={onCreateChildNode}
              onEditNode={onEditNode}
              onDeleteNode={onDeleteNode}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SnapshotFormPanel({
  tree,
  preset,
  treeNodes,
  rateSnapshots,
  requiredRateCurrencies,
  submitting,
  mode,
  initialSnapshot,
  onSubmit,
  onCancel,
}: {
  tree: FinanceTree;
  preset: PresetConfig;
  treeNodes: TreeNodeWithChildren[];
  rateSnapshots: FinanceRateSnapshot[];
  requiredRateCurrencies: string[];
  submitting: boolean;
  mode: "create" | "edit";
  initialSnapshot?: FinanceSnapshot | null;
  onSubmit: (payload: {
    snapshot_ts?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    primary_currency?: string | null;
    rate_snapshot_id?: UUID | null;
    note?: string | null;
    entries: FinanceSnapshotEntryCreate[];
  }) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [snapshotTs, setSnapshotTs] = useState(nowDateTimeLocal());
  const [periodStart, setPeriodStart] = useState(todayDate().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(todayDate());
  const [amounts, setAmounts] = useState<SnapshotAmountState>({});
  const [notes, setNotes] = useState<SnapshotNoteState>({});
  const [snapshotNote, setSnapshotNote] = useState("");
  const [selectedRateSnapshotId, setSelectedRateSnapshotId] = useState<UUID | "">("");
  const leafNodes = useMemo(
    () => flattenTree(treeNodes).filter((node) => node.children.length === 0),
    [treeNodes],
  );
  const selectedRateSnapshot = useMemo(
    () => rateSnapshots.find((snapshot) => snapshot.id === selectedRateSnapshotId) ?? null,
    [rateSnapshots, selectedRateSnapshotId],
  );
  const conversionRates = useMemo(
    () => buildConversionRateMap(selectedRateSnapshot, tree.primary_currency),
    [selectedRateSnapshot, tree.primary_currency],
  );
  const aggregatedAmounts = useMemo(
    () =>
      buildAggregatedSnapshotAmounts(
        treeNodes,
        amounts,
        tree.primary_currency,
        conversionRates,
      ),
    [amounts, conversionRates, tree.primary_currency, treeNodes],
  );
  const nativeAggregatedAmounts = useMemo(
    () => buildNativeSnapshotAmounts(treeNodes, amounts, tree.primary_currency),
    [amounts, tree.primary_currency, treeNodes],
  );
  const missingRateCurrencies = requiredRateCurrencies.filter(
    (currency) => !conversionRates[currency],
  );

  useEffect(() => {
    if (mode !== "edit" || !initialSnapshot) {
      setSnapshotTs(nowDateTimeLocal());
      setPeriodStart(todayDate().slice(0, 8) + "01");
      setPeriodEnd(todayDate());
      setAmounts({});
      setNotes({});
      setSnapshotNote("");
      setSelectedRateSnapshotId("");
      return;
    }

    setSnapshotTs(isoToDateTimeLocal(initialSnapshot.snapshot_ts));
    setPeriodStart(isoToDateInput(initialSnapshot.period_start));
    setPeriodEnd(isoToDateInput(initialSnapshot.period_end));
    setSnapshotNote(initialSnapshot.note ?? "");
    setSelectedRateSnapshotId(initialSnapshot.rate_snapshot_id ?? "");
    const nextAmounts: SnapshotAmountState = {};
    const nextNotes: SnapshotNoteState = {};
    (initialSnapshot.entries ?? [])
      .filter((entry) => !entry.is_auto_generated)
      .forEach((entry) => {
        nextAmounts[entry.node_id] = entry.amount;
        nextNotes[entry.node_id] = entry.note ?? "";
      });
    setAmounts(nextAmounts);
    setNotes(nextNotes);
  }, [initialSnapshot, mode]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const entries = leafNodes.reduce<FinanceSnapshotEntryCreate[]>((acc, node) => {
      const amount = amounts[node.id]?.trim();
      if (!amount) {
        return acc;
      }
      acc.push({
        node_id: node.id,
        amount,
        currency_code: node.currency_code || tree.primary_currency,
        note: notes[node.id]?.trim() || null,
      });
      return acc;
    }, []);

    if (!entries.length) {
      toast.showWarning(t("finance.messages.noEntries"));
      return;
    }
    if (selectedRateSnapshotId && missingRateCurrencies.length) {
      toast.showWarning(
        t("finance.messages.rateSnapshotMissingRates", {
          currencies: missingRateCurrencies.join(", "),
        }),
      );
      return;
    }

    onSubmit({
      snapshot_ts: preset.timeMode === "instant" ? localDateTimeToIso(snapshotTs) : null,
      period_start: preset.timeMode === "period" ? dateToStartIso(periodStart) : null,
      period_end: preset.timeMode === "period" ? dateToEndIso(periodEnd) : null,
      primary_currency: tree.primary_currency,
      rate_snapshot_id: selectedRateSnapshotId || null,
      note: snapshotNote || null,
      entries,
    });
    if (mode === "create") {
      setAmounts({});
      setNotes({});
      setSnapshotNote("");
      setSelectedRateSnapshotId("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base-content">
            {mode === "edit" ? t("finance.snapshot.editTitle") : t("finance.snapshot.formTitle")}
          </h3>
          <p className="text-sm text-base-content/60">{t(preset.amountLabelKey)}</p>
        </div>
        <ActionButton
          label={t("common.cancel")}
          onClick={onCancel}
          size="sm"
          variant="ghost"
          disabled={submitting}
        />
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {preset.timeMode === "instant" ? (
          <FormField label={t("finance.snapshot.snapshotTime")}>
            <TextInput
              type="datetime-local"
              value={snapshotTs}
              onChange={(event) => setSnapshotTs(event.target.value)}
            />
          </FormField>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label={t("finance.snapshot.periodStart")}>
              <TextInput
                type="date"
                value={periodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
              />
            </FormField>
            <FormField label={t("finance.snapshot.periodEnd")}>
              <TextInput
                type="date"
                value={periodEnd}
                onChange={(event) => setPeriodEnd(event.target.value)}
              />
            </FormField>
          </div>
        )}

        <RateSnapshotSelectPanel
          primaryCurrency={tree.primary_currency}
          requiredCurrencies={requiredRateCurrencies}
          rateSnapshots={rateSnapshots}
          selectedRateSnapshotId={selectedRateSnapshotId}
          onSelectRateSnapshot={setSelectedRateSnapshotId}
        />

        <SnapshotEntryTreeTable
          treeNodes={treeNodes}
          amounts={amounts}
          notes={notes}
          aggregatedAmounts={aggregatedAmounts}
          nativeAggregatedAmounts={nativeAggregatedAmounts}
          primaryCurrency={tree.primary_currency}
          conversionRates={conversionRates}
          hasRateSnapshot={Boolean(selectedRateSnapshotId)}
          submitting={submitting}
          onChangeAmount={(nodeId, value) =>
            setAmounts((prev) => ({ ...prev, [nodeId]: value }))
          }
          onChangeNote={(nodeId, value) =>
            setNotes((prev) => ({ ...prev, [nodeId]: value }))
          }
        />

        <FormField label={t("finance.snapshot.snapshotNote")}>
          <TextArea
            value={snapshotNote}
            onChange={(event) => setSnapshotNote(event.target.value)}
            resize="y"
          />
        </FormField>

        <div className="flex justify-end">
          <ActionButton
            type="submit"
            label={submitting ? t("common.saving") : t("finance.snapshot.save")}
            color="primary"
            variant="solid"
            iconName="check"
            disabled={
              submitting ||
              !leafNodes.length ||
              (Boolean(selectedRateSnapshotId) && missingRateCurrencies.length > 0)
            }
          />
        </div>
      </form>
    </div>
  );
}

function RateSnapshotSelectPanel({
  primaryCurrency,
  requiredCurrencies,
  rateSnapshots,
  selectedRateSnapshotId,
  onSelectRateSnapshot,
}: {
  primaryCurrency: string;
  requiredCurrencies: string[];
  rateSnapshots: FinanceRateSnapshot[];
  selectedRateSnapshotId: UUID | "";
  onSelectRateSnapshot: (rateSnapshotId: UUID | "") => void;
}) {
  const { t } = useTranslation();
  const options = [
    { value: "", label: t("finance.rates.noRateSnapshot") },
    ...rateSnapshots.map((snapshot) => ({
      value: snapshot.id,
      label: rateSnapshotLabel(snapshot),
    })),
  ];

  return (
    <div className="rounded-lg border border-base-200 bg-base-200/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-base-content">{t("finance.rates.title")}</h4>
          <p className="text-sm text-base-content/60">
            {requiredCurrencies.length
              ? t("finance.rates.required", {
                  currencies: requiredCurrencies.join(", "),
                  primaryCurrency,
                })
              : t("finance.rates.optional")}
          </p>
        </div>
        <EnumSelect
          value={selectedRateSnapshotId || undefined}
          onChange={(value) => onSelectRateSnapshot((value as UUID | undefined) ?? "")}
          options={options}
          placeholder={t("finance.rates.selectSnapshot")}
          showLabel={false}
          includeEmptyOption
          size="sm"
          className="min-w-[14rem]"
        />
      </div>
    </div>
  );
}

function SnapshotEntryTreeTable({
  treeNodes,
  amounts,
  notes,
  aggregatedAmounts,
  nativeAggregatedAmounts,
  primaryCurrency,
  conversionRates,
  hasRateSnapshot,
  submitting,
  onChangeAmount,
  onChangeNote,
}: {
  treeNodes: TreeNodeWithChildren[];
  amounts: SnapshotAmountState;
  notes: SnapshotNoteState;
  aggregatedAmounts: Record<UUID, string>;
  nativeAggregatedAmounts: Record<UUID, string>;
  primaryCurrency: string;
  conversionRates: Record<string, number>;
  hasRateSnapshot: boolean;
  submitting: boolean;
  onChangeAmount: (nodeId: UUID, value: string) => void;
  onChangeNote: (nodeId: UUID, value: string) => void;
}) {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<UUID>>(new Set());

  useEffect(() => {
    const initial = new Set<UUID>();
    includeFinanceNodeIds(treeNodes, initial);
    setExpandedIds(initial);
  }, [treeNodes]);

  const toggleNode = (nodeId: UUID) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const renderRows = (nodes: TreeNodeWithChildren[], depth: number): React.ReactNode[] =>
    nodes.flatMap((node) => {
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedIds.has(node.id);
      const amount = amounts[node.id] ?? "";
      const aggregatedAmount = aggregatedAmounts[node.id] ?? "";
      const convertedAmount = hasRateSnapshot
        ? hasChildren
          ? aggregatedAmount
          : convertSnapshotAmount(
              amount,
              node.currency_code || primaryCurrency,
              primaryCurrency,
              conversionRates,
            )
        : nativeAggregatedAmounts[node.id] ?? "";
      const amountNegative = isNegativeAmount(amount);
      const convertedNegative = isNegativeAmount(convertedAmount);

      const rows: React.ReactNode[] = [
        <tr key={node.id} className="border-base-200">
          <td className="align-top">
            <div
              className="flex items-start gap-3"
              style={{ paddingLeft: `${depth * 1.25}rem` }}
            >
              {hasChildren ? (
                <ActionButton
                  label=""
                  iconName={isExpanded ? "chevron-down" : "chevron-right"}
                  iconOnly
                  size="xs"
                  variant="ghost"
                  shape="circle"
                  className="mt-1 h-6 w-6 p-0"
                  ariaLabel={isExpanded ? t("common.collapse") : t("common.expand")}
                  ariaExpanded={isExpanded}
                  onClick={() => toggleNode(node.id)}
                />
              ) : (
                <span className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center text-base-content/30">
                  •
                </span>
              )}
              <div className="min-w-0 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <p className="truncate font-semibold text-base-content">{node.name}</p>
                <div className="inline-flex flex-wrap items-center gap-1 text-xs text-base-content/70 sm:flex-nowrap">
                  <span className="rounded-full bg-base-200 px-2 py-0.5">
                    {node.currency_code || primaryCurrency}
                  </span>
                </div>
              </div>
            </div>
          </td>
          <td className="align-top text-center">
            <span className="inline-flex min-w-[3rem] justify-center rounded-full bg-base-200 px-2 py-0.5 text-xs font-medium text-base-content/80">
              {(node.currency_code || primaryCurrency).toUpperCase()}
            </span>
          </td>
          <td className="align-top">
            {hasChildren ? (
              <div
                className={[
                  "min-h-[2.25rem] rounded-md border border-dashed border-base-200 px-3 py-2 text-sm",
                  isNegativeAmount(aggregatedAmount) ? "text-error" : "text-base-content/80",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {aggregatedAmount || t("finance.snapshot.autoAggregatedPlaceholder")}
              </div>
            ) : (
              <TextInput
                type="text"
                inputMode="decimal"
                pattern="-?[0-9]*[.,]?[0-9]*"
                size="sm"
                className={amountNegative ? "text-error" : "text-base-content"}
                value={amount}
                onChange={(event) => onChangeAmount(node.id, event.target.value)}
                placeholder={t("finance.snapshot.balancePlaceholder")}
                disabled={submitting}
              />
            )}
          </td>
          <td className="align-top">
            {convertedAmount ? (
              <span
                className={[
                  "inline-flex min-h-[2.25rem] items-center rounded-md border border-dashed border-base-200 px-3 text-sm",
                  convertedNegative ? "text-error" : "text-base-content/80",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {convertedAmount} {primaryCurrency}
              </span>
            ) : (
              <span className="inline-flex min-h-[2.25rem] items-center rounded-md border border-dashed border-base-200 px-3 text-sm text-base-content/40">
                -
              </span>
            )}
          </td>
          <td className="align-top">
            {hasChildren ? (
              <span className="inline-flex min-h-[2.25rem] items-center text-base-content/40">
                -
              </span>
            ) : (
              <TextInput
                type="text"
                size="sm"
                value={notes[node.id] ?? ""}
                onChange={(event) => onChangeNote(node.id, event.target.value)}
                placeholder={t("finance.snapshot.notePlaceholder")}
                disabled={submitting}
              />
            )}
          </td>
        </tr>,
      ];

      if (hasChildren && isExpanded) {
        rows.push(...renderRows(node.children, depth + 1));
      }

      return rows;
    });

  return (
    <div className="rounded-lg border border-base-200">
      <div className="border-b border-base-200 bg-base-200/40 px-4 py-2 text-sm font-semibold text-base-content">
        {t("finance.snapshot.tableTitle")}
      </div>
      {treeNodes.length ? (
        <div className="overflow-x-auto p-3 pb-4">
          <table className="min-w-full text-sm">
            <thead className="bg-base-200/60 text-left text-xs uppercase text-base-content/60">
              <tr>
                <th className="w-[40%] min-w-[12rem] px-4 py-2">
                  {t("finance.snapshot.node")}
                </th>
                <th className="w-20 px-4 py-2 text-center">
                  {t("finance.snapshot.originalCurrency")}
                </th>
                <th className="min-w-[10rem] px-4 py-2">
                  {t("finance.snapshot.originalAmount")}
                </th>
                <th className="min-w-[10rem] px-4 py-2">
                  {t("finance.snapshot.convertedAmount", { currency: primaryCurrency })}
                </th>
                <th className="min-w-[10rem] px-4 py-2">
                  {t("finance.snapshot.note")}
                </th>
              </tr>
            </thead>
            <tbody>{renderRows(treeNodes, 0)}</tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-sm text-base-content/60">
          {t("finance.snapshot.noEntryNodes")}
        </div>
      )}
    </div>
  );
}

function SnapshotDetail({
  snapshot,
  tree,
  treeNodes,
}: {
  snapshot: FinanceSnapshot;
  tree: FinanceTree;
  treeNodes: TreeNodeWithChildren[];
}) {
  const { t } = useTranslation();
  const usesRateSnapshot = Boolean(snapshot.rate_snapshot_id);
  const displayTree = useMemo(
    () => buildSnapshotDisplayTree(treeNodes, snapshot.entries ?? [], usesRateSnapshot),
    [snapshot.entries, treeNodes, usesRateSnapshot],
  );
  const amountsByCurrency = useMemo(
    () => getSummaryAmountsByCurrency(snapshot.summary),
    [snapshot.summary],
  );

  const [expandedIds, setExpandedIds] = useState<Set<UUID>>(new Set());

  useEffect(() => {
    const expandableIds = new Set<UUID>();
    collectExpandableSnapshotNodeIds(displayTree, expandableIds);
    setExpandedIds(expandableIds);
  }, [displayTree]);

  const toggleNode = (nodeId: UUID) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const visibleNodes = useMemo(
    () => flattenVisibleSnapshotNodes(displayTree, expandedIds),
    [displayTree, expandedIds],
  );
  const snapshotNote = snapshot.note?.trim() ?? "";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {usesRateSnapshot ? (
          <>
            <Metric
              label={t("finance.metrics.positive")}
              value={formatMoney(snapshot.total_positive, tree.primary_currency)}
            />
            <Metric
              label={t("finance.metrics.negative")}
              value={formatMoney(snapshot.total_negative, tree.primary_currency)}
            />
            <Metric
              label={t("finance.metrics.net")}
              value={formatMoney(snapshot.net_amount, tree.primary_currency)}
            />
          </>
        ) : (
          <CurrencyAmountList
            amountsByCurrency={amountsByCurrency}
            fallbackCurrency={snapshot.primary_currency}
          />
        )}
      </div>

      <div className="rounded-lg border border-dashed border-base-200 p-3 text-sm text-base-content/70">
        <p className="font-medium text-base-content">{t("finance.snapshot.snapshotNote")}</p>
        <p className="mt-1 whitespace-pre-wrap">{snapshotNote || t("common.none")}</p>
      </div>

      <div className="overflow-x-auto border border-base-300 rounded-lg">
        <table className="table table-sm">
          <thead className="bg-base-200/60 text-xs uppercase text-base-content/60">
            <tr>
              <th className="w-[40%] min-w-[12rem] px-4 py-2">
                {t("finance.snapshot.node")}
              </th>
              <th className="w-20 px-4 py-2 text-center">
                {t("finance.snapshot.originalCurrency")}
              </th>
              <th className="min-w-[10rem] px-4 py-2">
                {t("finance.snapshot.originalAmount")}
              </th>
              <th className="min-w-[10rem] px-4 py-2">
                {t("finance.snapshot.convertedAmount", { currency: snapshot.primary_currency })}
              </th>
              <th className="min-w-[12rem]">{t("finance.snapshot.note")}</th>
            </tr>
          </thead>
          <tbody className="align-top text-sm text-base-content/80">
            {visibleNodes.map((node) => {
              const hasChildren = node.children.length > 0;
              const isExpanded = expandedIds.has(node.id);
              const originalAmount = Number(node.amount);
              const convertedAmount = Number(node.amountConverted);
              const originalAmountClass =
                originalAmount > 0
                  ? "text-success"
                  : originalAmount < 0
                    ? "text-error"
                    : "text-base-content";
              const convertedAmountClass =
                convertedAmount > 0
                  ? "text-success"
                  : convertedAmount < 0
                    ? "text-error"
                    : "text-base-content";

              return (
                <tr key={node.id} className="border-base-200">
                  <td className="align-top">
                    <div
                      className="flex items-start gap-2"
                      style={{ paddingLeft: `${Math.min(node.depth, 6) * 1.5}rem` }}
                    >
                      {hasChildren ? (
                        <ActionButton
                          label=""
                          iconName={isExpanded ? "chevron-down" : "chevron-right"}
                          iconOnly
                          size="xs"
                          variant="ghost"
                          color="neutral"
                          ariaLabel={isExpanded ? t("common.collapse") : t("common.expand")}
                          ariaExpanded={isExpanded}
                          onClick={() => toggleNode(node.id)}
                        />
                      ) : (
                        <span className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center text-base-content/30">
                          •
                        </span>
                      )}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-base-content">{node.name}</span>
                          {node.isAutoGenerated ? (
                            <Badge tone="info" variant="outline" size="xs">
                              {t("finance.snapshot.auto")}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="align-top text-center text-base-content/70">
                    <span className="inline-flex min-w-[3rem] justify-center rounded-full bg-base-200 px-2 py-0.5 text-xs font-medium text-base-content/80">
                      {(node.currencyCode || snapshot.primary_currency).toUpperCase()}
                    </span>
                  </td>
                  <td className="align-top">
                    <span className={`tabular-nums ${originalAmountClass}`}>
                      {node.amount || "-"}
                    </span>
                  </td>
                  <td className="align-top">
                    {usesRateSnapshot ? (
                      <span className={`tabular-nums ${convertedAmountClass}`}>
                        {formatMoney(node.amountConverted, snapshot.primary_currency)}
                      </span>
                    ) : (
                      <span className="text-base-content/40">-</span>
                    )}
                  </td>
                  <td className="align-top">
                    {node.note ? (
                      <span className="block min-h-[2.25rem] text-sm text-base-content/80">
                        {node.note}
                      </span>
                    ) : (
                      <span className="text-base-content/40">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!visibleNodes.length ? (
              <tr>
                <td colSpan={5} className="text-center text-base-content/60 py-6">
                  {t("finance.history.noSelection")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SnapshotEntry = NonNullable<FinanceSnapshot["entries"]>[number];

type SnapshotDisplayNode = {
  id: UUID;
  name: string;
  depth: number;
  amount: string;
  amountConverted: string;
  currencyCode: string;
  note: string | null;
  isAutoGenerated: boolean;
  children: SnapshotDisplayNode[];
};

function buildSnapshotDisplayTree(
  treeNodes: TreeNodeWithChildren[],
  entries: SnapshotEntry[],
  useConvertedRollups: boolean,
): SnapshotDisplayNode[] {
  const entryByNodeId = new Map<UUID, SnapshotEntry>();
  entries.forEach((entry) => {
    entryByNodeId.set(entry.node_id, entry);
  });
  const usedNodeIds = new Set<UUID>();

  const buildNodes = (nodes: TreeNodeWithChildren[], depth: number): SnapshotDisplayNode[] =>
    nodes
      .map((node) => {
        const children = buildNodes(node.children, depth + 1);
        const entry = entryByNodeId.get(node.id);
        if (entry) {
          usedNodeIds.add(node.id);
        }
        if (!entry && !children.length) {
          return null;
        }
        const amountConverted =
          entry?.amount_converted ?? (useConvertedRollups ? sumSnapshotNodeAmounts(children) : "");
        return {
          id: node.id,
          name: node.name,
          depth,
          amount: entry?.amount ?? amountConverted,
          amountConverted,
          currencyCode: entry?.currency_code ?? node.currency_code ?? "",
          note: entry?.note ?? null,
          isAutoGenerated: entry?.is_auto_generated ?? false,
          children,
        } satisfies SnapshotDisplayNode;
      })
      .filter(Boolean) as SnapshotDisplayNode[];

  const roots = buildNodes(treeNodes, 0);
  const orphanEntries = entries
    .filter((entry) => !usedNodeIds.has(entry.node_id))
    .map(
      (entry) =>
        ({
          id: entry.node_id,
          name: entry.node_name ?? entry.node_id,
          depth: 0,
          amount: entry.amount,
          amountConverted: entry.amount_converted,
          currencyCode: entry.currency_code,
          note: entry.note ?? null,
          isAutoGenerated: entry.is_auto_generated,
          children: [],
        }) satisfies SnapshotDisplayNode,
    );
  return roots.concat(orphanEntries);
}

function getSummaryAmountsByCurrency(
  summary?: Record<string, unknown> | null,
): Record<string, { net_amount: string }> {
  const rawAmounts = summary?.amounts_by_currency;
  if (!rawAmounts || typeof rawAmounts !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(rawAmounts as Record<string, Record<string, unknown>>).map(
      ([currency, totals]) => [
        currency,
        {
          net_amount: String(totals.net_amount ?? "0"),
        },
      ],
    ),
  );
}

function includeFinanceNodeIds(nodes: TreeNodeWithChildren[], target: Set<UUID>) {
  nodes.forEach((node) => {
    target.add(node.id);
    if (node.children.length) {
      includeFinanceNodeIds(node.children, target);
    }
  });
}

function buildAggregatedSnapshotAmounts(
  nodes: TreeNodeWithChildren[],
  amounts: SnapshotAmountState,
  primaryCurrency: string,
  conversionRates: Record<string, number>,
): Record<UUID, string> {
  const result: Record<UUID, string> = {};

  const visit = (node: TreeNodeWithChildren): string => {
    if (!node.children.length) {
      const convertedAmount = convertSnapshotAmount(
        amounts[node.id] ?? "",
        node.currency_code || primaryCurrency,
        primaryCurrency,
        conversionRates,
      );
      if (convertedAmount) {
        result[node.id] = convertedAmount;
      }
      return convertedAmount;
    }

    const total = sumAmountStrings(node.children.map(visit));
    if (total) {
      result[node.id] = total;
    }
    return total;
  };

  nodes.forEach(visit);
  return result;
}

function buildNativeSnapshotAmounts(
  nodes: TreeNodeWithChildren[],
  amounts: SnapshotAmountState,
  primaryCurrency: string,
): Record<UUID, string> {
  const result: Record<UUID, string> = {};

  const visit = (node: TreeNodeWithChildren): Map<string, number> => {
    if (!node.children.length) {
      const amount = amounts[node.id]?.trim() ?? "";
      const parsed = Number(amount);
      if (!amount || !Number.isFinite(parsed)) {
        return new Map();
      }
      const currency = (node.currency_code || primaryCurrency).toUpperCase();
      result[node.id] = `${amount} ${currency}`;
      return new Map([[currency, parsed]]);
    }

    const totals = new Map<string, number>();
    node.children.forEach((child) => {
      visit(child).forEach((value, currency) => {
        totals.set(currency, (totals.get(currency) ?? 0) + value);
      });
    });
    if (totals.size) {
      result[node.id] = Array.from(totals.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([currency, value]) => `${value} ${currency}`)
        .join(", ");
    }
    return totals;
  };

  nodes.forEach(visit);
  return result;
}

function getRequiredRateCurrencies(
  nodes: TreeNodeWithChildren[],
  primaryCurrency: string,
): string[] {
  const normalizedPrimary = primaryCurrency.toUpperCase();
  return Array.from(
    new Set(
      nodes
        .map((node) => (node.currency_code || normalizedPrimary).toUpperCase())
        .filter((currency) => currency && currency !== normalizedPrimary),
    ),
  ).sort();
}

function buildConversionRateMap(
  rateSnapshot: FinanceRateSnapshot | null,
  primaryCurrency: string,
): Record<string, number> {
  const normalizedPrimary = primaryCurrency.toUpperCase();
  const result: Record<string, number> = { [normalizedPrimary]: 1 };
  (rateSnapshot?.entries ?? []).forEach((entry) => {
    const baseCurrency = entry.base_currency.toUpperCase();
    const quoteCurrency = entry.quote_currency.toUpperCase();
    const rate = Number(entry.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      return;
    }
    if (quoteCurrency === normalizedPrimary) {
      result[baseCurrency] = rate;
    }
    if (baseCurrency === normalizedPrimary) {
      result[quoteCurrency] = 1 / rate;
    }
  });
  return result;
}

function convertSnapshotAmount(
  amount: string,
  currencyCode: string,
  primaryCurrency: string,
  conversionRates: Record<string, number>,
): string {
  const trimmed = amount.trim();
  if (!trimmed) {
    return "";
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  const currency = currencyCode.toUpperCase();
  const primary = primaryCurrency.toUpperCase();
  const rate = currency === primary ? 1 : conversionRates[currency];
  if (!Number.isFinite(rate)) {
    return "";
  }
  return (parsed * rate).toString();
}

function sumAmountStrings(values: string[]): string {
  let hasValue = false;
  const total = values.reduce((acc, value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return acc;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return acc;
    }
    hasValue = true;
    return acc + parsed;
  }, 0);
  return hasValue ? total.toString() : "";
}

function sumSnapshotNodeAmounts(nodes: SnapshotDisplayNode[]): string {
  return sumAmountStrings(nodes.map((node) => node.amountConverted));
}

function isNegativeAmount(value: string | null | undefined): boolean {
  const numeric = Number(value ?? "");
  return Number.isFinite(numeric) && numeric < 0;
}

function collectExpandableSnapshotNodeIds(
  nodes: SnapshotDisplayNode[],
  target: Set<UUID>,
) {
  nodes.forEach((node) => {
    if (node.children.length) {
      target.add(node.id);
      collectExpandableSnapshotNodeIds(node.children, target);
    }
  });
}

function flattenVisibleSnapshotNodes(
  nodes: SnapshotDisplayNode[],
  expandedIds: Set<UUID>,
): SnapshotDisplayNode[] {
  const result: SnapshotDisplayNode[] = [];
  const walk = (items: SnapshotDisplayNode[]) => {
    items.forEach((node) => {
      result.push(node);
      if (node.children.length && expandedIds.has(node.id)) {
        walk(node.children);
      }
    });
  };
  walk(nodes);
  return result;
}

export default FinancePage;
