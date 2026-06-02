import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

import ActionButton from "@/components/ActionButton";
import MetricCard from "@/components/finance/MetricCard";
import SnapshotNavigatorBase from "@/components/finance/SnapshotNavigatorBase";
import type {
  BalanceSnapshotDetail,
  BalanceSnapshotSummary,
  FinanceAccount,
  SnapshotMetric,
} from "@/services/api/finance";
import SnapshotAccountTable, {
  type AccountTreeNode,
} from "./SnapshotAccountTable";
import {
  isNegativeDecimal,
  sumDecimalStrings,
} from "@/features/finance/shared";
import { formatDateTime } from "@/utils/datetime";

const ZERO_DECIMAL = "0.00";

interface SnapshotNavigatorProps {
  snapshot: BalanceSnapshotSummary;
  metrics?: SnapshotMetric;
  primaryCurrency: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** 1-based position for display */
  currentPosition: number;
  total: number;
  onEdit?: (snapshot: BalanceSnapshotSummary) => void;
  onDelete?: (snapshot: BalanceSnapshotSummary) => void;
  actionsDisabled?: boolean;
  showNavigationControls?: boolean;
  actionSlot?: ReactNode;
}

export function SnapshotNavigator({
  snapshot,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  currentPosition,
  total,
  onEdit,
  onDelete,
  actionsDisabled = false,
  showNavigationControls = true,
  actionSlot,
}: SnapshotNavigatorProps) {
  const { t } = useTranslation();
  const timestampLabel = formatDateTime(snapshot.snapshot_ts);
  const positionLabel = t("finance.snapshotPosition", {
    index: currentPosition,
    total,
  });

  let actions: ReactNode = actionSlot;
  if (!actions && (onEdit || onDelete)) {
    actions = (
      <div className="flex items-center gap-2">
        {onEdit ? (
          <ActionButton
            label={t("common.edit")}
            onClick={() => onEdit(snapshot)}
            size="sm"
            variant="outline"
            disabled={actionsDisabled}
          />
        ) : null}
        {onDelete ? (
          <ActionButton
            label={t("common.delete")}
            onClick={() => onDelete(snapshot)}
            size="sm"
            variant="ghost"
            color="error"
            disabled={actionsDisabled}
          />
        ) : null}
      </div>
    );
  }

  return (
    <SnapshotNavigatorBase
      title={timestampLabel}
      positionLabel={showNavigationControls ? positionLabel : undefined}
      hasPrevious={hasPrevious}
      hasNext={hasNext}
      onPrevious={onPrevious}
      onNext={onNext}
      showNavigationControls={showNavigationControls}
      previousAriaLabel={t("finance.previousSnapshot")}
      nextAriaLabel={t("finance.nextSnapshot")}
      rightSlot={actions}
      rightSlotClassName="flex flex-col items-end gap-2 text-right sm:flex-row sm:items-center sm:gap-3"
    />
  );
}

interface SnapshotDetailCardProps {
  detail: BalanceSnapshotDetail;
  accountTree: FinanceAccount[];
  treeName: string | null;
}

export function SnapshotDetailCard({
  detail,
  accountTree,
  treeName,
}: SnapshotDetailCardProps) {
  const { t } = useTranslation();
  const accounts = useMemo(() => accountTree ?? [], [accountTree]);
  const detailMap = useMemo(() => {
    const map = new Map<string, BalanceSnapshotDetail["accounts"][number]>();
    detail.accounts.forEach((entry) => {
      map.set(entry.account_id, entry);
    });
    return map;
  }, [detail.accounts]);
  const tableTree = useMemo(() => {
    if (accounts.length) {
      return buildSnapshotDisplayTree(accounts, detailMap);
    }
    return buildSnapshotDisplayTreeFromEntries(detail.accounts);
  }, [accounts, detail.accounts, detailMap]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    collectDisplayNodeIds(tableTree, initial);
    return initial;
  });

  useEffect(() => {
    const next = new Set<string>();
    collectDisplayNodeIds(tableTree, next);
    setExpanded(next);
  }, [tableTree]);

  const toggleNode = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const columns = useMemo(
    () => [
      {
        key: "account",
        header: t("finance.tableAccount"),
        className: "w-[40%] min-w-[12rem]",
      },
      {
        key: "currency",
        header: t("finance.tableOriginalCurrency"),
        className: "w-[12%] whitespace-nowrap",
      },
      {
        key: "original",
        header: t("finance.tableOriginal"),
        className: "min-w-[10rem]",
      },
      {
        key: "converted",
        header: `${t("finance.tableConverted")} (${detail.primary_currency})`,
        className: "min-w-[10rem]",
      },
      {
        key: "note",
        header: t("finance.tableNote"),
        className: "min-w-[12rem]",
      },
    ],
    [detail.primary_currency, t],
  );
  const snapshotNote = detail.note?.trim() ?? "";

  const renderCells = useCallback(
    ({
      node,
    }: {
      node: SnapshotDisplayNode;
      depth: number;
      hasChildren: boolean;
      isExpanded: boolean;
    }) => {
      const originalNegative = isNegativeDecimal(node.originalBalance);
      const convertedNegative = isNegativeDecimal(node.convertedBalance);
      return [
        {
          key: `${node.id}-currency`,
          content: node.currency_code,
          className: "text-base-content/70",
        },
        {
          key: `${node.id}-original`,
          content: node.originalBalance ? (
            <span
              className={[
                "font-medium",
                originalNegative ? "text-error" : "text-base-content",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {node.originalBalance}
            </span>
          ) : (
            "—"
          ),
        },
        {
          key: `${node.id}-converted`,
          content: node.convertedBalance ? (
            <span
              className={[
                "font-semibold",
                convertedNegative ? "text-error" : "text-base-content",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {node.convertedBalance}
            </span>
          ) : (
            "—"
          ),
        },
        {
          key: `${node.id}-note`,
          content: node.note ? (
            <span className="text-xs text-base-content/70 break-words">
              {node.note}
            </span>
          ) : (
            <span className="text-base-content/40">—</span>
          ),
        },
      ];
    },
    [],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          title={t("finance.metricAssets")}
          value={detail.metrics.total_assets}
          currency={detail.primary_currency}
          fallbackValue={ZERO_DECIMAL}
        />
        <MetricCard
          title={t("finance.metricLiabilities")}
          value={detail.metrics.total_liabilities}
          currency={detail.primary_currency}
          fallbackValue={ZERO_DECIMAL}
        />
        <MetricCard
          title={t("finance.metricNetWorth")}
          value={detail.metrics.net_worth}
          currency={detail.primary_currency}
          fallbackValue={ZERO_DECIMAL}
          highlighted
        />
      </div>

      <div className="rounded-lg border border-dashed border-base-200 p-3 text-sm text-base-content/70">
        <p className="font-medium text-base-content">
          {t("finance.accountTreeLabel")}
        </p>
        <p className="mt-1 text-sm text-base-content/80">{treeName || "—"}</p>
      </div>

      <div className="rounded-lg border border-dashed border-base-200 p-3 text-sm text-base-content/70">
        <p className="font-medium text-base-content">
          {t("finance.snapshotNoteLabel")}
        </p>
        <p className="mt-1 whitespace-pre-wrap">
          {snapshotNote || t("common.none")}
        </p>
      </div>

      <div className="rounded-lg border border-base-200">
        {tableTree.length ? (
          <SnapshotAccountTable
            columns={columns}
            accountTree={tableTree}
            expanded={expanded}
            onToggle={toggleNode}
            renderCells={renderCells}
            t={t}
          />
        ) : (
          <div className="px-4 py-6 text-sm text-base-content/60">
            {t("finance.snapshotDetailPlaceholder")}
          </div>
        )}
      </div>

      {detail.exchange_rates.length ? (
        <div className="rounded-lg border border-dashed border-base-200 p-3 text-sm text-base-content/70">
          <p className="font-medium text-base-content">
            {t("finance.exchangeRateList")}
          </p>
          <ul className="mt-2 space-y-1">
            {detail.exchange_rates.map((rate) => (
              <li key={rate.id}>
                1 {rate.quote_currency} = {rate.rate} {detail.primary_currency}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

interface SnapshotDisplayNode extends AccountTreeNode {
  originalBalance: string;
  convertedBalance: string;
  note: string | null;
  children: SnapshotDisplayNode[];
  depth?: number;
}

function buildSnapshotDisplayTree(
  accounts: FinanceAccount[],
  detailMap: Map<string, BalanceSnapshotDetail["accounts"][number]>,
): SnapshotDisplayNode[] {
  return accounts.map((account) => {
    const entry = detailMap.get(account.id);
    const children = buildSnapshotDisplayTree(
      account.children ?? [],
      detailMap,
    );

    let converted = entry?.balance_converted ?? "";
    if (!converted) {
      const { sum, hasValue } = sumDecimalStrings(
        children.map((child) => child.convertedBalance),
      );
      if (hasValue) {
        converted = sum;
      }
    }

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency_code: account.currency_code,
      originalBalance: entry?.balance_raw ?? "",
      convertedBalance: converted,
      note: entry?.note ?? null,
      children,
    };
  });
}

function buildSnapshotDisplayTreeFromEntries(
  entries: BalanceSnapshotDetail["accounts"],
): SnapshotDisplayNode[] {
  const roots: SnapshotDisplayNode[] = [];
  const stack: SnapshotDisplayNode[] = [];
  const ordered = [...entries].sort((a, b) => a.path.localeCompare(b.path));

  ordered.forEach((entry) => {
    const node: SnapshotDisplayNode = {
      id: entry.account_id,
      name: entry.account_name,
      type: entry.type,
      currency_code: entry.currency_code,
      originalBalance: entry.balance_raw ?? "",
      convertedBalance: entry.balance_converted ?? "",
      note: entry.note ?? null,
      children: [],
      depth: entry.depth,
    };

    while (
      stack.length &&
      (stack[stack.length - 1]?.depth ?? 0) >= entry.depth
    ) {
      stack.pop();
    }

    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  const removeDepth = (nodes: SnapshotDisplayNode[]) => {
    nodes.forEach((node) => {
      node.depth = undefined;
      if (node.children.length) {
        removeDepth(node.children);
      }
    });
  };

  removeDepth(roots);
  return roots;
}

function collectDisplayNodeIds(
  nodes: SnapshotDisplayNode[],
  target: Set<string>,
): void {
  nodes.forEach((node) => {
    target.add(node.id);
    if (node.children?.length) {
      collectDisplayNodeIds(node.children, target);
    }
  });
}
