import type { QueryClient } from "@tanstack/react-query";

import {
  type FinanceRateSnapshot,
  type FinanceRateSnapshotListResponse,
  type FinanceSnapshot,
  type FinanceSnapshotListResponse,
  type FinanceTreeListResponse,
} from "@/services/api/finance";
import { financeKeys } from "@/services/api/queryKeys";
import type { UUID } from "@/types/primitive";

const prependUnique = <TItem extends { id: UUID }>(
  items: TItem[],
  item: TItem,
): TItem[] => [item, ...items.filter((existing) => existing.id !== item.id)];

export const invalidateFinanceAssets = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({ queryKey: financeKeys.assets() });

export const invalidateFinanceTree = (
  queryClient: QueryClient,
  treeId: UUID | null,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.tree(treeId),
    exact: true,
  });

export const removeFinanceTreeFromListCache = (
  queryClient: QueryClient,
  treeId: UUID,
) => {
  queryClient.setQueryData<FinanceTreeListResponse>(
    financeKeys.trees(),
    (existing) => {
      if (!existing) return existing;
      const nextItems = existing.items.filter((item) => item.id !== treeId);
      const removedCount = existing.items.length - nextItems.length;
      return {
        ...existing,
        items: nextItems,
        pagination: {
          ...existing.pagination,
          total: Math.max(0, existing.pagination.total - removedCount),
        },
      };
    },
  );
};

export const removeFinanceTreeCache = (
  queryClient: QueryClient,
  treeId: UUID,
) => {
  queryClient.removeQueries({
    queryKey: financeKeys.tree(treeId),
    exact: true,
  });
};

export const invalidateFinanceSnapshots = (
  queryClient: QueryClient,
  treeId: UUID | null,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.snapshots(treeId),
  });

export const invalidateAllFinanceSnapshotLists = (queryClient: QueryClient) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.allSnapshots(),
  });

export const invalidateFinanceSnapshot = (
  queryClient: QueryClient,
  snapshotId: UUID,
) =>
  queryClient.invalidateQueries({
    queryKey: financeKeys.snapshot(snapshotId),
    exact: true,
  });

export const invalidateAllFinanceSnapshots = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({
      queryKey: financeKeys.allSnapshots(),
    }),
    queryClient.invalidateQueries({
      queryKey: [...financeKeys.all, "snapshot"],
    }),
  ]);

export const setFinanceSnapshotCache = (
  queryClient: QueryClient,
  snapshot: FinanceSnapshot,
) => {
  queryClient.setQueryData(financeKeys.snapshot(snapshot.id), snapshot);
};

export const removeFinanceSnapshotFromListCache = (
  queryClient: QueryClient,
  treeId: UUID | null,
  snapshotId: UUID,
) => {
  queryClient.setQueryData<FinanceSnapshotListResponse>(
    financeKeys.snapshots(treeId),
    (existing) => {
      if (!existing) return existing;
      const nextItems = existing.items.filter((item) => item.id !== snapshotId);
      const removedCount = existing.items.length - nextItems.length;
      return {
        ...existing,
        items: nextItems,
        pagination: {
          ...existing.pagination,
          total: Math.max(0, existing.pagination.total - removedCount),
        },
      };
    },
  );
};

export const removeFinanceSnapshotFromAllListCache = (
  queryClient: QueryClient,
  snapshotId: UUID,
) => {
  queryClient.setQueryData<FinanceSnapshotListResponse>(
    financeKeys.allSnapshots(),
    (existing) => {
      if (!existing) return existing;
      const nextItems = existing.items.filter((item) => item.id !== snapshotId);
      const removedCount = existing.items.length - nextItems.length;
      return {
        ...existing,
        items: nextItems,
        pagination: {
          ...existing.pagination,
          total: Math.max(0, existing.pagination.total - removedCount),
        },
      };
    },
  );
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

export const setFinanceRateSnapshotInListCache = (
  queryClient: QueryClient,
  rateSnapshot: FinanceRateSnapshot,
) => {
  queryClient.setQueryData<FinanceRateSnapshotListResponse>(
    financeKeys.rateSnapshots(),
    (existing) => {
      if (!existing) return existing;
      return {
        ...existing,
        items: existing.items.map((item) =>
          item.id === rateSnapshot.id ? rateSnapshot : item,
        ),
      };
    },
  );
};

export const removeFinanceRateSnapshotFromListCache = (
  queryClient: QueryClient,
  rateSnapshotId: UUID,
) => {
  queryClient.setQueryData<FinanceRateSnapshotListResponse>(
    financeKeys.rateSnapshots(),
    (existing) => {
      if (!existing) return existing;
      const nextItems = existing.items.filter((item) => item.id !== rateSnapshotId);
      const removedCount = existing.items.length - nextItems.length;
      return {
        ...existing,
        items: nextItems,
        pagination: {
          ...existing.pagination,
          total: Math.max(0, existing.pagination.total - removedCount),
        },
      };
    },
  );
};

export const removeFinanceRateSnapshotCache = (
  queryClient: QueryClient,
  rateSnapshotId: UUID,
) => {
  queryClient.removeQueries({
    queryKey: financeKeys.rateSnapshot(rateSnapshotId),
    exact: true,
  });
};
