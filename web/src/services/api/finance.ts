import type { ListResponse } from "@/types/pagination";
import type { UUID } from "@/types/primitive";
import { http } from "./client";
import { ENDPOINTS } from "./endpoints";

export type FinancePurpose = "balance" | "cashflow" | "custom";
export type FinanceTimeMode = "instant" | "period";

export interface FinanceTreeNode {
  id: UUID;
  tree_id: UUID;
  parent_id: UUID | null;
  name: string;
  currency_code: string | null;
  path: string;
  depth: number;
  display_order: number;
  children_count: number;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface FinanceTree {
  id: UUID;
  name: string;
  purpose: FinancePurpose;
  time_mode: FinanceTimeMode;
  primary_currency: string;
  display_order: number;
  is_default: boolean;
  metadata?: Record<string, unknown> | null;
  nodes?: FinanceTreeNode[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface FinanceSnapshotEntry {
  id: UUID;
  snapshot_id: UUID;
  node_id: UUID;
  node_name: string | null;
  node_path: string | null;
  amount: string;
  currency_code: string;
  amount_converted: string;
  note?: string | null;
  is_auto_generated: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface FinanceSnapshot {
  id: UUID;
  tree_id: UUID;
  tree_name?: string | null;
  purpose?: FinancePurpose | null;
  time_mode?: FinanceTimeMode | null;
  snapshot_ts: string | null;
  period_start: string | null;
  period_end: string | null;
  primary_currency: string;
  rate_snapshot_id?: UUID | null;
  rate_snapshot_policy: string;
  total_positive: string;
  total_negative: string;
  net_amount: string;
  exchange_rates?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  note?: string | null;
  entries?: FinanceSnapshotEntry[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface FinanceRateSnapshotEntry {
  id: UUID;
  rate_snapshot_id: UUID;
  base_currency: string;
  quote_currency: string;
  rate: string;
  source?: string | null;
  captured_at?: string | null;
  is_derived: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface FinanceRateSnapshot {
  id: UUID;
  captured_at: string;
  primary_currency: string;
  source: string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  entries?: FinanceRateSnapshotEntry[];
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface FinanceTreeCreate {
  name: string;
  purpose: FinancePurpose;
  time_mode?: FinanceTimeMode;
  primary_currency?: string;
  display_order?: number;
  is_default?: boolean;
}

export interface FinanceNodeCreate {
  name: string;
  parent_id?: UUID | null;
  currency_code?: string | null;
  display_order?: number;
}

export interface FinanceNodeUpdate {
  name?: string;
  currency_code?: string | null;
  display_order?: number;
}

export interface FinanceSnapshotEntryCreate {
  node_id: UUID;
  amount: string;
  currency_code?: string | null;
  note?: string | null;
}

export interface FinanceSnapshotCreate {
  snapshot_ts?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  primary_currency?: string | null;
  rate_snapshot_id?: UUID | null;
  note?: string | null;
  entries: FinanceSnapshotEntryCreate[];
}

export interface FinanceSnapshotUpdate {
  rate_snapshot_id?: UUID | null;
}

export interface FinanceRateSnapshotEntryCreate {
  base_currency: string;
  quote_currency?: string | null;
  rate: string;
  source?: string | null;
  captured_at?: string | null;
  is_derived?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface FinanceRateSnapshotCreate {
  captured_at?: string | null;
  primary_currency: string;
  source?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  entries: FinanceRateSnapshotEntryCreate[];
}

export type FinanceTreeListResponse = ListResponse<
  FinanceTree,
  { purpose?: string | null; include_deleted?: boolean }
>;
export type FinanceSnapshotListResponse = ListResponse<
  FinanceSnapshot,
  { tree_id?: UUID | null }
>;
export type FinanceRateSnapshotListResponse = ListResponse<
  FinanceRateSnapshot,
  { primary_currency?: string | null; include_deleted?: boolean }
>;

export const financeApi = {
  listTrees: (
    params: { purpose?: FinancePurpose; page?: number; size?: number } = {},
  ) =>
    http.get<FinanceTreeListResponse>(ENDPOINTS.FINANCE.TREES, {
      purpose: params.purpose,
      page: params.page ?? 1,
      size: params.size ?? 100,
    }),
  createTree: (payload: FinanceTreeCreate) =>
    http.post<FinanceTree>(ENDPOINTS.FINANCE.TREES, payload),
  listRateSnapshots: (
    params: { primary_currency?: string; page?: number; size?: number } = {},
  ) =>
    http.get<FinanceRateSnapshotListResponse>(
      ENDPOINTS.FINANCE.RATE_SNAPSHOTS,
      {
        primary_currency: params.primary_currency,
        page: params.page ?? 1,
        size: params.size ?? 50,
      },
    ),
  createRateSnapshot: (payload: FinanceRateSnapshotCreate) =>
    http.post<FinanceRateSnapshot>(
      ENDPOINTS.FINANCE.RATE_SNAPSHOTS,
      payload,
    ),
  getRateSnapshot: (rateSnapshotId: UUID) =>
    http.get<FinanceRateSnapshot>(
      ENDPOINTS.FINANCE.RATE_SNAPSHOT_BY_ID(rateSnapshotId),
    ),
  ensureDefaultTree: (purpose: FinancePurpose, primaryCurrency = "USD") =>
    http.post<FinanceTree>(
      ENDPOINTS.FINANCE.ENSURE_DEFAULT_TREE,
      undefined,
      {
        purpose,
        primary_currency: primaryCurrency,
      },
    ),
  getTree: (treeId: UUID) =>
    http.get<FinanceTree>(ENDPOINTS.FINANCE.TREE_BY_ID(treeId)),
  createNode: (treeId: UUID, payload: FinanceNodeCreate) =>
    http.post<FinanceTreeNode>(ENDPOINTS.FINANCE.TREE_NODES(treeId), payload),
  updateNode: (nodeId: UUID, payload: FinanceNodeUpdate) =>
    http.patch<FinanceTreeNode>(ENDPOINTS.FINANCE.NODE_BY_ID(nodeId), payload),
  deleteNode: (nodeId: UUID) =>
    http.delete<void>(ENDPOINTS.FINANCE.NODE_BY_ID(nodeId)),
  listSnapshots: (treeId: UUID, page = 1, size = 50) =>
    http.get<FinanceSnapshotListResponse>(
      ENDPOINTS.FINANCE.TREE_SNAPSHOTS(treeId),
      { page, size },
    ),
  createSnapshot: (treeId: UUID, payload: FinanceSnapshotCreate) =>
    http.post<FinanceSnapshot>(
      ENDPOINTS.FINANCE.TREE_SNAPSHOTS(treeId),
      payload,
    ),
  updateSnapshot: (snapshotId: UUID, payload: FinanceSnapshotUpdate) =>
    http.patch<FinanceSnapshot>(ENDPOINTS.FINANCE.SNAPSHOT_BY_ID(snapshotId), payload),
  getSnapshot: (snapshotId: UUID) =>
    http.get<FinanceSnapshot>(ENDPOINTS.FINANCE.SNAPSHOT_BY_ID(snapshotId)),
};
