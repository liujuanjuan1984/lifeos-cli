import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import ActionButton from "@/components/ActionButton";
import Badge from "@/components/common/Badge";
import ErrorDisplay from "@/components/ErrorDisplay";
import LoadingSpinner from "@/components/LoadingSpinner";
import { FormField, SegmentedControl, TextArea, TextInput } from "@/components/forms";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { useToast } from "@/contexts/ToastContext";
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
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            value={activePurpose}
            onChange={(value) => setActivePurpose(value as FinancePurpose)}
            options={PRESETS.map((item) => ({
              value: item.purpose,
              label: t(item.titleKey),
            }))}
            inactiveVariant="outline"
          />
        </div>
        <FinancePresetPanel key={preset.purpose} preset={preset} />
      </div>
    </PageLayout>
  );
}

function FinancePresetPanel({ preset }: { preset: PresetConfig }) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<UUID | null>(null);

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

  const selectedSnapshotQuery = useQuery({
    queryKey: financeKeys.snapshot(selectedSnapshotId),
    queryFn: () => financeApi.getSnapshot(selectedSnapshotId!),
    enabled: Boolean(selectedSnapshotId),
  });

  const latestSnapshot = snapshotsQuery.data?.items[0] ?? null;
  const selectedSnapshot = selectedSnapshotQuery.data ?? latestSnapshot;

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

  return (
    <div className="space-y-5">
      <PresetHeader preset={preset} tree={tree} latestSnapshot={latestSnapshot} />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_360px] gap-5 items-start">
        <FinanceTreePanel
          tree={tree}
          treeNodes={treeNodes}
          flatNodes={flatNodes}
          preset={preset}
          creating={createNodeMutation.isPending}
          deletingNodeId={
            deleteNodeMutation.variables &&
            deleteNodeMutation.isPending
              ? deleteNodeMutation.variables
              : null
          }
          onCreateNode={(payload) => createNodeMutation.mutate(payload)}
          onDeleteNode={(nodeId) => deleteNodeMutation.mutate(nodeId)}
        />

        <SnapshotFormPanel
          tree={tree}
          preset={preset}
          entryNodes={entryNodes}
          submitting={createSnapshotMutation.isPending}
          onSubmit={(payload) => createSnapshotMutation.mutate(payload)}
        />

        <SnapshotHistoryPanel
          tree={tree}
          snapshots={snapshotsQuery.data?.items ?? []}
          selectedSnapshot={selectedSnapshot}
          selectedSnapshotLoading={selectedSnapshotQuery.isLoading}
          selectedSnapshotId={selectedSnapshotId}
          onSelectSnapshot={setSelectedSnapshotId}
        />
      </div>
    </div>
  );
}

function PresetHeader({
  preset,
  tree,
  latestSnapshot,
}: {
  preset: PresetConfig;
  tree: FinanceTree;
  latestSnapshot: FinanceSnapshot | null;
}) {
  const { t } = useTranslation();
  const currency = tree.primary_currency;
  return (
    <section className="border border-base-300 bg-base-100 rounded-lg p-4">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-base-content">
              {t(preset.titleKey)}
            </h2>
            <Badge tone="primary" variant="outline" size="sm">
              {tree.time_mode}
            </Badge>
            <Badge tone="neutral" variant="outline" size="sm">
              {currency}
            </Badge>
          </div>
          <p className="text-sm text-base-content/70 max-w-3xl">
            {t(preset.descriptionKey)}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 min-w-full sm:min-w-[420px]">
          <Metric label={t("finance.metrics.positive")} value={formatMoney(latestSnapshot?.total_positive, currency)} />
          <Metric label={t("finance.metrics.negative")} value={formatMoney(latestSnapshot?.total_negative, currency)} />
          <Metric label={t("finance.metrics.net")} value={formatMoney(latestSnapshot?.net_amount, currency)} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-base-300 rounded-lg bg-base-200/40 px-3 py-2 min-w-0">
      <div className="text-xs uppercase tracking-wide text-base-content/60 truncate">
        {label}
      </div>
      <div className="font-semibold tabular-nums text-base-content truncate">
        {value}
      </div>
    </div>
  );
}

function FinanceTreePanel({
  tree,
  treeNodes,
  flatNodes,
  preset,
  creating,
  deletingNodeId,
  onCreateNode,
  onDeleteNode,
}: {
  tree: FinanceTree;
  treeNodes: TreeNodeWithChildren[];
  flatNodes: TreeNodeWithChildren[];
  preset: PresetConfig;
  creating: boolean;
  deletingNodeId: UUID | null;
  onCreateNode: (payload: {
    name: string;
    parent_id?: UUID | null;
    node_kind: FinanceNodeKind;
    normal_side?: FinanceNormalSide | null;
    currency_code?: string | null;
  }) => void;
  onDeleteNode: (nodeId: UUID) => void;
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
    <section className="border border-base-300 bg-base-100 rounded-lg p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base-content">{t("finance.tree.title")}</h3>
        <p className="text-sm text-base-content/60">{tree.name}</p>
      </div>

      <div className="max-h-[360px] overflow-y-auto pr-1 space-y-2">
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

      <form className="border-t border-base-300 pt-4 space-y-3" onSubmit={handleSubmit}>
        <FormField label={t("finance.tree.addNode")}>
          <TextInput
            size="sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("finance.tree.nodeNamePlaceholder")}
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
        </div>
        <ActionButton
          type="submit"
          label={creating ? t("common.creating") : t("finance.tree.createNode")}
          color="primary"
          variant="solid"
          iconName="plus"
          disabled={creating || !name.trim()}
        />
      </form>
      <p className="text-xs text-base-content/60">{t(`finance.${preset.purpose}.treeHint`)}</p>
    </section>
  );
}

function TreeNodeRow({
  node,
  deletingNodeId,
  onDeleteNode,
}: {
  node: TreeNodeWithChildren;
  deletingNodeId: UUID | null;
  onDeleteNode: (nodeId: UUID) => void;
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
          onClick={() => onDeleteNode(node.id)}
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
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [snapshotTs, setSnapshotTs] = useState(nowDateTimeLocal());
  const [periodStart, setPeriodStart] = useState(todayDate().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(todayDate());
  const [amounts, setAmounts] = useState<SnapshotAmountState>({});
  const [notes, setNotes] = useState<SnapshotNoteState>({});
  const [snapshotNote, setSnapshotNote] = useState("");

  const handleAmountChange = (nodeId: UUID, value: string) => {
    setAmounts((prev) => ({ ...prev, [nodeId]: value }));
  };

  const handleNoteChange = (nodeId: UUID, value: string) => {
    setNotes((prev) => ({ ...prev, [nodeId]: value }));
  };

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
      snapshot_ts:
        preset.timeMode === "instant" ? localDateTimeToIso(snapshotTs) : null,
      period_start:
        preset.timeMode === "period" ? dateToStartIso(periodStart) : null,
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
    <section className="border border-base-300 bg-base-100 rounded-lg p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base-content">{t("finance.snapshot.formTitle")}</h3>
        <p className="text-sm text-base-content/60">{t(preset.amountLabelKey)}</p>
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
                      onChange={(event) => handleAmountChange(node.id, event.target.value)}
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
                      onChange={(event) => handleNoteChange(node.id, event.target.value)}
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
    </section>
  );
}

function SnapshotHistoryPanel({
  tree,
  snapshots,
  selectedSnapshot,
  selectedSnapshotLoading,
  selectedSnapshotId,
  onSelectSnapshot,
}: {
  tree: FinanceTree;
  snapshots: FinanceSnapshot[];
  selectedSnapshot: FinanceSnapshot | null;
  selectedSnapshotLoading: boolean;
  selectedSnapshotId: UUID | null;
  onSelectSnapshot: (snapshotId: UUID) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="border border-base-300 bg-base-100 rounded-lg p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-base-content">{t("finance.history.title")}</h3>
        <p className="text-sm text-base-content/60">{t("finance.history.subtitle")}</p>
      </div>

      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {snapshots.map((snapshot) => (
          <button
            type="button"
            key={snapshot.id}
            className={[
              "w-full text-left rounded-md border px-3 py-2 hover:bg-base-200",
              selectedSnapshotId === snapshot.id
                ? "border-primary bg-primary/10"
                : "border-base-300 bg-base-200/30",
            ].join(" ")}
            onClick={() => onSelectSnapshot(snapshot.id)}
          >
            <div className="font-medium text-sm">
              {snapshot.period_start && snapshot.period_end
                ? `${formatDate(snapshot.period_start)} - ${formatDate(snapshot.period_end)}`
                : snapshot.snapshot_ts
                  ? formatDateTime(snapshot.snapshot_ts)
                  : snapshot.created_at}
            </div>
            <div className="text-xs text-base-content/60">
              {formatMoney(snapshot.net_amount, snapshot.primary_currency)}
            </div>
          </button>
        ))}
        {!snapshots.length ? (
          <div className="text-sm text-base-content/60">{t("finance.history.empty")}</div>
        ) : null}
      </div>

      <div className="border-t border-base-300 pt-4">
        {selectedSnapshotLoading ? (
          <LoadingSpinner size="sm" />
        ) : selectedSnapshot ? (
          <SnapshotDetail snapshot={selectedSnapshot} tree={tree} />
        ) : (
          <div className="text-sm text-base-content/60">{t("finance.history.noSelection")}</div>
        )}
      </div>
    </section>
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Metric
          label={t("finance.metrics.net")}
          value={formatMoney(snapshot.net_amount, tree.primary_currency)}
        />
        <Metric
          label={t("finance.metrics.entries")}
          value={String(entries.filter((entry) => !entry.is_auto_generated).length)}
        />
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-md border border-base-300 bg-base-200/30 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate">
                {entry.node_name ?? entry.node_id}
              </span>
              <Badge
                tone={entry.is_auto_generated ? "info" : "neutral"}
                variant="outline"
                size="xs"
              >
                {entry.is_auto_generated ? t("finance.snapshot.auto") : t("finance.snapshot.manual")}
              </Badge>
            </div>
            <div className="text-sm tabular-nums">
              {formatMoney(entry.amount_converted, snapshot.primary_currency)}
            </div>
            {entry.note ? (
              <div className="text-xs text-base-content/60 mt-1">{entry.note}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default FinancePage;
