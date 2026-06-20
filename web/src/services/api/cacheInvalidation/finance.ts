import type { QueryClient } from "@tanstack/react-query";

import {
  type FinancePurpose,
  type FinanceRateSnapshot,
  type FinanceRateSnapshotListResponse,
  type FinanceSnapshot,
} from "@/services/api/finance";
import { financeKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";

const prependUnique = <TItem extends { id: UUID }>(
  items: TItem[],
  item: TItem,
): TItem[] => [item, ...items.filter((existing) => existing.id !== item.id)];

export const invalidateFinanceAssets = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: financeKeys.assets() });

export const invalidateFinanceTreeByPurpose = (
  queryClient: QueryClient,
  purpose: FinancePurpose,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.treesByPurpose(purpose),
  });

export const invalidateFinanceSnapshots = (
  queryClient: QueryClient,
  treeId: UUID | null,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.snapshots(treeId),
  });

export const invalidateFinanceSnapshot = (
  queryClient: QueryClient,
  snapshotId: UUID,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.snapshot(snapshotId),
    exact: true,
  });

export const setFinanceSnapshotCache = (
  queryClient: QueryClient,
  snapshot: FinanceSnapshot,
) => {
  queryClient.setQueryData(financeKeys.snapshot(snapshot.id), snapshot);
};

export const removeFinanceSnapshotCache = (
  queryClient: QueryClient,
  snapshotId: UUID,
) => {
  queryClient.removeQueries({
    queryKey: financeKeys.snapshot(snapshotId),
    exact: true,
  });
};

export const invalidateFinanceRateSnapshots = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: financeKeys.rateSnapshots() });

export const invalidateFinanceRateSnapshot = (
  queryClient: QueryClient,
  rateSnapshotId: UUID,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.rateSnapshot(rateSnapshotId),
    exact: true,
  });

export const setFinanceRateSnapshotCache = (
  queryClient: QueryClient,
  rateSnapshot: FinanceRateSnapshot,
) => {
  queryClient.setQueryData(financeKeys.rateSnapshot(rateSnapshot.id), rateSnapshot);
};

export const addFinanceRateSnapshotToListCache = (
  queryClient: QueryClient,
  rateSnapshot: FinanceRateSnapshot,
) => {
  queryClient.setQueryData<FinanceRateSnapshotListResponse>(
    financeKeys.rateSnapshots(),
    (existing) => {
      if (!existing) return existing;
      const alreadyPresent = existing.items.some(
        (item) => item.id === rateSnapshot.id,
      );
      return {
        ...existing,
        items: prependUnique(existing.items, rateSnapshot),
        pagination: {
          ...existing.pagination,
          total: existing.pagination.total + (alreadyPresent ? 0 : 1),
        },
      };
    },
  );
};
