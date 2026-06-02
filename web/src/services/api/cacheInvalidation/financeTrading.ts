import type { QueryClient } from "@tanstack/react-query";

import { financeKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";

export const invalidateTradingPlanLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.tradingPlanLists(),
  });

export const invalidateTradingPlanSummary = (
  queryClient: QueryClient,
  planId: UUID,
  params?: { currency?: string; rateMode?: string },
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.tradingPlanSummary(planId, params),
    exact: true,
  });

export const invalidateTradingPlanInstruments = (
  queryClient: QueryClient,
  planId: UUID,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.tradingInstruments(planId),
    exact: true,
  });

export const invalidateTradingEntries = (
  queryClient: QueryClient,
  filters: Record<string, unknown>,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.tradingEntries(filters),
    exact: true,
  });
