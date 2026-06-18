import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import ActionButton, { CreateNewButton } from "@/components/ActionButton";
import Badge from "@/components/common/Badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import ErrorDisplay from "@/components/ErrorDisplay";
import { FormField, TextArea, TextInput } from "@/components/forms";
import LoadingSpinner from "@/components/LoadingSpinner";
import EnumSelect from "@/components/selects/EnumSelect";
import ToolbarContainer from "@/components/ToolbarContainer";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { useToast } from "@/contexts/ToastContext";
import ModalBase from "@/layouts/ModalBase";
import PageLayout from "@/layouts/PageLayout";
import {
  financeApi,
  type FinancePurpose,
  type FinanceRateSnapshot,
  type FinanceRateSnapshotCreate,
  type FinanceSnapshot,
  type FinanceSnapshotEntryCreate,
  type FinanceTree,
  type FinanceTreeNode,
} from "@/services/api/finance";
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

function FinancePage() {
  const { t } = useTranslation();
  const { setHeader } = usePageHeader();
  const [activePurpose, setActivePurpose] = useState<FinancePurpose>("balance");

  useEffect(() => {
    setHeader({
      title: t("finance.title"),
      subtitle: t("finance.subtitle"),
    });
    return () => setHeader({ title: undefined, subtitle: undefined, actions: undefined });
  }, [setHeader, t]);

  const preset = PRESETS.find((item) => item.purpose === activePurpose) ?? PRESETS[0];

  return (
    <PageLayout>
      <ToolbarContainer className="mb-6" variant="compact" padding="sm">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((item) => (
            <ActionButton
              key={item.purpose}
              label={t(item.titleKey)}
              onClick={() => setActivePurpose(item.purpose)}
              color={activePurpose === item.purpose ? "primary" : "neutral"}
              variant={activePurpose === item.purpose ? "solid" : "ghost"}
              size="sm"
            />
          ))}
        </div>
      </ToolbarContainer>

      <FinancePresetWorkspace key={preset.purpose} preset={preset} />
    </PageLayout>
  );
}

function FinancePresetWorkspace({ preset }: { preset: PresetConfig }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<UUID | null>(null);
  const [snapshotFormVisible, setSnapshotFormVisible] = useState(false);
  const [treeManagerOpen, setTreeManagerOpen] = useState(false);
  const [nodeFormState, setNodeFormState] = useState<FinanceNodeFormState | null>(null);
  const [pendingDeleteNode, setPendingDeleteNode] = useState<TreeNodeWithChildren | null>(null);

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

  const snapshots = snapshotsQuery.data?.items ?? [];

  const rateSnapshotsQuery = useQuery({
    queryKey: financeKeys.rateSnapshots(tree?.primary_currency ?? null),
    queryFn: () => financeApi.listRateSnapshots({ primary_currency: tree!.primary_currency }),
    enabled: Boolean(tree?.primary_currency),
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
      await queryClient.invalidateQueries({
        queryKey: financeKeys.treesByPurpose(preset.purpose),
      });
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
      await queryClient.invalidateQueries({
        queryKey: financeKeys.treesByPurpose(preset.purpose),
      });
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
      await queryClient.invalidateQueries({
        queryKey: financeKeys.treesByPurpose(preset.purpose),
      });
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
      await queryClient.invalidateQueries({
        queryKey: financeKeys.snapshots(tree?.id ?? null),
      });
      await queryClient.invalidateQueries({
        queryKey: financeKeys.snapshot(snapshot.id),
      });
    },
    onError: (error) => {
      toast.showError(t("common.error"), error instanceof Error ? error.message : String(error));
    },
  });

  const createRateSnapshotMutation = useMutation({
    mutationFn: (payload: FinanceRateSnapshotCreate) => financeApi.createRateSnapshot(payload),
    onSuccess: async (rateSnapshot) => {
      toast.showSuccess(t("finance.messages.rateSnapshotCreated"));
      await queryClient.invalidateQueries({
        queryKey: financeKeys.rateSnapshots(tree?.primary_currency ?? null),
      });
      await queryClient.invalidateQueries({
        queryKey: financeKeys.rateSnapshot(rateSnapshot.id),
      });
    },
    onError: (error) => {
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
        onCreateSnapshot={() => setSnapshotFormVisible(true)}
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
        snapshotSubmitting={createSnapshotMutation.isPending}
        rateSnapshotSubmitting={createRateSnapshotMutation.isPending}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={() => moveSnapshot(-1)}
        onNext={() => moveSnapshot(1)}
        onOpenSnapshotForm={() => setSnapshotFormVisible(true)}
        onCloseSnapshotForm={() => setSnapshotFormVisible(false)}
        onCreateSnapshot={(payload) => createSnapshotMutation.mutate(payload)}
        onCreateRateSnapshot={(payload, options) =>
          createRateSnapshotMutation.mutate(payload, options)
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
        formState={nodeFormState}
        submitting={createNodeMutation.isPending || updateNodeMutation.isPending}
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
  snapshotSubmitting,
  rateSnapshotSubmitting,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onOpenSnapshotForm,
  onCloseSnapshotForm,
  onCreateSnapshot,
  onCreateRateSnapshot,
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
  snapshotSubmitting: boolean;
  rateSnapshotSubmitting: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onOpenSnapshotForm: () => void;
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
  onCreateRateSnapshot: (
    payload: FinanceRateSnapshotCreate,
    options?: { onSuccess?: (rateSnapshot: FinanceRateSnapshot) => void },
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
            rateSnapshotSubmitting={rateSnapshotSubmitting}
            onSubmit={onCreateSnapshot}
            onCreateRateSnapshot={onCreateRateSnapshot}
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
            <div className="grid grid-cols-3 gap-2 min-w-full sm:min-w-[420px]">
              <Metric
                label={t("finance.metrics.positive")}
                value={formatMoney(currentSnapshot.total_positive, tree.primary_currency)}
              />
              <Metric
                label={t("finance.metrics.negative")}
                value={formatMoney(currentSnapshot.total_negative, tree.primary_currency)}
              />
              <Metric
                label={t("finance.metrics.net")}
                value={formatMoney(currentSnapshot.net_amount, tree.primary_currency)}
              />
            </div>
          ) : null
        }
      />

      <div className="mt-4">
        {snapshotFormVisible ? (
          <SnapshotFormPanel
            tree={tree}
            preset={preset}
            treeNodes={treeNodes}
            rateSnapshots={rateSnapshots}
            requiredRateCurrencies={requiredRateCurrencies}
            submitting={snapshotSubmitting}
            rateSnapshotSubmitting={rateSnapshotSubmitting}
            onSubmit={onCreateSnapshot}
            onCreateRateSnapshot={onCreateRateSnapshot}
            onCancel={onCloseSnapshotForm}
          />
        ) : snapshotDetailLoading ? (
          <div className="py-6">
            <LoadingSpinner />
          </div>
        ) : snapshotDetail ? (
          <SnapshotDetail snapshot={snapshotDetail} tree={tree} treeNodes={treeNodes} />
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
  formState,
  submitting,
  onCreateNode,
  onUpdateNode,
}: {
  isOpen: boolean;
  onClose: () => void;
  tree: FinanceTree;
  flatNodes: TreeNodeWithChildren[];
  formState: FinanceNodeFormState | null;
  submitting: boolean;
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
          <TextInput
            size="sm"
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
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
  rateSnapshotSubmitting,
  onSubmit,
  onCreateRateSnapshot,
  onCancel,
}: {
  tree: FinanceTree;
  preset: PresetConfig;
  treeNodes: TreeNodeWithChildren[];
  rateSnapshots: FinanceRateSnapshot[];
  requiredRateCurrencies: string[];
  submitting: boolean;
  rateSnapshotSubmitting: boolean;
  onSubmit: (payload: {
    snapshot_ts?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    primary_currency?: string | null;
    rate_snapshot_id?: UUID | null;
    note?: string | null;
    entries: FinanceSnapshotEntryCreate[];
  }) => void;
  onCreateRateSnapshot: (
    payload: FinanceRateSnapshotCreate,
    options?: { onSuccess?: (rateSnapshot: FinanceRateSnapshot) => void },
  ) => void;
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
  const needsRateSnapshot = requiredRateCurrencies.length > 0;
  const missingRateCurrencies = requiredRateCurrencies.filter(
    (currency) => !conversionRates[currency],
  );

  useEffect(() => {
    if (!needsRateSnapshot || selectedRateSnapshotId) return;
    const latestSnapshot = rateSnapshots[0];
    if (latestSnapshot) {
      setSelectedRateSnapshotId(latestSnapshot.id);
    }
  }, [needsRateSnapshot, rateSnapshots, selectedRateSnapshotId]);

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
    if (needsRateSnapshot && !selectedRateSnapshotId) {
      toast.showWarning(t("finance.messages.rateSnapshotRequired"));
      return;
    }
    if (needsRateSnapshot && missingRateCurrencies.length) {
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
    setAmounts({});
    setNotes({});
    setSnapshotNote("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-base-content">{t("finance.snapshot.formTitle")}</h3>
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

        <RateSnapshotPanel
          primaryCurrency={tree.primary_currency}
          requiredCurrencies={requiredRateCurrencies}
          rateSnapshots={rateSnapshots}
          selectedRateSnapshotId={selectedRateSnapshotId}
          submitting={rateSnapshotSubmitting}
          onSelectRateSnapshot={setSelectedRateSnapshotId}
          onCreateRateSnapshot={onCreateRateSnapshot}
        />

        <SnapshotEntryTreeTable
          treeNodes={treeNodes}
          amounts={amounts}
          notes={notes}
          aggregatedAmounts={aggregatedAmounts}
          primaryCurrency={tree.primary_currency}
          conversionRates={conversionRates}
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
              (needsRateSnapshot &&
                (!selectedRateSnapshotId || missingRateCurrencies.length > 0))
            }
          />
        </div>
      </form>
    </div>
  );
}

function RateSnapshotPanel({
  primaryCurrency,
  requiredCurrencies,
  rateSnapshots,
  selectedRateSnapshotId,
  submitting,
  onSelectRateSnapshot,
  onCreateRateSnapshot,
}: {
  primaryCurrency: string;
  requiredCurrencies: string[];
  rateSnapshots: FinanceRateSnapshot[];
  selectedRateSnapshotId: UUID | "";
  submitting: boolean;
  onSelectRateSnapshot: (rateSnapshotId: UUID | "") => void;
  onCreateRateSnapshot: (
    payload: FinanceRateSnapshotCreate,
    options?: { onSuccess?: (rateSnapshot: FinanceRateSnapshot) => void },
  ) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [capturedAt, setCapturedAt] = useState(nowDateTimeLocal());
  const [source, setSource] = useState("manual");
  const [note, setNote] = useState("");
  const [rates, setRates] = useState<Record<string, string>>({});

  if (!requiredCurrencies.length) {
    return null;
  }

  const options = rateSnapshots.map((snapshot) => ({
    value: snapshot.id,
    label: `${formatDateTime(snapshot.captured_at)} · ${snapshot.primary_currency}`,
  }));

  const createRateSnapshot = () => {
    const entries = requiredCurrencies.map((currency) => ({
      base_currency: currency,
      quote_currency: primaryCurrency,
      rate: rates[currency]?.trim() ?? "",
      source: source.trim() || "manual",
    }));
    if (
      entries.some((entry) => {
        const numericRate = Number(entry.rate);
        return !entry.rate || !Number.isFinite(numericRate) || numericRate <= 0;
      })
    ) {
      toast.showWarning(t("finance.messages.rateSnapshotRatesRequired"));
      return;
    }
    onCreateRateSnapshot(
      {
        captured_at: localDateTimeToIso(capturedAt),
        primary_currency: primaryCurrency,
        source: source.trim() || "manual",
        note: note.trim() || null,
        entries,
      },
      {
        onSuccess: (rateSnapshot) => {
          onSelectRateSnapshot(rateSnapshot.id);
          setRates({});
          setNote("");
        },
      },
    );
  };

  return (
    <div className="rounded-lg border border-base-200 bg-base-200/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-base-content">{t("finance.rates.title")}</h4>
          <p className="text-sm text-base-content/60">
            {t("finance.rates.required", {
              currencies: requiredCurrencies.join(", "),
              primaryCurrency,
            })}
          </p>
        </div>
        <EnumSelect
          value={selectedRateSnapshotId || undefined}
          onChange={(value) => onSelectRateSnapshot((value as UUID | undefined) ?? "")}
          options={options}
          placeholder={t("finance.rates.selectSnapshot")}
          showLabel={false}
          size="sm"
          className="min-w-[14rem]"
          disabled={!options.length}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label={t("finance.rates.capturedAt")}>
            <TextInput
              type="datetime-local"
              size="sm"
              value={capturedAt}
              onChange={(event) => setCapturedAt(event.target.value)}
              disabled={submitting}
            />
          </FormField>
          <FormField label={t("finance.rates.source")}>
            <TextInput
              size="sm"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              disabled={submitting}
            />
          </FormField>
          {requiredCurrencies.map((currency) => (
            <FormField
              key={currency}
              label={t("finance.rates.rateLabel", { currency, primaryCurrency })}
            >
              <TextInput
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                size="sm"
                value={rates[currency] ?? ""}
                onChange={(event) =>
                  setRates((prev) => ({ ...prev, [currency]: event.target.value }))
                }
                disabled={submitting}
              />
            </FormField>
          ))}
          <FormField label={t("finance.rates.note")}>
            <TextInput
              size="sm"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              disabled={submitting}
            />
          </FormField>
        </div>
        <div className="flex items-end justify-end">
          <ActionButton
            type="button"
            label={submitting ? t("common.saving") : t("finance.rates.createSnapshot")}
            iconName="plus"
            color="primary"
            variant="outline"
            size="sm"
            onClick={createRateSnapshot}
            disabled={submitting}
          />
        </div>
      </div>
    </div>
  );
}

function SnapshotEntryTreeTable({
  treeNodes,
  amounts,
  notes,
  aggregatedAmounts,
  primaryCurrency,
  conversionRates,
  submitting,
  onChangeAmount,
  onChangeNote,
}: {
  treeNodes: TreeNodeWithChildren[];
  amounts: SnapshotAmountState;
  notes: SnapshotNoteState;
  aggregatedAmounts: Record<UUID, string>;
  primaryCurrency: string;
  conversionRates: Record<string, number>;
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
      const convertedAmount = hasChildren
        ? aggregatedAmount
        : convertSnapshotAmount(
            amount,
            node.currency_code || primaryCurrency,
            primaryCurrency,
            conversionRates,
          );
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
  const displayTree = useMemo(
    () => buildSnapshotDisplayTree(treeNodes, snapshot.entries ?? []),
    [snapshot.entries, treeNodes],
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                    <span className={`tabular-nums ${convertedAmountClass}`}>
                      {formatMoney(node.amountConverted, snapshot.primary_currency)}
                    </span>
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
          entry?.amount_converted ?? sumSnapshotNodeAmounts(children);
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
