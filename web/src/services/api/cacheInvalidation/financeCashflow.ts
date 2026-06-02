import type { QueryClient } from "@tanstack/react-query";

import { financeKeys } from "@/services/api/queryKeys";
import type { CashflowSnapshotDetail } from "@/services/api/finance/cashflow";
import type { UUID } from "@/types/primitive";

export const invalidateCashflowTrees = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.cashflowTrees(),
    exact: true,
  });

export const invalidateCashflowSources = (
  queryClient: QueryClient,
  treeId?: UUID | null,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.cashflowSources(treeId),
    exact: true,
  });

export const invalidateCashflowSnapshotsAll = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.cashflowSnapshotsAll(),
    exact: true,
  });

export const invalidateCashflowSnapshots = (
  queryClient: QueryClient,
  treeId?: UUID | null,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.cashflowSnapshots(treeId),
    exact: true,
  });

export const invalidateCashflowSnapshotDetail = (
  queryClient: QueryClient,
  snapshotId: UUID,
  treeId?: UUID | null,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.cashflowSnapshotDetail(snapshotId, treeId),
    exact: true,
  });

export const setCashflowSnapshotDetailCache = (
  queryClient: QueryClient,
  snapshot: CashflowSnapshotDetail,
  treeId?: UUID | null,
) => {
  queryClient.setQueryData(
    financeKeys.cashflowSnapshotDetail(snapshot.id, treeId ?? snapshot.tree_id),
    snapshot,
  );
};

export const removeCashflowSnapshotDetailCache = (
  queryClient: QueryClient,
  snapshotId: UUID,
  treeId?: UUID | null,
) => {
  queryClient.removeQueries({
    queryKey: financeKeys.cashflowSnapshotDetail(snapshotId, treeId),
    exact: true,
  });
};
