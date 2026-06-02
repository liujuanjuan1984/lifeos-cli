import type { QueryClient } from "@tanstack/react-query";

import { financeKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";

export const invalidateBalanceAccountTrees = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.accountTrees(),
    exact: true,
  });

export const invalidateBalanceAccountTree = (
  queryClient: QueryClient,
  treeId?: UUID | null,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.accountTree(treeId),
    exact: true,
  });

export const invalidateBalanceSnapshotsAll = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.snapshotsAll(),
    exact: true,
  });

export const invalidateBalanceSnapshots = (
  queryClient: QueryClient,
  treeId?: UUID | null,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.snapshots(treeId),
    exact: true,
  });

export const removeBalanceSnapshotDetailCache = (
  queryClient: QueryClient,
  snapshotId: UUID,
  treeId?: UUID | null,
) => {
  queryClient.removeQueries({
    queryKey: financeKeys.snapshotDetail(snapshotId, treeId),
    exact: true,
  });
};
