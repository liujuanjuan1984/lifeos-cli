import { http } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

export interface CashflowSourceNode {
  id: UUID;
  tree_id: UUID;
  parent_id: UUID | null;
  name: string;
  path: string;
  depth: number;
  sort_order: number | null;
  metadata: Record<string, unknown> | null;
  kind: "regular" | "billing";
  is_rollup: boolean;
  children_count: number;
  currency_code: string;
  billing_cycle_type: "day" | "week" | "month" | "year" | null;
  billing_cycle_interval: number | null;
  billing_anchor_day: number | null;
  billing_anchor_date: string | null;
  billing_post_to: "start" | "end" | null;
  billing_default_amount: string | null;
  billing_default_note: string | null;
  billing_requires_manual_input: boolean;
  aggregated_amount: string | null;
  children: CashflowSourceNode[];
}

export interface CashflowSourceTreeResponse {
  sources: CashflowSourceNode[];
}

export type CashflowSourceCreatePayload = {
  name: string;
  parent_id?: UUID | null;
  tree_id?: UUID | null;
  metadata?: Record<string, unknown> | null;
  sort_order?: number | null;
  kind?: "regular" | "billing";
  currency_code?: string;
  billing_cycle_type?: "day" | "week" | "month" | "year" | null;
  billing_cycle_interval?: number | null;
  billing_anchor_day?: number | null;
  billing_anchor_date?: string | null;
  billing_post_to?: "start" | "end" | null;
  billing_default_amount?: string | null;
  billing_default_note?: string | null;
  billing_requires_manual_input?: boolean;
};

export type CashflowSourceUpdatePayload = Partial<CashflowSourceCreatePayload>;

export interface CashflowSnapshotEntryInput {
  id: UUID;
  amount: string;
  currency_code?: string;
  note?: string;
}

export interface CashflowSnapshotCreatePayload {
  primary_currency?: string;
  tree_id?: UUID | null;
  period_start: string;
  period_end: string;
  entries: CashflowSnapshotEntryInput[];
  exchange_rates?: Array<{ quote_currency: string; rate: string }>;
  note?: string;
}

export interface CashflowSnapshotEntry {
  source_id: UUID;
  source_name: string;
  amount: string;
  currency_code: string;
  note: string | null;
  is_auto_generated: boolean;
}

export interface CashflowSnapshotSummary {
  id: UUID;
  period_start: string;
  period_end: string;
  primary_currency: string;
  tree_id: UUID;
  snapshot_ts?: string | null;
  total_income: string;
  total_expense: string;
  total_positive: string;
  total_negative: string;
  net_cashflow: string;
  summary: Record<string, unknown> | null;
  note: string | null;
}

export interface CashflowSnapshotListMeta {
  tree_id?: UUID | null;
  start_time?: string | null;
  end_time?: string | null;
}

export type CashflowSnapshotListResponse = ListResponse<
  CashflowSnapshotSummary,
  CashflowSnapshotListMeta
>;

export interface CashflowSnapshotDetail extends CashflowSnapshotSummary {
  entries: CashflowSnapshotEntry[];
  exchange_rates?: Array<{ quote_currency: string; rate: string }>;
}

export type CashflowSnapshotUpdatePayload = CashflowSnapshotCreatePayload;

export interface CashflowSnapshotComparison {
  base_snapshot_id: UUID;
  compare_snapshot_id: UUID;
  base_period_start: string;
  base_period_end: string;
  compare_period_start: string;
  compare_period_end: string;
  base_totals: CashflowSnapshotSummary;
  compare_totals: CashflowSnapshotSummary;
  source_changes: Array<{
    source_id: UUID;
    source_name: string;
    previous_amount: string;
    current_amount: string;
    delta: string;
  }>;
}

export const getCashflowSources = (params?: { tree_id?: UUID | null }) =>
  http.get<CashflowSourceTreeResponse>(
    ENDPOINTS.FINANCE.CASHFLOW.SOURCES,
    params
      ? {
          ...params,
          tree_id: params.tree_id ?? undefined,
        }
      : undefined,
  );

export interface CashflowSourceTreeItem {
  id: UUID;
  name: string;
  is_default: boolean;
  display_order: number | null;
}

export interface CashflowSourceTreeCreatePayload {
  name: string;
  is_default?: boolean;
  display_order?: number | null;
}

export interface CashflowSourceTreeUpdatePayload {
  name?: string;
  is_default?: boolean;
  display_order?: number | null;
}

export const listCashflowTrees = () =>
  http.get<CashflowSourceTreeItem[]>(ENDPOINTS.FINANCE.CASHFLOW.TREES);

export const createCashflowTree = (payload: CashflowSourceTreeCreatePayload) =>
  http.post<CashflowSourceTreeItem>(ENDPOINTS.FINANCE.CASHFLOW.TREES, payload);

export const updateCashflowTree = (
  id: UUID,
  payload: CashflowSourceTreeUpdatePayload,
) =>
  http.patch<CashflowSourceTreeItem>(
    ENDPOINTS.FINANCE.CASHFLOW.TREE_BY_ID(id),
    payload,
  );

export const deleteCashflowTree = (id: UUID) =>
  http.delete<void>(ENDPOINTS.FINANCE.CASHFLOW.TREE_BY_ID(id));

export const createCashflowSource = (payload: CashflowSourceCreatePayload) =>
  http.post<CashflowSourceNode>(ENDPOINTS.FINANCE.CASHFLOW.SOURCES, payload);

export const updateCashflowSource = (
  id: UUID,
  payload: CashflowSourceUpdatePayload,
) =>
  http.patch<CashflowSourceNode>(
    `${ENDPOINTS.FINANCE.CASHFLOW.SOURCES}/${id}`,
    payload,
  );

export const deleteCashflowSource = (id: UUID) =>
  http.delete<void>(`${ENDPOINTS.FINANCE.CASHFLOW.SOURCES}/${id}`);

export const listCashflowSnapshots = (params?: {
  page?: number;
  size?: number;
  tree_id?: UUID | null;
}) =>
  http.get<CashflowSnapshotListResponse>(
    ENDPOINTS.FINANCE.CASHFLOW.SNAPSHOTS,
    params
      ? {
          ...params,
          tree_id: params.tree_id ?? undefined,
        }
      : undefined,
  );

export const createCashflowSnapshot = (
  payload: CashflowSnapshotCreatePayload,
) =>
  http.post<CashflowSnapshotDetail>(
    ENDPOINTS.FINANCE.CASHFLOW.SNAPSHOTS,
    payload,
  );

export const updateCashflowSnapshot = (
  id: UUID,
  payload: CashflowSnapshotUpdatePayload,
) =>
  http.patch<CashflowSnapshotDetail>(
    ENDPOINTS.FINANCE.CASHFLOW.SNAPSHOT_BY_ID(id),
    payload,
  );

export const deleteCashflowSnapshot = (id: UUID) =>
  http.delete<void>(ENDPOINTS.FINANCE.CASHFLOW.SNAPSHOT_BY_ID(id));

export const getCashflowSnapshotDetail = (
  id: UUID,
  params?: { tree_id?: UUID | null },
) =>
  http.get<CashflowSnapshotDetail>(
    ENDPOINTS.FINANCE.CASHFLOW.SNAPSHOT_BY_ID(id),
    params
      ? {
          ...params,
          tree_id: params.tree_id ?? undefined,
        }
      : undefined,
  );

export const compareCashflowSnapshots = (
  baseId: UUID,
  compareId: UUID,
  params?: { tree_id?: UUID | null },
) =>
  http.get<CashflowSnapshotComparison>(
    ENDPOINTS.FINANCE.CASHFLOW.SNAPSHOT_COMPARE(baseId, compareId),
    params
      ? {
          ...params,
          tree_id: params.tree_id ?? undefined,
        }
      : undefined,
  );

export interface BillingCycleEntry {
  cycle_start: string;
  cycle_end: string;
  posted_month: string;
  amount: string | null;
  note: string | null;
  auto_generated: boolean;
}

export interface BillingCycleHistoryResponse {
  source_id: UUID;
  month: string;
  cycles: BillingCycleEntry[];
}

export interface BillingCycleHistoryBulkResponse {
  source_id: UUID;
  months: Record<string, BillingCycleEntry[]>;
}

export interface BillingMonthListResponse
  extends ListResponse<string, { source_id?: UUID | null }> {
  /** @deprecated use items */
  months: string[];
}

export const applyBillingCycles = (payload: {
  month: string;
  source_ids?: UUID[] | null;
  tree_id?: UUID | null;
}) =>
  http.post<CashflowSnapshotDetail>(
    ENDPOINTS.FINANCE.CASHFLOW.BILLING_APPLY,
    payload,
  );

export const getBillingCycleHistory = (sourceId: UUID, month: string) =>
  http.get<BillingCycleHistoryResponse>(
    ENDPOINTS.FINANCE.CASHFLOW.BILLING_HISTORY(sourceId),
    { month },
  );

export const getBillingCycleHistoryBulk = (sourceId: UUID, months: string[]) =>
  http.get<BillingCycleHistoryBulkResponse>(
    ENDPOINTS.FINANCE.CASHFLOW.BILLING_HISTORY_BULK(sourceId),
    { months },
  );

export const listBillingMonths = (
  sourceId: UUID,
  params?: {
    page?: number;
    size?: number;
    before?: string;
    after?: string;
    direction?: "asc" | "desc";
  },
) =>
  http.get<BillingMonthListResponse>(
    ENDPOINTS.FINANCE.CASHFLOW.BILLING_MONTHS(sourceId),
    params,
  );

export const upsertBillingCycleEntries = (
  sourceId: UUID,
  payload: {
    month: string;
    entries: Array<{
      cycle_start: string;
      cycle_end: string;
      amount: string;
      note?: string | null;
    }>;
  },
) =>
  http.post<BillingCycleHistoryResponse>(
    ENDPOINTS.FINANCE.CASHFLOW.BILLING_HISTORY(sourceId),
    payload,
  );
