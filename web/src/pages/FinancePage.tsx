import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import ActionButton, { CreateNewButton } from "@/components/ActionButton";
import Badge from "@/components/common/Badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import ErrorDisplay from "@/components/ErrorDisplay";
import { FormField, TextInput } from "@/components/forms";
import LoadingSpinner from "@/components/LoadingSpinner";
import AssetSelect from "@/components/selects/AssetSelect";
import ToolbarContainer from "@/components/ToolbarContainer";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { useToast } from "@/contexts/ToastContext";
import ModalBase from "@/layouts/ModalBase";
import PageLayout from "@/layouts/PageLayout";
import {
  financeApi,
  type FinanceAsset,
  type FinanceRateSnapshot,
  type FinanceSnapshot,
  type FinanceSnapshotEntryCreate,
  type FinanceTree,
  type FinanceTreeCreate,
  type FinanceTreeListResponse,
} from "@/services/api/finance";
import {
  invalidateFinanceTree,
  invalidateFinanceSnapshot,
  invalidateFinanceSnapshots,
  invalidateFinanceTreeByPurpose,
  removeFinanceSnapshotCache,
  removeFinanceSnapshotFromListCache,
  setFinanceSnapshotCache,
} from "@/services/api/cacheInvalidation/finance";
import { financeKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";
import { SnapshotDetail, SnapshotFormPanel } from "@/features/finance/SnapshotPanels";
import {
  buildTree,
  flattenTree,
  getRequiredRateCurrencies,
  snapshotLabel,
  type FinanceNodeFormState,
  type FinanceTab,
  type PresetConfig,
  type TreeNodeWithChildren,
} from "@/features/finance/utils";
import { RateSnapshotsWorkspace } from "@/features/finance/RateSnapshotsWorkspace";
import {
  SnapshotActionButtons,
  SnapshotNavigator,
  SnapshotToolbar,
} from "@/features/finance/SnapshotChrome";
import { useFinanceAssetSource } from "@/features/finance/useFinanceAssetSource";

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

function FinancePresetWorkspace({ preset }: { preset: PresetConfig }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { assets, createAsset } = useFinanceAssetSource();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<UUID | null>(null);
  const [snapshotFormVisible, setSnapshotFormVisible] = useState(false);
  const [snapshotFormMode, setSnapshotFormMode] = useState<"create" | "edit">("create");
  const [treeManagerOpen, setTreeManagerOpen] = useState(false);
  const [treeCreateOpen, setTreeCreateOpen] = useState(false);
  const [selectedTreeId, setSelectedTreeId] = useState<UUID | null>(null);
  const [nodeFormState, setNodeFormState] = useState<FinanceNodeFormState | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<TreeNodeWithChildren | null>(null);
  const [pendingDeleteSnapshot, setPendingDeleteSnapshot] = useState<FinanceSnapshot | null>(null);
  const [deletedSnapshotIds, setDeletedSnapshotIds] = useState<Set<UUID>>(() => new Set());

  const treesQuery = useQuery({
    queryKey: financeKeys.treesByPurpose(preset.purpose),
    queryFn: () => financeApi.listTrees({ purpose: preset.purpose }),
    staleTime: 60_000,
  });

  const trees = useMemo(() => treesQuery.data?.items ?? [], [treesQuery.data?.items]);
  const treeQuery = useQuery({
    queryKey: financeKeys.tree(selectedTreeId),
    queryFn: () => financeApi.getTree(selectedTreeId!),
    enabled: Boolean(selectedTreeId),
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

  useEffect(() => {
    if (treesQuery.isLoading) {
      return;
    }
    if (!trees.length) {
      setSelectedTreeId(null);
      setSelectedSnapshotId(null);
      return;
    }
    if (selectedTreeId && trees.some((item) => item.id === selectedTreeId)) {
      return;
    }
    const defaultTree = trees.find((item) => item.is_default) ?? trees[0];
    setSelectedTreeId(defaultTree.id);
    setSelectedSnapshotId(null);
    setSnapshotFormVisible(false);
    setSnapshotFormMode("create");
  }, [selectedTreeId, trees, treesQuery.isLoading]);

  const createTreeMutation = useMutation({
    mutationFn: (payload: FinanceTreeCreate) => financeApi.createTree(payload),
    onSuccess: async (createdTree) => {
      toast.showSuccess(t("finance.messages.treeCreated"));
      setTreeCreateOpen(false);
      queryClient.setQueryData<FinanceTreeListResponse>(
        financeKeys.treesByPurpose(preset.purpose),
        (existing) => {
          if (!existing) return existing;
          const alreadyPresent = existing.items.some((item) => item.id === createdTree.id);
          return {
            ...existing,
            items: [
              createdTree,
              ...existing.items.filter((item) => item.id !== createdTree.id),
            ],
            pagination: {
              ...existing.pagination,
              total: existing.pagination.total + (alreadyPresent ? 0 : 1),
            },
          };
        },
      );
      setSelectedTreeId(createdTree.id);
      setSelectedSnapshotId(null);
      await Promise.all([
        invalidateFinanceTreeByPurpose(queryClient, preset.purpose),
        invalidateFinanceTree(queryClient, createdTree.id),
      ]);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const createNodeMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      parent_id?: UUID | null;
      currency_code?: string | null;
    }) => financeApi.createNode(tree!.id, payload),
    onSuccess: async () => {
      toast.showSuccess(t("finance.messages.nodeCreated"));
      await Promise.all([
        invalidateFinanceTree(queryClient, tree?.id ?? null),
        invalidateFinanceTreeByPurpose(queryClient, preset.purpose),
      ]);
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
      await Promise.all([
        invalidateFinanceTree(queryClient, tree?.id ?? null),
        invalidateFinanceTreeByPurpose(queryClient, preset.purpose),
      ]);
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
      await Promise.all([
        invalidateFinanceTree(queryClient, tree?.id ?? null),
        invalidateFinanceTreeByPurpose(queryClient, preset.purpose),
      ]);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const createSnapshotMutation = useMutation({
    mutationFn: (payload: {
      title?: string | null;
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
        title?: string | null;
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

  if (treesQuery.isLoading || (selectedTreeId && treeQuery.isLoading)) {
    return <LoadingSpinner />;
  }

  if (treesQuery.error || treeQuery.error) {
    const error = treesQuery.error ?? treeQuery.error;
    return (
      <ErrorDisplay
        error={error instanceof Error ? error.message : String(error)}
      />
    );
  }

  if (!tree) {
    return (
      <div className="space-y-6">
        <FinanceTreeSelector
          preset={preset}
          trees={trees}
          selectedTreeId={selectedTreeId}
          onSelectTree={(treeId) => {
            setSelectedTreeId(treeId);
            setSelectedSnapshotId(null);
            setSnapshotFormVisible(false);
            setSnapshotFormMode("create");
          }}
          onCreateTree={() => setTreeCreateOpen(true)}
          onManageTree={() => setTreeManagerOpen(true)}
          manageDisabled
        />
        <div className="rounded-2xl border border-dashed border-base-200 bg-base-100 p-8 text-center text-sm text-base-content/70">
          <p>{t("finance.tree.noTrees")}</p>
          <div className="mt-4 flex justify-center">
            <CreateNewButton
              label={t("finance.tree.createTree")}
              onClick={() => setTreeCreateOpen(true)}
              size="sm"
              color="primary"
              variant="solid"
            />
          </div>
        </div>
        <FinanceTreeCreateModal
          isOpen={treeCreateOpen}
          onClose={() => {
            if (!createTreeMutation.isPending) {
              setTreeCreateOpen(false);
            }
          }}
          preset={preset}
          assets={assets}
          submitting={createTreeMutation.isPending}
          onCreateAsset={createAsset}
          onSubmit={(payload) => createTreeMutation.mutate(payload)}
        />
      </div>
    );
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
      <FinanceTreeSelector
        preset={preset}
        trees={trees}
        selectedTreeId={tree.id}
        onSelectTree={(treeId) => {
          setSelectedTreeId(treeId);
          setSelectedSnapshotId(null);
          setSnapshotFormVisible(false);
          setSnapshotFormMode("create");
        }}
        onCreateTree={() => setTreeCreateOpen(true)}
        onManageTree={() => setTreeManagerOpen(true)}
      />

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
        onCreateSnapshot={openCreateSnapshotForm}
        createDisabled={!entryNodes.length}
      />

      <SnapshotModule
        preset={preset}
        tree={tree}
        assets={assets}
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

      <FinanceTreeCreateModal
        isOpen={treeCreateOpen}
        onClose={() => {
          if (!createTreeMutation.isPending) {
            setTreeCreateOpen(false);
          }
        }}
        preset={preset}
        assets={assets}
        submitting={createTreeMutation.isPending}
        onCreateAsset={createAsset}
        onSubmit={(payload) => createTreeMutation.mutate(payload)}
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

function FinanceTreeSelector({
  preset,
  trees,
  selectedTreeId,
  manageDisabled,
  onSelectTree,
  onCreateTree,
  onManageTree,
}: {
  preset: PresetConfig;
  trees: FinanceTree[];
  selectedTreeId: UUID | null;
  manageDisabled?: boolean;
  onSelectTree: (treeId: UUID) => void;
  onCreateTree: () => void;
  onManageTree: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <label className="form-control">
            <span className="label-text">{t("finance.tree.selectTree")}</span>
            <select
              className="select select-bordered select-sm"
              value={selectedTreeId ?? ""}
              onChange={(event) => {
                if (event.target.value) {
                  onSelectTree(event.target.value as UUID);
                }
              }}
              disabled={!trees.length}
            >
              {!trees.length ? (
                <option value="">{t("finance.tree.noTrees")}</option>
              ) : null}
              {trees.map((tree) => (
                <option key={tree.id} value={tree.id}>
                  {tree.name}
                  {tree.is_default ? ` · ${t("finance.tree.default")}` : ""}
                  {` · ${tree.primary_currency}`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-6">
          <CreateNewButton
            label={t("finance.tree.createTree")}
            onClick={onCreateTree}
            size="sm"
            color="primary"
            variant="solid"
          />
          <ActionButton
            label={t("finance.tree.manage")}
            onClick={onManageTree}
            size="sm"
            variant="outline"
            iconName="settings"
            disabled={manageDisabled || !selectedTreeId}
          />
        </div>
      </div>
      <p className="mt-3 text-sm text-base-content/70">{t(`finance.${preset.purpose}.treeHint`)}</p>
    </section>
  );
}

function FinanceTreeCreateModal({
  isOpen,
  onClose,
  preset,
  assets,
  submitting,
  onCreateAsset,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  preset: PresetConfig;
  assets: FinanceAsset[];
  submitting: boolean;
  onCreateAsset: (code: string) => Promise<FinanceAsset>;
  onSubmit: (payload: FinanceTreeCreate) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [primaryCurrency, setPrimaryCurrency] = useState("USD");

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setPrimaryCurrency("USD");
  }, [isOpen, preset.purpose]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSubmit({
      name: trimmedName,
      purpose: preset.purpose,
      time_mode: preset.timeMode,
      primary_currency: primaryCurrency,
      display_order: 1000,
      is_default: false,
    });
  };

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={t("finance.tree.createTreeTitle")}
      size="md"
      bodyOverflow="auto"
    >
      <form className="space-y-3" onSubmit={handleSubmit}>
        <FormField label={t("finance.tree.treeName")}>
          <TextInput
            size="sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("finance.tree.treeNamePlaceholder")}
            disabled={submitting}
          />
        </FormField>
        <FormField label={t("finance.tree.primaryCurrency")}>
          <AssetSelect
            assets={assets}
            value={primaryCurrency}
            onChange={setPrimaryCurrency}
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
            label={submitting ? t("common.saving") : t("finance.tree.createTree")}
            color="primary"
            variant="solid"
            iconName="plus"
            disabled={submitting || !name.trim()}
          />
        </div>
      </form>
    </ModalBase>
  );
}

function SnapshotModule({
  preset,
  tree,
  assets,
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
  assets: FinanceAsset[];
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
    title?: string | null;
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
      title?: string | null;
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
            assets={assets}
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
            <SnapshotActionButtons
              editLabel={t("finance.snapshot.edit")}
              deleteLabel={t("finance.snapshot.delete")}
              disabled={snapshotDetailLoading || snapshotDeleting}
              deleteDisabled={snapshotDeleting}
              onEdit={onEditSnapshot}
              onDelete={() => onDeleteSnapshot(currentSnapshot)}
            />
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
              assets={assets}
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
            assets={assets}
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

export default FinancePage;
