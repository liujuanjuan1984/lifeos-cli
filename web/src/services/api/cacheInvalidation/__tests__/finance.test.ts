import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addFinanceRateSnapshotToListCache,
  invalidateFinanceAssets,
  invalidateFinanceSnapshot,
  invalidateFinanceSnapshots,
  invalidateFinanceTreeByPurpose,
  setFinanceRateSnapshotCache,
  setFinanceSnapshotCache,
} from "@/services/api/cacheInvalidation/finance";
import type {
  FinanceRateSnapshot,
  FinanceRateSnapshotListResponse,
  FinanceSnapshot,
} from "@/services/api/finance";
import { financeKeys } from "@/services/api/queryKeys";

describe("finance cache invalidation helpers", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let setQueryDataMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    setQueryDataMock = vi.fn();
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
      setQueryData: setQueryDataMock,
    } as unknown as QueryClient;
  });

  it("invalidates finance asset lists", () => {
    invalidateFinanceAssets(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.assets(),
    });
  });

  it("invalidates purpose trees and snapshot scopes", () => {
    invalidateFinanceTreeByPurpose(queryClient, "balance");
    invalidateFinanceSnapshots(queryClient, "tree-1");
    invalidateFinanceSnapshot(queryClient, "snapshot-1");

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.treesByPurpose("balance"),
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.snapshots("tree-1"),
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.snapshot("snapshot-1"),
      exact: true,
    });
  });

  it("writes snapshot and rate snapshot detail caches", () => {
    const snapshot = { id: "snapshot-1" } as FinanceSnapshot;
    const rateSnapshot = { id: "rate-snapshot-1" } as FinanceRateSnapshot;

    setFinanceSnapshotCache(queryClient, snapshot);
    setFinanceRateSnapshotCache(queryClient, rateSnapshot);

    expect(setQueryDataMock).toHaveBeenCalledWith(
      financeKeys.snapshot("snapshot-1"),
      snapshot,
    );
    expect(setQueryDataMock).toHaveBeenCalledWith(
      financeKeys.rateSnapshot("rate-snapshot-1"),
      rateSnapshot,
    );
  });

  it("prepends new rate snapshots into the cached rate snapshot list", () => {
    const rateSnapshot = { id: "rate-snapshot-2" } as FinanceRateSnapshot;
    const existing = {
      items: [{ id: "rate-snapshot-1" }],
      pagination: { page: 1, size: 50, total: 1, pages: 1 },
      meta: { include_deleted: false },
    } as FinanceRateSnapshotListResponse;

    addFinanceRateSnapshotToListCache(queryClient, rateSnapshot);

    const [, updater] = setQueryDataMock.mock.calls[0];
    const next = updater(existing) as FinanceRateSnapshotListResponse;

    expect(setQueryDataMock).toHaveBeenCalledWith(
      financeKeys.rateSnapshots(),
      expect.any(Function),
    );
    expect(next.items.map((item) => item.id)).toEqual([
      "rate-snapshot-2",
      "rate-snapshot-1",
    ]);
    expect(next.pagination.total).toBe(2);
  });
});
