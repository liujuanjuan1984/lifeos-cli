import { http } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

export interface SnapshotMetric {
  total_assets: string;
  total_liabilities: string;
  net_worth: string;
  asset_breakdown?: Record<string, string> | null;
  currency_breakdown?: Record<string, string> | null;
}

export interface BalanceSnapshotSummary {
  id: UUID;
  snapshot_ts: string;
  primary_currency: string;
  tree_id: UUID;
  note: string | null;
  metrics: SnapshotMetric;
}

export interface BalanceSnapshotListMeta {
  tree_id?: UUID | null;
}

export type BalanceSnapshotListResponse = ListResponse<
  BalanceSnapshotSummary,
  BalanceSnapshotListMeta
>;

export interface AccountSnapshot {
  account_id: UUID;
  account_name: string;
  type: string;
  currency_code: string;
  balance_raw: string;
  balance_converted: string;
  path: string;
  depth: number;
  note: string | null;
}

export interface ExchangeRateSnapshot {
  id: string;
  quote_currency: string;
  rate: string;
  source?: string | null;
  as_of?: string | null;
  derived?: boolean;
  scope?: string | null;
}

export interface BalanceSnapshotDetail {
  id: UUID;
  snapshot_ts: string;
  primary_currency: string;
  tree_id: UUID;
  note: string | null;
  metrics: SnapshotMetric;
  accounts: AccountSnapshot[];
  exchange_rates: ExchangeRateSnapshot[];
}

export interface CreateSnapshotAccountInput {
  id: UUID;
  balance: string;
  note?: string;
}

export interface CreateSnapshotPayload {
  primary_currency?: string;
  tree_id?: UUID | null;
  accounts: CreateSnapshotAccountInput[];
  exchange_rates?: Array<{ quote_currency: string; rate: string }>;
  note?: string;
  snapshot_ts?: string;
}

export type UpdateSnapshotPayload = CreateSnapshotPayload;

export interface SnapshotAccountChange {
  account_id: UUID;
  account_name: string;
  currency_code: string;
  type: string;
  previous_balance: string;
  current_balance: string;
  delta: string;
  delta_percent: string | null;
}

export interface BalanceSnapshotComparison {
  base_snapshot_id: UUID;
  compare_snapshot_id: UUID;
  base_snapshot_ts: string;
  compare_snapshot_ts: string;
  delta_net_worth: string;
  base_metrics: SnapshotMetric;
  compare_metrics: SnapshotMetric;
  account_changes: SnapshotAccountChange[];
}

export interface LatestExchangeRateResponse {
  requested_at: string;
  snapshot_id: UUID | null;
  snapshot_ts: string | null;
  base_currency: string;
  time_basis: "latest_snapshot_ts" | "latest_captured_at_lte_requested_at";
  cache_policy: "none";
  fallback_policy: "none" | "inverse_only";
  missing_behavior: "error";
  rates: Array<{
    base_asset: string;
    quote_asset: string;
    rate: string;
    scope: "snapshot" | "plan" | "user" | "global" | "synthetic";
    derived: boolean;
    source: string | null;
    as_of: string | null;
  }>;
  scope: "snapshot" | "source";
}

export const listBalanceSnapshots = (params?: {
  page?: number;
  size?: number;
  tree_id?: UUID | null;
}) =>
  http.get<BalanceSnapshotListResponse>(
    ENDPOINTS.FINANCE.BALANCE_SNAPSHOTS.BASE,
    params
      ? {
          ...params,
          tree_id: params.tree_id ?? undefined,
        }
      : undefined,
  );

export const createBalanceSnapshot = (payload: CreateSnapshotPayload) =>
  http.post<BalanceSnapshotDetail>(
    ENDPOINTS.FINANCE.BALANCE_SNAPSHOTS.BASE,
    payload,
  );

export const updateBalanceSnapshot = (
  id: UUID,
  payload: UpdateSnapshotPayload,
) =>
  http.patch<BalanceSnapshotDetail>(
    ENDPOINTS.FINANCE.BALANCE_SNAPSHOTS.BY_ID(id),
    payload,
  );

export const deleteBalanceSnapshot = (id: UUID) =>
  http.delete<void>(ENDPOINTS.FINANCE.BALANCE_SNAPSHOTS.BY_ID(id));

export const getBalanceSnapshotDetail = (
  id: UUID,
  params?: { tree_id?: UUID | null },
) =>
  http.get<BalanceSnapshotDetail>(
    ENDPOINTS.FINANCE.BALANCE_SNAPSHOTS.BY_ID(id),
    params
      ? {
          ...params,
          tree_id: params.tree_id ?? undefined,
        }
      : undefined,
  );

export const compareBalanceSnapshots = (
  baseId: UUID,
  compareId: UUID,
  params?: { tree_id?: UUID | null },
) =>
  http.get<BalanceSnapshotComparison>(
    ENDPOINTS.FINANCE.BALANCE_SNAPSHOTS.COMPARE(baseId, compareId),
    params
      ? {
          ...params,
          tree_id: params.tree_id ?? undefined,
        }
      : undefined,
  );

export const getLatestExchangeRates = (
  currencies?: string,
  scope?: "snapshot" | "source",
  tree_id?: UUID | null,
) =>
  http.get<LatestExchangeRateResponse>(
    ENDPOINTS.FINANCE.EXCHANGE_RATES.LATEST,
    {
      currencies,
      scope,
      tree_id: tree_id ?? undefined,
    },
  );
