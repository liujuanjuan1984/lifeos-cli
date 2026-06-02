import { http, type QueryParams } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

type TradingPlanStatus = "draft" | "active" | "archived";

export interface TradingPlanResponse {
  id: UUID;
  name: string;
  period_start: string | null;
  period_end: string | null;
  target_roi: string | null;
  note: string | null;
  status: TradingPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface TradingPlanListMeta {
  include_archived?: boolean | null;
}

export type TradingPlanListResponse = ListResponse<
  TradingPlanResponse,
  TradingPlanListMeta
>;

export interface TradingPlanPayload {
  name: string;
  period_start?: string | null;
  period_end?: string | null;
  target_roi?: string | null;
  note?: string | null;
  status?: TradingPlanStatus;
}

export interface TradingInstrumentResponse {
  id: UUID;
  plan_id: UUID;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  exchange: string | null;
  strategy_tag: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradingInstrumentListMeta {
  plan_id?: UUID | null;
}

export type TradingInstrumentListResponse = ListResponse<
  TradingInstrumentResponse,
  TradingInstrumentListMeta
>;

export interface TradingInstrumentPayload {
  symbol: string;
  base_asset?: string | null;
  quote_asset?: string | null;
  exchange?: string | null;
  strategy_tag?: string | null;
  note?: string | null;
}

export type TradingDirection = "buy" | "sell" | "transfer";
export type TradingSource = "manual" | "import";

export interface TradingEntryResponse {
  id: UUID;
  plan_id: UUID;
  instrument_id: UUID;
  trade_time: string;
  direction: TradingDirection;
  base_delta: string;
  quote_delta: string;
  price: string | null;
  fee_asset: string | null;
  fee_amount: string | null;
  source: TradingSource;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradingEntryListMeta {
  plan_id?: UUID | null;
  instrument_id?: UUID | null;
  direction?: TradingDirection | null;
  source?: TradingSource | null;
  start_time?: string | null;
  end_time?: string | null;
}

export type TradingEntryListResponse = ListResponse<
  TradingEntryResponse,
  TradingEntryListMeta
>;

export interface TradingEntryPayload {
  plan_id: UUID;
  instrument_id: UUID;
  trade_time: string;
  direction: TradingDirection;
  base_delta: string;
  quote_delta: string;
  price?: string | null;
  fee_asset?: string | null;
  fee_amount?: string | null;
  source?: TradingSource;
  note?: string | null;
}

export type TradingEntryUpdatePayload = Partial<
  Omit<TradingEntryPayload, "plan_id" | "instrument_id">
> &
  Partial<Pick<TradingEntryPayload, "plan_id" | "instrument_id">>;

export type TradingEntryQueryParams = QueryParams & {
  plan_id?: UUID;
  instrument_id?: UUID;
  direction?: TradingDirection;
  source?: TradingSource;
  start_time?: string;
  end_time?: string;
  page?: number;
  size?: number;
};

export interface TradingInstrumentSummary {
  instrument_id: UUID;
  plan_id: UUID;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  net_position: string;
  net_position_quote: string;
  avg_entry_price: string | null;
  market_price: string | null;
  market_value_primary: string;
  market_value_primary_base: string;
  market_value_primary_quote: string;
  realized_pnl_primary: string;
  unrealized_pnl_primary: string;
  invested_primary: string;
  roi: string | null;
  updated_at: string;
}

export interface TradingPlanSummaryTotals {
  total_investment: string;
  total_realized: string;
  total_unrealized: string;
  net_value: string;
  roi: string | null;
}

export type TradingExchangeRateScope = "plan" | "user" | "global" | "synthetic";
export type TradingRateMode = "snapshot" | "source";

export interface TradingPlanRateUsage {
  base_asset: string;
  quote_asset: string;
  rate: string;
  scope: TradingExchangeRateScope;
  derived: boolean;
  source: string | null;
  as_of: string | null;
}

export interface TradingPlanSummaryResponse {
  plan_id: UUID;
  plan_name: string;
  plan_status: TradingPlanStatus;
  primary_currency: string;
  calculated_at: string;
  totals: TradingPlanSummaryTotals;
  instruments: TradingInstrumentSummary[];
  rates_used: TradingPlanRateUsage[];
  rates_updated_at: string | null;
  rate_mode: TradingRateMode;
  rate_snapshot_ts: string | null;
}

export interface ExchangeRateQueryResult {
  base_asset: string;
  quote_asset: string;
  rate: string | null;
  source?: string | null;
  captured_at?: string | null;
}

export interface ExchangeRateQueryResponse {
  requested_at: string;
  pairs: ExchangeRateQueryResult[];
}

export const tradingApi = {
  listPlans: (params?: {
    include_archived?: boolean;
    page?: number;
    size?: number;
  }) =>
    http.get<TradingPlanListResponse>(ENDPOINTS.FINANCE.TRADING.PLANS, params),
  createPlan: (payload: TradingPlanPayload) =>
    http.post<TradingPlanResponse>(ENDPOINTS.FINANCE.TRADING.PLANS, payload),
  updatePlan: (id: UUID, payload: TradingPlanPayload) =>
    http.patch<TradingPlanResponse>(
      ENDPOINTS.FINANCE.TRADING.PLAN_BY_ID(id),
      payload,
    ),
  archivePlan: (id: UUID) =>
    http.post<TradingPlanResponse>(ENDPOINTS.FINANCE.TRADING.PLAN_ARCHIVE(id)),
  listInstruments: (planId: UUID, params?: { page?: number; size?: number }) =>
    http.get<TradingInstrumentListResponse>(
      ENDPOINTS.FINANCE.TRADING.PLAN_INSTRUMENTS(planId),
      params,
    ),
  createInstrument: (planId: UUID, payload: TradingInstrumentPayload) =>
    http.post<TradingInstrumentResponse>(
      ENDPOINTS.FINANCE.TRADING.PLAN_INSTRUMENTS(planId),
      payload,
    ),
  updateInstrument: (
    planId: UUID,
    instrumentId: UUID,
    payload: TradingInstrumentPayload,
  ) =>
    http.patch<TradingInstrumentResponse>(
      ENDPOINTS.FINANCE.TRADING.PLAN_INSTRUMENT_BY_ID(planId, instrumentId),
      payload,
    ),
  deleteInstrument: (planId: UUID, instrumentId: UUID) =>
    http.delete<void>(
      ENDPOINTS.FINANCE.TRADING.PLAN_INSTRUMENT_BY_ID(planId, instrumentId),
    ),
  getPlanSummary: (
    planId: UUID,
    params?: {
      currency?: string;
      at?: string;
      rate_mode?: TradingRateMode;
    },
  ) =>
    http.get<TradingPlanSummaryResponse>(
      ENDPOINTS.FINANCE.TRADING.PLAN_SUMMARY(planId),
      params,
    ),
  refreshPlanRateSnapshot: (planId: UUID) =>
    http.post<TradingPlanResponse>(
      ENDPOINTS.FINANCE.TRADING.PLAN_RATE_SNAPSHOT(planId),
    ),
  listEntries: (params: TradingEntryQueryParams) =>
    http.get<TradingEntryListResponse>(
      ENDPOINTS.FINANCE.TRADING.ENTRIES,
      params,
    ),
  createEntry: (payload: TradingEntryPayload) =>
    http.post<TradingEntryResponse>(ENDPOINTS.FINANCE.TRADING.ENTRIES, payload),
  updateEntry: (entryId: UUID, payload: TradingEntryUpdatePayload) =>
    http.put<TradingEntryResponse>(
      ENDPOINTS.FINANCE.TRADING.ENTRY_BY_ID(entryId),
      payload,
    ),
  deleteEntry: (entryId: UUID) =>
    http.delete<void>(ENDPOINTS.FINANCE.TRADING.ENTRY_BY_ID(entryId)),
  queryExchangeRates: (params: {
    base?: string;
    quote?: string;
    pairs?: string[];
    at?: string;
    plan_id?: UUID;
  }) =>
    http.get<ExchangeRateQueryResponse>(
      ENDPOINTS.FINANCE.EXCHANGE_RATES.QUERY,
      params,
    ),
};
