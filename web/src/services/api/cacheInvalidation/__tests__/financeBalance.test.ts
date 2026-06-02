import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateBalanceAccountTree,
  invalidateBalanceAccountTrees,
  invalidateBalanceSnapshots,
  invalidateBalanceSnapshotsAll,
  removeBalanceSnapshotDetailCache,
} from "@/services/api/cacheInvalidation/financeBalance";
import { financeKeys } from "@/services/api/queryKeys";

describe("finance balance cache invalidation helpers", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let removeQueriesMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    removeQueriesMock = vi.fn();
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
      removeQueries: removeQueriesMock,
    } as unknown as QueryClient;
  });

  it("invalidates account tree lists precisely", () => {
    invalidateBalanceAccountTrees(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.accountTrees(),
      exact: true,
    });
  });

  it("invalidates a specific account tree precisely", () => {
    invalidateBalanceAccountTree(queryClient, "tree-1");

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.accountTree("tree-1"),
      exact: true,
    });
  });

  it("invalidates global and tree snapshots precisely", () => {
    invalidateBalanceSnapshotsAll(queryClient);
    invalidateBalanceSnapshots(queryClient, "tree-1");

    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(1, {
      queryKey: financeKeys.snapshotsAll(),
      exact: true,
    });
    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(2, {
      queryKey: financeKeys.snapshots("tree-1"),
      exact: true,
    });
  });

  it("removes a snapshot detail cache precisely", () => {
    removeBalanceSnapshotDetailCache(queryClient, "snapshot-1", "tree-1");

    expect(removeQueriesMock).toHaveBeenCalledWith({
      queryKey: financeKeys.snapshotDetail("snapshot-1", "tree-1"),
      exact: true,
    });
  });
});
