import { http } from "@/services/api/client";
import { ENDPOINTS } from "@/services/api/endpoints";
import type { UUID } from "@/types/primitive";
import type { ListResponse } from "@/types/pagination";

export interface CreateExchangeRatePayload {
  plan_id?: UUID | null;
  base_asset: string;
  quote_asset: string;
  rate: string;
  captured_at: string;
  source?: string | null;
}

export interface ExchangeRateRecordResponse {
  id: UUID;
  plan_id: UUID | null;
  base_asset: string;
  quote_asset: string;
  rate: string;
  source: string | null;
  captured_at: string;
  created_at: string;
}

export interface ExchangeRateListMeta {
  plan_id?: UUID | null;
}

export type ExchangeRateListResponse = ListResponse<
  ExchangeRateRecordResponse,
  ExchangeRateListMeta
>;

export const financeExchangeRateApi = {
  createRate: (payload: CreateExchangeRatePayload) =>
    http.post<ExchangeRateRecordResponse>(
      ENDPOINTS.FINANCE.EXCHANGE_RATES.BASE,
      payload,
    ),
  listPlanRates: (planId: UUID, page: number = 1, size: number = 100) =>
    http.get<ExchangeRateListResponse>(
      ENDPOINTS.FINANCE.EXCHANGE_RATES.PLANS(planId),
      {
        page,
        size,
      },
    ),
};
