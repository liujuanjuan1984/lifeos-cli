import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateCashflowSnapshotDetail,
  invalidateCashflowSnapshots,
  invalidateCashflowSnapshotsAll,
  invalidateCashflowSources,
  invalidateCashflowTrees,
  removeCashflowSnapshotDetailCache,
  setCashflowSnapshotDetailCache,
} from "@/services/api/cacheInvalidation/financeCashflow";
import { financeKeys } from "@/services/api/queryKeys";

describe("finance cashflow cache invalidation helpers", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let removeQueriesMock: ReturnType<typeof vi.fn>;
  let setQueryDataMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    removeQueriesMock = vi.fn();
    setQueryDataMock = vi.fn();
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
      removeQueries: removeQueriesMock,
      setQueryData: setQueryDataMock,
    } as unknown as QueryClient;
  });

  it("invalidates cashflow trees and sources precisely", () => {
    invalidateCashflowTrees(queryClient);
    invalidateCashflowSources(queryClient, "tree-1");

    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(1, {
      queryKey: financeKeys.cashflowTrees(),
      exact: true,
    });
    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(2, {
      queryKey: financeKeys.cashflowSources("tree-1"),
      exact: true,
    });
  });

  it("invalidates cashflow snapshot queries precisely", () => {
    invalidateCashflowSnapshotsAll(queryClient);
    invalidateCashflowSnapshots(queryClient, "tree-1");
    invalidateCashflowSnapshotDetail(queryClient, "snapshot-1", "tree-1");

    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(1, {
      queryKey: financeKeys.cashflowSnapshotsAll(),
      exact: true,
    });
    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(2, {
      queryKey: financeKeys.cashflowSnapshots("tree-1"),
      exact: true,
    });
    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(3, {
      queryKey: financeKeys.cashflowSnapshotDetail("snapshot-1", "tree-1"),
      exact: true,
    });
  });

  it("sets and removes cashflow snapshot detail caches precisely", () => {
    const snapshot = {
      id: "snapshot-1",
      tree_id: "tree-1",
    };

    setCashflowSnapshotDetailCache(queryClient, snapshot as never);
    removeCashflowSnapshotDetailCache(queryClient, "snapshot-1", "tree-1");

    expect(setQueryDataMock).toHaveBeenCalledWith(
      financeKeys.cashflowSnapshotDetail("snapshot-1", "tree-1"),
      snapshot,
    );
    expect(removeQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.cashflowSnapshotDetail("snapshot-1", "tree-1"),
      exact: true,
    });
  });
});
