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
  type FinanceNodeKind,
  type FinanceNormalSide,
  type FinancePurpose,
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
    () => flatNodes.filter((node) => node.node_kind === "regular" || node.children_count === 0),
    [flatNodes],
  );

  const snapshotsQuery = useQuery({
    queryKey: financeKeys.snapshots(tree?.id ?? null),
    queryFn: () => financeApi.listSnapshots(tree!.id),
    enabled: Boolean(tree?.id),
  });

  const snapshots = snapshotsQuery.data?.items ?? [];
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
      node_kind: FinanceNodeKind;
      normal_side?: FinanceNormalSide | null;
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
        snapshots={snapshots}
        currentSnapshot={currentSnapshot}
        currentPosition={currentPosition}
        snapshotDetail={selectedSnapshotQuery.data ?? null}
        snapshotDetailLoading={selectedSnapshotQuery.isLoading || selectedSnapshotQuery.isFetching}
        snapshotFormVisible={snapshotFormVisible}
        snapshotSubmitting={createSnapshotMutation.isPending}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onPrevious={() => moveSnapshot(-1)}
        onNext={() => moveSnapshot(1)}
        onOpenSnapshotForm={() => setSnapshotFormVisible(true)}
        onCloseSnapshotForm={() => setSnapshotFormVisible(false)}
        onCreateSnapshot={(payload) => createSnapshotMutation.mutate(payload)}
      />

      <FinanceTreeManagerModal
        isOpen={treeManagerOpen}
        onClose={() => setTreeManagerOpen(false)}
        tree={tree}
        preset={preset}
        treeNodes={treeNodes}
        flatNodes={flatNodes}
        creating={createNodeMutation.isPending}
        deletingNodeId={
          deleteNodeMutation.variables && deleteNodeMutation.isPending
            ? deleteNodeMutation.variables
            : null
        }
        onCreateNode={(payload) => createNodeMutation.mutate(payload)}
        onDeleteNode={setPendingDeleteNode}
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
  snapshots,
  currentSnapshot,
  currentPosition,
  snapshotDetail,
  snapshotDetailLoading,
  snapshotFormVisible,
  snapshotSubmitting,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onOpenSnapshotForm,
  onCloseSnapshotForm,
  onCreateSnapshot,
}: {
  preset: PresetConfig;
  tree: FinanceTree;
  entryNodes: TreeNodeWithChildren[];
  snapshots: FinanceSnapshot[];
  currentSnapshot: FinanceSnapshot | null;
  currentPosition: number;
  snapshotDetail: FinanceSnapshot | null;
  snapshotDetailLoading: boolean;
  snapshotFormVisible: boolean;
  snapshotSubmitting: boolean;
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
    note?: string | null;
    entries: FinanceSnapshotEntryCreate[];
  }) => void;
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
            entryNodes={entryNodes}
            submitting={snapshotSubmitting}
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
            entryNodes={entryNodes}
            submitting={snapshotSubmitting}
            onSubmit={onCreateSnapshot}
            onCancel={onCloseSnapshotForm}
          />
        ) : snapshotDetailLoading ? (
          <div className="py-6">
            <LoadingSpinner />
          </div>
        ) : snapshotDetail ? (
          <SnapshotDetail snapshot={snapshotDetail} tree={tree} />
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
  flatNodes,
  creating,
  deletingNodeId,
  onCreateNode,
  onDeleteNode,
}: {
  isOpen: boolean;
  onClose: () => void;
  tree: FinanceTree;
  preset: PresetConfig;
  treeNodes: TreeNodeWithChildren[];
  flatNodes: TreeNodeWithChildren[];
  creating: boolean;
  deletingNodeId: UUID | null;
  onCreateNode: (payload: {
    name: string;
    parent_id?: UUID | null;
    node_kind: FinanceNodeKind;
    normal_side?: FinanceNormalSide | null;
    currency_code?: string | null;
  }) => void;
  onDeleteNode: (node: TreeNodeWithChildren) => void;
}) {
  const { t } = useTranslation();
  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={t("finance.tree.manage")}
      size="2xl"
      bodyOverflow="auto"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5">
        <section className="space-y-4">
          <div>
            <h3 className="font-semibold text-base-content">{tree.name}</h3>
            <p className="text-sm text-base-content/60">{t(`finance.${preset.purpose}.treeHint`)}</p>
          </div>
          <div className="max-h-[520px] overflow-y-auto pr-1 space-y-2">
            {treeNodes.length ? (
              treeNodes.map((node) => (
                <TreeNodeRow
                  key={node.id}
                  node={node}
                  deletingNodeId={deletingNodeId}
                  onDeleteNode={onDeleteNode}
                />
              ))
            ) : (
              <div className="text-sm text-base-content/60">{t("finance.tree.empty")}</div>
            )}
          </div>
        </section>

        <FinanceNodeForm
          tree={tree}
          flatNodes={flatNodes}
          creating={creating}
          onCreateNode={onCreateNode}
        />
      </div>
    </ModalBase>
  );
}

function FinanceNodeForm({
  tree,
  flatNodes,
  creating,
  onCreateNode,
}: {
  tree: FinanceTree;
  flatNodes: TreeNodeWithChildren[];
  creating: boolean;
  onCreateNode: (payload: {
    name: string;
    parent_id?: UUID | null;
    node_kind: FinanceNodeKind;
    normal_side?: FinanceNormalSide | null;
    currency_code?: string | null;
  }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<UUID | "">("");
  const [nodeKind, setNodeKind] = useState<FinanceNodeKind>("regular");
  const [normalSide, setNormalSide] = useState<FinanceNormalSide | "">("");
  const [currency, setCurrency] = useState(tree.primary_currency);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    onCreateNode({
      name,
      parent_id: parentId || null,
      node_kind: nodeKind,
      normal_side: normalSide || null,
      currency_code: currency || tree.primary_currency,
    });
    setName("");
  };

  return (
    <form className="border border-base-300 rounded-lg bg-base-200/30 p-4 space-y-3" onSubmit={handleSubmit}>
      <h3 className="font-semibold text-base-content">{t("finance.tree.addNode")}</h3>
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
        >
          <option value="">{t("finance.tree.root")}</option>
          {flatNodes.map((node) => (
            <option key={node.id} value={node.id}>
              {"  ".repeat(node.depth)}
              {node.name}
            </option>
          ))}
        </select>
      </label>
      <label className="form-control">
        <span className="label-text">{t("finance.tree.kind")}</span>
        <select
          className="select select-bordered select-sm"
          value={nodeKind}
          onChange={(event) => setNodeKind(event.target.value as FinanceNodeKind)}
        >
          <option value="regular">{t("finance.tree.regular")}</option>
          <option value="rollup">{t("finance.tree.rollup")}</option>
        </select>
      </label>
      <label className="form-control">
        <span className="label-text">{t("finance.tree.normalSide")}</span>
        <select
          className="select select-bordered select-sm"
          value={normalSide}
          onChange={(event) => setNormalSide(event.target.value as FinanceNormalSide | "")}
        >
          <option value="">{t("common.none")}</option>
          <option value="positive">{t("finance.tree.positive")}</option>
          <option value="negative">{t("finance.tree.negative")}</option>
          <option value="neutral">{t("finance.tree.neutral")}</option>
        </select>
      </label>
      <FormField label={t("finance.tree.currency")}>
        <TextInput
          size="sm"
          value={currency}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
        />
      </FormField>
      <ActionButton
        type="submit"
        label={creating ? t("common.creating") : t("finance.tree.createNode")}
        color="primary"
        variant="solid"
        iconName="plus"
        disabled={creating || !name.trim()}
      />
    </form>
  );
}

function TreeNodeRow({
  node,
  deletingNodeId,
  onDeleteNode,
}: {
  node: TreeNodeWithChildren;
  deletingNodeId: UUID | null;
  onDeleteNode: (node: TreeNodeWithChildren) => void;
}) {
  const deleting = deletingNodeId === node.id;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-md border border-base-300 bg-base-200/30 px-2 py-2">
        <div className="min-w-0 flex-1" style={{ paddingLeft: `${node.depth * 12}px` }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{node.name}</span>
            <Badge tone={node.node_kind === "rollup" ? "info" : "neutral"} size="xs" variant="outline">
              {node.node_kind}
            </Badge>
          </div>
          <div className="text-xs text-base-content/60 truncate">
            {node.currency_code || "-"} {node.normal_side ? ` · ${node.normal_side}` : ""}
          </div>
        </div>
        <ActionButton
          label={deleting ? "..." : ""}
          ariaLabel="Delete finance node"
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
      {node.children.map((child) => (
        <TreeNodeRow
          key={child.id}
          node={child}
          deletingNodeId={deletingNodeId}
          onDeleteNode={onDeleteNode}
        />
      ))}
    </div>
  );
}

function SnapshotFormPanel({
  tree,
  preset,
  entryNodes,
  submitting,
  onSubmit,
  onCancel,
}: {
  tree: FinanceTree;
  preset: PresetConfig;
  entryNodes: TreeNodeWithChildren[];
  submitting: boolean;
  onSubmit: (payload: {
    snapshot_ts?: string | null;
    period_start?: string | null;
    period_end?: string | null;
    primary_currency?: string | null;
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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const entries = entryNodes.reduce<FinanceSnapshotEntryCreate[]>((acc, node) => {
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

    onSubmit({
      snapshot_ts: preset.timeMode === "instant" ? localDateTimeToIso(snapshotTs) : null,
      period_start: preset.timeMode === "period" ? dateToStartIso(periodStart) : null,
      period_end: preset.timeMode === "period" ? dateToEndIso(periodEnd) : null,
      primary_currency: tree.primary_currency,
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

        <div className="overflow-x-auto border border-base-300 rounded-lg">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>{t("finance.snapshot.node")}</th>
                <th className="w-36">{t("finance.snapshot.amount")}</th>
                <th className="w-24">{t("finance.snapshot.currency")}</th>
                <th>{t("finance.snapshot.note")}</th>
              </tr>
            </thead>
            <tbody>
              {entryNodes.map((node) => (
                <tr key={node.id}>
                  <td>
                    <div className="font-medium" style={{ paddingLeft: `${node.depth * 12}px` }}>
                      {node.name}
                    </div>
                  </td>
                  <td>
                    <TextInput
                      size="sm"
                      inputMode="decimal"
                      value={amounts[node.id] ?? ""}
                      onChange={(event) =>
                        setAmounts((prev) => ({ ...prev, [node.id]: event.target.value }))
                      }
                      placeholder="0.00"
                    />
                  </td>
                  <td className="text-sm text-base-content/70">
                    {node.currency_code || tree.primary_currency}
                  </td>
                  <td>
                    <TextInput
                      size="sm"
                      value={notes[node.id] ?? ""}
                      onChange={(event) =>
                        setNotes((prev) => ({ ...prev, [node.id]: event.target.value }))
                      }
                    />
                  </td>
                </tr>
              ))}
              {!entryNodes.length ? (
                <tr>
                  <td colSpan={4} className="text-center text-base-content/60 py-6">
                    {t("finance.snapshot.noEntryNodes")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

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
            disabled={submitting || !entryNodes.length}
          />
        </div>
      </form>
    </div>
  );
}

function SnapshotDetail({
  snapshot,
  tree,
}: {
  snapshot: FinanceSnapshot;
  tree: FinanceTree;
}) {
  const { t } = useTranslation();
  const entries = snapshot.entries ?? [];
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

      <div className="overflow-x-auto border border-base-300 rounded-lg">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>{t("finance.snapshot.node")}</th>
              <th>{t("finance.snapshot.amount")}</th>
              <th>{t("finance.snapshot.currency")}</th>
              <th>{t("finance.snapshot.note")}</th>
              <th>{t("finance.snapshot.source")}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="font-medium">{entry.node_name ?? entry.node_id}</td>
                <td className="tabular-nums">
                  {formatMoney(entry.amount_converted, snapshot.primary_currency)}
                </td>
                <td>{entry.currency_code}</td>
                <td>{entry.note || "-"}</td>
                <td>
                  <Badge
                    tone={entry.is_auto_generated ? "info" : "neutral"}
                    variant="outline"
                    size="xs"
                  >
                    {entry.is_auto_generated ? t("finance.snapshot.auto") : t("finance.snapshot.manual")}
                  </Badge>
                </td>
              </tr>
            ))}
            {!entries.length ? (
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

export default FinancePage;
