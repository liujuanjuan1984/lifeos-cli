import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateTradingEntries,
  invalidateTradingPlanInstruments,
  invalidateTradingPlanLists,
  invalidateTradingPlanSummary,
} from "@/services/api/cacheInvalidation/financeTrading";
import { financeKeys } from "@/services/api/queryKeys";

describe("finance trading cache invalidation helpers", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
    } as unknown as QueryClient;
  });

  it("invalidates trading plan lists via the list namespace", () => {
    invalidateTradingPlanLists(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.tradingPlanLists(),
    });
  });

  it("invalidates trading plan summary precisely", () => {
    invalidateTradingPlanSummary(queryClient, "plan-1", { rateMode: "live" });

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.tradingPlanSummary("plan-1", { rateMode: "live" }),
      exact: true,
    });
  });

  it("invalidates trading instruments precisely", () => {
    invalidateTradingPlanInstruments(queryClient, "plan-1");

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.tradingInstruments("plan-1"),
      exact: true,
    });
  });

  it("invalidates trading entries precisely", () => {
    const filters = { plan_id: "plan-1", page: 1, size: 200 };

    invalidateTradingEntries(queryClient, filters);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.tradingEntries(filters),
      exact: true,
    });
  });
});
