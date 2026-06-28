import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import ActionButton, { CreateNewButton } from "@/components/ActionButton";
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
  type FinanceTreeUpdate,
} from "@/services/api/finance";
import {
  invalidateAllFinanceSnapshotLists,
  invalidateFinanceTree,
  invalidateFinanceSnapshot,
  invalidateFinanceSnapshots,
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
  snapshotLabel,
  type FinanceNodeFormState,
  type FinanceTab,
  type PresetConfig,
  type TreeNodeWithChildren,
} from "@/features/finance/utils";
import {
  FinanceAssetManagerModal,
  RateSnapshotsWorkspace,
} from "@/features/finance/RateSnapshotsWorkspace";
import {
  SnapshotActionButtons,
  SnapshotNavigator,
  SnapshotSelectorToolbar,
  SnapshotToolbar,
} from "@/features/finance/SnapshotChrome";
import { useFinanceAssetSource } from "@/features/finance/useFinanceAssetSource";

const PRESETS: PresetConfig[] = [
  {
    report: "balance",
    titleKey: "finance.balance.title",
    descriptionKey: "finance.balance.description",
    timeMode: "instant",
  },
  {
    report: "cashflow",
    titleKey: "finance.cashflow.title",
    descriptionKey: "finance.cashflow.description",
    timeMode: "period",
  },
];

function FinancePage() {
  const { t } = useTranslation();
  const { setHeader } = usePageHeader();
  const [activeTab, setActiveTab] = useState<FinanceTab>("balance");
  const [assetManagerOpen, setAssetManagerOpen] = useState(false);

  useEffect(() => {
    setHeader({
      title: t("finance.title"),
      subtitle: t("finance.subtitle"),
    });
    return () => setHeader({ title: undefined, subtitle: undefined, actions: undefined });
  }, [setHeader, t]);

  const preset = PRESETS.find((item) => item.report === activeTab) ?? PRESETS[0];
  const reportTabs: { id: FinanceTab; label: string }[] = PRESETS.map((item) => ({
    id: item.report,
    label: t(item.titleKey),
  }));
  const managementTabs: { id: FinanceTab; label: string }[] = [
    { id: "rates", label: t("finance.rates.tabTitle") },
    { id: "trees", label: t("finance.tree.tabTitle") },
  ];
  const renderTab = (item: { id: FinanceTab; label: string }) => (
    <ActionButton
      key={item.id}
      label={item.label}
      onClick={() => setActiveTab(item.id)}
      color={activeTab === item.id ? "primary" : "neutral"}
      variant={activeTab === item.id ? "solid" : "ghost"}
      size="sm"
      className="shrink-0 px-3"
    />
  );

  return (
    <PageLayout>
      <ToolbarContainer className="mb-6" variant="compact" padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {reportTabs.map(renderTab)}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {managementTabs.map(renderTab)}
            <ActionButton
              label={t("finance.assets.manage")}
              iconName="settings"
              onClick={() => setAssetManagerOpen(true)}
              size="sm"
              variant="outline"
              className="shrink-0 px-3"
            />
          </div>
        </div>
      </ToolbarContainer>

      {activeTab === "rates" ? (
        <RateSnapshotsWorkspace />
      ) : activeTab === "trees" ? (
        <FinanceTreesWorkspace />
      ) : (
        <FinancePresetWorkspace key={preset.report} preset={preset} />
      )}
      <FinanceAssetManagerModal
        isOpen={assetManagerOpen}
        onClose={() => setAssetManagerOpen(false)}
      />
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
  const [selectedTreeId, setSelectedTreeId] = useState<UUID | null>(null);
  const [pendingDeleteSnapshot, setPendingDeleteSnapshot] = useState<FinanceSnapshot | null>(null);
  const [deletedSnapshotIds, setDeletedSnapshotIds] = useState<Set<UUID>>(() => new Set());

  const treesQuery = useQuery({
    queryKey: financeKeys.trees(),
    queryFn: () => financeApi.listTrees(),
    staleTime: 60_000,
  });

  const trees = useMemo(() => treesQuery.data?.items ?? [], [treesQuery.data?.items]);
  const snapshotsQuery = useQuery({
    queryKey: financeKeys.allSnapshots(),
    queryFn: () => financeApi.listAllSnapshots(),
  });

  const rawSnapshots = (snapshotsQuery.data?.items ?? []).filter((snapshot) =>
    preset.timeMode === "period"
      ? Boolean(snapshot.period_start && snapshot.period_end)
      : !snapshot.period_start && !snapshot.period_end,
  );
  const snapshots = rawSnapshots.filter((snapshot) => !deletedSnapshotIds.has(snapshot.id));
  const latestSnapshot = snapshots[0] ?? null;
  const detailSnapshotId = selectedSnapshotId ?? latestSnapshot?.id ?? null;
  const currentSnapshot =
    snapshots.find((snapshot) => snapshot.id === detailSnapshotId) ?? latestSnapshot;
  const currentPosition = currentSnapshot
    ? snapshots.findIndex((snapshot) => snapshot.id === currentSnapshot.id) + 1
    : 0;
  const hasPrevious = currentPosition > 1;
  const hasNext = currentPosition > 0 && currentPosition < snapshots.length;
  const activeTreeId = snapshotFormVisible
    ? selectedTreeId
    : currentSnapshot?.tree_id ?? selectedTreeId;
  const treeQuery = useQuery({
    queryKey: financeKeys.tree(activeTreeId),
    queryFn: () => financeApi.getTree(activeTreeId!),
    enabled: Boolean(activeTreeId),
    staleTime: 60_000,
  });

  const tree = treeQuery.data;
  const treeNodes = useMemo(() => buildTree(tree?.nodes ?? []), [tree?.nodes]);
  const rateSnapshotsQuery = useQuery({
    queryKey: financeKeys.rateSnapshots(),
    queryFn: () => financeApi.listRateSnapshots(),
  });
  const rateSnapshots = rateSnapshotsQuery.data?.items ?? [];

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

  const createSnapshotMutation = useMutation({
    mutationFn: ({
      treeId,
      payload,
    }: {
      treeId: UUID;
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
    }) => financeApi.createSnapshot(treeId, payload),
    onSuccess: async (snapshot) => {
      toast.showSuccess(t("finance.messages.snapshotCreated"));
      setSnapshotFormVisible(false);
      setSelectedSnapshotId(snapshot.id);
      setFinanceSnapshotCache(queryClient, snapshot);
      await Promise.all([
        invalidateFinanceSnapshots(queryClient, snapshot.tree_id),
        invalidateAllFinanceSnapshotLists(queryClient),
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
        invalidateFinanceSnapshots(queryClient, snapshot.tree_id),
        invalidateAllFinanceSnapshotLists(queryClient),
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
      await invalidateAllFinanceSnapshotLists(queryClient);
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

  if (treesQuery.isLoading || snapshotsQuery.isLoading || (activeTreeId && treeQuery.isLoading)) {
    return <LoadingSpinner />;
  }

  if (treesQuery.error || snapshotsQuery.error || treeQuery.error) {
    const error = treesQuery.error ?? snapshotsQuery.error ?? treeQuery.error;
    return (
      <ErrorDisplay
        error={error instanceof Error ? error.message : String(error)}
      />
    );
  }

  if (!tree) {
    return (
      <div className="rounded-2xl border border-dashed border-base-200 bg-base-100 p-8 text-center text-sm text-base-content/70">
        <p>{t("finance.tree.noTrees")}</p>
      </div>
    );
  }

  const selectSnapshot = (snapshotId: UUID) => {
    setSelectedSnapshotId(snapshotId);
    setSnapshotFormVisible(false);
    setSnapshotFormMode("create");
  };

  const openCreateSnapshotForm = () => {
    const defaultTree = trees.find((item) => item.is_default) ?? trees[0] ?? null;
    setSelectedTreeId(defaultTree?.id ?? null);
    setSnapshotFormMode("create");
    setSnapshotFormVisible(true);
  };

  const openEditSnapshotForm = () => {
    if (currentSnapshot) {
      setSelectedTreeId(currentSnapshot.tree_id);
    }
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
        description={t(preset.descriptionKey)}
        snapshots={snapshots}
        selectedSnapshotId={detailSnapshotId}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onSelect={selectSnapshot}
        onPrevious={() => moveSnapshot(-1)}
        onNext={() => moveSnapshot(1)}
        onCreateSnapshot={openCreateSnapshotForm}
        createDisabled={!trees.length}
      />

      <SnapshotModule
        preset={preset}
        tree={tree}
        assets={assets}
        onCreateAsset={createAsset}
        treeNodes={treeNodes}
        rateSnapshots={rateSnapshots}
        snapshots={snapshots}
        currentSnapshot={currentSnapshot}
        snapshotDetail={selectedSnapshotQuery.data ?? null}
        snapshotDetailLoading={selectedSnapshotQuery.isLoading || selectedSnapshotQuery.isFetching}
        snapshotFormVisible={snapshotFormVisible}
        snapshotFormMode={snapshotFormMode}
        snapshotSubmitting={createSnapshotMutation.isPending}
        snapshotUpdating={updateSnapshotMutation.isPending}
        snapshotDeleting={deleteSnapshotMutation.isPending}
        onOpenSnapshotForm={openCreateSnapshotForm}
        onEditSnapshot={openEditSnapshotForm}
        onDeleteSnapshot={setPendingDeleteSnapshot}
        onCloseSnapshotForm={closeSnapshotForm}
        treeOptions={trees}
        selectedTreeId={selectedTreeId}
        onSelectTree={(treeId) => setSelectedTreeId(treeId)}
        onCreateSnapshot={(payload) => {
          if (selectedTreeId) {
            createSnapshotMutation.mutate({ treeId: selectedTreeId, payload });
          }
        }}
        onUpdateSnapshot={(snapshotId, payload) =>
          updateSnapshotMutation.mutate({ snapshotId, payload })
        }
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

function FinanceTreesWorkspace() {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { assets, createAsset } = useFinanceAssetSource();
  const [selectedTreeId, setSelectedTreeId] = useState<UUID | null>(null);
  const [treeFormMode, setTreeFormMode] = useState<"create" | "edit">("create");
  const [treeFormVisible, setTreeFormVisible] = useState(false);
  const [nodeFormState, setNodeFormState] = useState<FinanceNodeFormState | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<TreeNodeWithChildren | null>(null);
  const [pendingDeleteTree, setPendingDeleteTree] = useState<FinanceTree | null>(null);
  const treeFormId = "finance-tree-form";

  const treesQuery = useQuery({
    queryKey: financeKeys.trees(),
    queryFn: () => financeApi.listTrees({}),
    staleTime: 60_000,
  });
  const trees = useMemo(() => treesQuery.data?.items ?? [], [treesQuery.data?.items]);
  const currentTree = trees.find((tree) => tree.id === selectedTreeId) ?? trees[0] ?? null;
  const treeQuery = useQuery({
    queryKey: financeKeys.tree(currentTree?.id ?? null),
    queryFn: () => financeApi.getTree(currentTree!.id),
    enabled: Boolean(currentTree?.id),
    staleTime: 60_000,
  });
  const tree = treeQuery.data ?? currentTree;
  const treeNodes = useMemo(() => buildTree(treeQuery.data?.nodes ?? []), [treeQuery.data?.nodes]);
  const flatNodes = useMemo(() => flattenTree(treeNodes), [treeNodes]);
  const currentPosition = currentTree
    ? trees.findIndex((item) => item.id === currentTree.id) + 1
    : 0;
  const hasPrevious = currentPosition > 1;
  const hasNext = currentPosition > 0 && currentPosition < trees.length;
  const treeOptions = trees.map((item) => ({
    value: item.id,
    label: `${item.name} · ${item.primary_currency}`,
  }));

  useEffect(() => {
    if (!selectedTreeId && trees.length) {
      setSelectedTreeId(trees[0].id);
    }
  }, [selectedTreeId, trees]);

  const invalidateTreeLists = async (treeToInvalidate?: FinanceTree | null) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: financeKeys.trees() }),
      treeToInvalidate
        ? invalidateFinanceTree(queryClient, treeToInvalidate.id)
        : Promise.resolve(),
    ]);
  };

  const createTreeMutation = useMutation({
    mutationFn: (payload: FinanceTreeCreate) => financeApi.createTree(payload),
    onSuccess: async (createdTree) => {
      toast.showSuccess(t("finance.messages.treeCreated"));
      setTreeFormVisible(false);
      setTreeFormMode("create");
      setSelectedTreeId(createdTree.id);
      await invalidateTreeLists(createdTree);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const updateTreeMutation = useMutation({
    mutationFn: ({
      treeId,
      payload,
    }: {
      treeId: UUID;
      payload: FinanceTreeUpdate;
    }) => financeApi.updateTree(treeId, payload),
    onSuccess: async (updatedTree) => {
      toast.showSuccess(t("finance.messages.treeUpdated"));
      setTreeFormVisible(false);
      setTreeFormMode("create");
      setSelectedTreeId(updatedTree.id);
      await invalidateTreeLists(updatedTree);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const deleteTreeMutation = useMutation({
    mutationFn: (treeId: UUID) => financeApi.deleteTree(treeId),
    onSuccess: async () => {
      toast.showSuccess(t("finance.messages.treeDeleted"));
      const deletedId = pendingDeleteTree?.id;
      const deletedIndex = trees.findIndex((item) => item.id === deletedId);
      const nextTree = trees[deletedIndex + 1] ?? trees[deletedIndex - 1] ?? null;
      setPendingDeleteTree(null);
      setSelectedTreeId(nextTree?.id ?? null);
      await invalidateTreeLists(pendingDeleteTree);
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
      await invalidateTreeLists(tree);
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
      await invalidateTreeLists(tree);
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
      await invalidateTreeLists(tree);
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const selectTree = (treeId: UUID) => {
    setSelectedTreeId(treeId);
    setTreeFormVisible(false);
    setTreeFormMode("create");
  };

  const moveTree = (direction: -1 | 1) => {
    if (!currentTree) return;
    const index = trees.findIndex((item) => item.id === currentTree.id);
    const next = trees[index + direction];
    if (next) {
      selectTree(next.id);
    }
  };

  if (treesQuery.isLoading || (currentTree && treeQuery.isLoading)) {
    return <LoadingSpinner />;
  }

  if (treesQuery.error || treeQuery.error) {
    const error = treesQuery.error ?? treeQuery.error;
    return <ErrorDisplay error={error instanceof Error ? error.message : String(error)} />;
  }

  return (
    <div className="space-y-6">
      <SnapshotSelectorToolbar
        description={t("finance.tree.tabDescription")}
        selectValue={currentTree?.id ?? null}
        selectOptions={treeOptions}
        selectPlaceholder={t("finance.tree.selectTree")}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        createLabel={t("finance.tree.createTree")}
        onSelect={selectTree}
        onPrevious={() => moveTree(-1)}
        onNext={() => moveTree(1)}
        onCreate={() => {
          setTreeFormMode("create");
          setTreeFormVisible(true);
        }}
      />

      <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
        {treeFormVisible ? (
          <>
            <SnapshotNavigator
              title={
                treeFormMode === "edit"
                  ? t("finance.tree.editTree")
                  : t("finance.tree.createTree")
              }
              rightSlot={
                <div className="flex justify-end gap-2">
                  <ActionButton
                    label={t("common.cancel")}
                    iconName="x-mark"
                    onClick={() => {
                      setTreeFormVisible(false);
                      setTreeFormMode("create");
                    }}
                    size="sm"
                    variant="ghost"
                    disabled={createTreeMutation.isPending || updateTreeMutation.isPending}
                  />
                  <ActionButton
                    type="submit"
                    form={treeFormId}
                    label={
                      createTreeMutation.isPending || updateTreeMutation.isPending
                        ? t("common.saving")
                        : t("common.save")
                    }
                    iconName="check"
                    color="primary"
                    variant="solid"
                    disabled={createTreeMutation.isPending || updateTreeMutation.isPending}
                  />
                </div>
              }
            />
            <FinanceTreeFormPanel
              formId={treeFormId}
              mode={treeFormMode}
              initialTree={treeFormMode === "edit" ? tree : null}
              assets={assets}
              submitting={createTreeMutation.isPending || updateTreeMutation.isPending}
              onCreateAsset={createAsset}
              onSubmit={(payload) => {
                if (treeFormMode === "edit" && tree) {
                  updateTreeMutation.mutate({
                    treeId: tree.id,
                    payload: {
                      name: payload.name,
                      primary_currency: payload.primary_currency,
                      display_order: payload.display_order,
                      is_default: payload.is_default,
                    },
                  });
                  return;
                }
                createTreeMutation.mutate(payload);
              }}
            />
          </>
        ) : tree ? (
          <>
            <SnapshotNavigator
              title={tree.name}
              rightSlot={
                <SnapshotActionButtons
                  editLabel={t("finance.tree.editTree")}
                  deleteLabel={t("finance.tree.deleteTree")}
                  disabled={deleteTreeMutation.isPending}
                  deleteDisabled={deleteTreeMutation.isPending}
                  onEdit={() => {
                    setTreeFormMode("edit");
                    setTreeFormVisible(true);
                  }}
                  onDelete={() => setPendingDeleteTree(tree)}
                />
              }
            />
            <div className="mt-4">
              <FinanceTreeManagerPanel
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
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-base-300 p-6 text-center text-sm text-base-content/60">
            {t("finance.tree.noTrees")}
          </div>
        )}
      </section>

      {tree ? (
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
          onCreateNode={(payload) =>
            createNodeMutation.mutate(payload, {
              onSuccess: () => setNodeFormState(null),
            })
          }
          onUpdateNode={(nodeId, payload) => updateNodeMutation.mutate({ nodeId, payload })}
        />
      ) : null}

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
        isOpen={Boolean(pendingDeleteTree)}
        title={t("finance.tree.deleteTreeTitle")}
        message={t("finance.tree.deleteTreeMessage", {
          name: pendingDeleteTree?.name ?? "",
        })}
        confirmText={t("finance.tree.deleteTreeConfirm")}
        onCancel={() => setPendingDeleteTree(null)}
        onConfirm={() => {
          if (pendingDeleteTree) {
            deleteTreeMutation.mutate(pendingDeleteTree.id);
          }
        }}
        loading={deleteTreeMutation.isPending}
      />
    </div>
  );
}

function FinanceTreeFormPanel({
  formId,
  mode,
  initialTree,
  assets,
  submitting,
  onCreateAsset,
  onSubmit,
}: {
  formId: string;
  mode: "create" | "edit";
  initialTree?: FinanceTree | null;
  assets: FinanceAsset[];
  submitting: boolean;
  onCreateAsset: (code: string) => Promise<FinanceAsset>;
  onSubmit: (payload: FinanceTreeCreate) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [primaryCurrency, setPrimaryCurrency] = useState("USD");
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (mode === "edit" && initialTree) {
      setName(initialTree.name);
      setPrimaryCurrency(initialTree.primary_currency);
      setIsDefault(initialTree.is_default);
      return;
    }
    setName("");
    setPrimaryCurrency("USD");
    setIsDefault(false);
  }, [initialTree, mode]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSubmit({
      name: trimmedName,
      primary_currency: primaryCurrency,
      display_order: initialTree?.display_order ?? 1000,
      is_default: isDefault,
    });
  };

  return (
    <form id={formId} className="mt-4 space-y-3" onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      </div>
      <label className="flex items-center gap-2 text-sm text-base-content/80">
        <input
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={isDefault}
          onChange={(event) => setIsDefault(event.target.checked)}
          disabled={submitting}
        />
        {t("finance.tree.default")}
      </label>
    </form>
  );
}

function SnapshotModule({
  preset,
  tree,
  assets,
  onCreateAsset,
  treeNodes,
  rateSnapshots,
  snapshots,
  currentSnapshot,
  snapshotDetail,
  snapshotDetailLoading,
  snapshotFormVisible,
  snapshotFormMode,
  snapshotSubmitting,
  snapshotUpdating,
  snapshotDeleting,
  onOpenSnapshotForm,
  onEditSnapshot,
  onDeleteSnapshot,
  onCloseSnapshotForm,
  treeOptions,
  selectedTreeId,
  onSelectTree,
  onCreateSnapshot,
  onUpdateSnapshot,
}: {
  preset: PresetConfig;
  tree: FinanceTree;
  assets: FinanceAsset[];
  onCreateAsset: (code: string) => Promise<FinanceAsset>;
  treeNodes: TreeNodeWithChildren[];
  rateSnapshots: FinanceRateSnapshot[];
  snapshots: FinanceSnapshot[];
  currentSnapshot: FinanceSnapshot | null;
  snapshotDetail: FinanceSnapshot | null;
  snapshotDetailLoading: boolean;
  snapshotFormVisible: boolean;
  snapshotFormMode: "create" | "edit";
  snapshotSubmitting: boolean;
  snapshotUpdating: boolean;
  snapshotDeleting: boolean;
  onOpenSnapshotForm: () => void;
  onEditSnapshot: () => void;
  onDeleteSnapshot: (snapshot: FinanceSnapshot) => void;
  onCloseSnapshotForm: () => void;
  treeOptions: FinanceTree[];
  selectedTreeId: UUID | null;
  onSelectTree: (treeId: UUID) => void;
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
            onCreateAsset={onCreateAsset}
            treeOptions={treeOptions}
            selectedTreeId={selectedTreeId}
            onSelectTree={onSelectTree}
            treeNodes={treeNodes}
            rateSnapshots={rateSnapshots}
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
            disabled={!treeOptions.length}
          />
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-base-200 bg-base-100 p-4 shadow-sm">
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
              onCreateAsset={onCreateAsset}
              treeOptions={treeOptions}
              selectedTreeId={tree.id}
              onSelectTree={onSelectTree}
              treeNodes={treeNodes}
              rateSnapshots={rateSnapshots}
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
      ) : (
        <>
          <SnapshotNavigator
            title={currentSnapshot ? snapshotLabel(currentSnapshot) : t("finance.history.noSelection")}
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
            {snapshotDetailLoading ? (
              <div className="py-6">
                <LoadingSpinner />
              </div>
            ) : snapshotDetail ? (
              <SnapshotDetail
                snapshot={snapshotDetail}
                assets={assets}
                treeNodes={treeNodes}
                rateSnapshots={rateSnapshots}
              />
            ) : (
              <p className="py-4 text-sm text-base-content/70">
                {t("finance.history.noSelection")}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function FinanceTreeManagerPanel({
  treeNodes,
  deletingNodeId,
  onCreateRootNode,
  onCreateChildNode,
  onEditNode,
  onDeleteNode,
}: {
  treeNodes: TreeNodeWithChildren[];
  deletingNodeId: UUID | null;
  onCreateRootNode: () => void;
  onCreateChildNode: (node: TreeNodeWithChildren) => void;
  onEditNode: (node: TreeNodeWithChildren) => void;
  onDeleteNode: (node: TreeNodeWithChildren) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
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
  const [collapsedIds, setCollapsedIds] = useState<Set<UUID>>(new Set());

  useEffect(() => {
    const validIds = new Set(flattenTree(treeNodes).map((node) => node.id));
    setCollapsedIds((current) => {
      const next = new Set<UUID>();
      current.forEach((nodeId) => {
        if (validIds.has(nodeId)) {
          next.add(nodeId);
        }
      });
      return next;
    });
  }, [treeNodes]);

  const toggleNode = (nodeId: UUID) => {
    setCollapsedIds((current) => {
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

  const expandedIds = new Set(
    flattenTree(treeNodes)
      .map((node) => node.id)
      .filter((nodeId) => !collapsedIds.has(nodeId)),
  );

  return (
    <div>
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
        <div className="min-w-0 flex flex-1 items-center gap-2">
          <span className="font-medium truncate">{node.name}</span>
          <span className="shrink-0 text-xs text-base-content/60">{node.currency_code || "-"}</span>
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
