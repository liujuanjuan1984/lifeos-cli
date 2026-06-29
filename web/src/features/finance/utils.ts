import type {
  FinanceAsset,
  FinanceRateSnapshot,
  FinanceSnapshot,
  FinanceTreeNode,
} from "@/services/api/finance";
import type { UUID } from "@/types/primitive";
import { formatDate, formatDateTime } from "@/utils/datetime";

export type PresetConfig = {
  report: "balance" | "cashflow";
  titleKey: string;
  descriptionKey: string;
  timeMode: "instant" | "period";
};

export type FinanceTab = PresetConfig["report"] | "rates" | "trees";
export type FinanceToolbarTab = FinanceTab | "assets";

export const FINANCE_TOOLBAR_ORDER = [
  "assets",
  "trees",
  "rates",
  "balance",
  "cashflow",
] as const satisfies readonly FinanceToolbarTab[];

export type TreeNodeWithChildren = FinanceTreeNode & {
  children: TreeNodeWithChildren[];
};

export type SnapshotAmountState = Record<UUID, string>;
export type SnapshotNoteState = Record<UUID, string>;

export type RateSnapshotFormMode = "create" | "edit";

export type RateRowState = {
  baseAmount: string;
  baseCurrency: string;
  quoteAmount: string;
  quoteCurrency: string;
};

export type FinanceNodeFormState =
  | { mode: "create"; parentId?: UUID | null }
  | { mode: "edit"; node: TreeNodeWithChildren };

export const todayDate = () => new Date().toISOString().slice(0, 10);

export const nowDateTimeLocal = () => {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
};

export const localDateTimeToIso = (value: string) => {
  if (!value) return null;
  return new Date(value).toISOString();
};

export const isoToDateTimeLocal = (value?: string | null) => {
  if (!value) return nowDateTimeLocal();
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export const isoToDateInput = (value?: string | null) => {
  if (!value) return todayDate();
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
};

export const dateToStartIso = (value: string) => {
  if (!value) return null;
  return new Date(`${value}T00:00:00`).toISOString();
};

export const dateToEndIso = (value: string) => {
  if (!value) return null;
  return new Date(`${value}T23:59:59`).toISOString();
};

export const assetDecimalPlaces = (assets: FinanceAsset[], currency = "") => {
  const normalized = currency.toUpperCase();
  const places = assets.find((asset) => asset.code === normalized)?.decimal_places ?? 2;
  return Math.min(8, Math.max(0, places));
};

export const formatNumberForAsset = (
  value: number,
  currency: string,
  assets: FinanceAsset[] = [],
) =>
  value.toLocaleString(undefined, {
    useGrouping: false,
    minimumFractionDigits: assetDecimalPlaces(assets, currency),
    maximumFractionDigits: assetDecimalPlaces(assets, currency),
  });

export const formatAmountForAsset = (
  value: string,
  currency: string,
  assets: FinanceAsset[] = [],
) => {
  if (!value.trim()) {
    return value;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return formatNumberForAsset(numeric, currency, assets);
};

export const formatMoney = (
  value?: string | null,
  currency = "",
  assets: FinanceAsset[] = [],
) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    return `${value ?? "0"} ${currency}`.trim();
  }
  return `${formatNumberForAsset(numeric, currency, assets)} ${currency}`.trim();
};

export const buildTree = (nodes: FinanceTreeNode[]): TreeNodeWithChildren[] => {
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

export const flattenTree = (nodes: TreeNodeWithChildren[]): TreeNodeWithChildren[] => {
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

export function snapshotLabel(snapshot: FinanceSnapshot) {
  const title = snapshot.title?.trim();
  if (title) {
    return title;
  }
  if (snapshot.period_start && snapshot.period_end) {
    return `${formatDate(snapshot.period_start)} - ${formatDate(snapshot.period_end)}`;
  }
  if (snapshot.snapshot_ts) {
    return formatDateTime(snapshot.snapshot_ts);
  }
  return snapshot.created_at;
}

export function rateSnapshotLabel(snapshot: FinanceRateSnapshot) {
  const pairs = (snapshot.entries ?? [])
    .map((entry) => `${entry.base_currency}/${entry.quote_currency}`)
    .join(", ");
  return pairs
    ? `${formatDateTime(snapshot.captured_at)} · ${pairs}`
    : formatDateTime(snapshot.captured_at);
}

export function getRequiredRateCurrencies(
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
