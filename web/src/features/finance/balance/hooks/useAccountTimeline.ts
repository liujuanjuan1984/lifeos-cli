import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { financeApi } from "@/services/api/finance";
import { financeKeys } from "@/services/api/queryKeys";
import { formatDateTime } from "@/utils/datetime";
import type { BalanceSnapshotDetail } from "@/services/api/finance";
import type { UUID } from "@/types/primitive";

interface AccountTimelineEntry {
  snapshotId: UUID;
  snapshotTs: string;
  displayTimestamp: string;
  convertedAmount: string;
  convertedCurrency: string;
  rawAmount: string;
  rawCurrency: string;
}

interface UseAccountTimelineParams {
  batchSize?: number;
  resolveErrorMessage?: (error: unknown) => string;
}

interface LoadTimelineParams {
  accountId: UUID;
  treeId: UUID | null;
}

interface UseAccountTimelineResult {
  entries: AccountTimelineEntry[];
  loading: boolean;
  error: string | null;
  loadTimeline: (params: LoadTimelineParams) => Promise<void>;
  resetTimeline: () => void;
}

export function useAccountTimeline({
  batchSize = 5,
  resolveErrorMessage,
}: UseAccountTimelineParams = {}): UseAccountTimelineResult {
  const queryClient = useQueryClient();
  const [entries, setEntries] = useState<AccountTimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const cancelOutstandingRequests = useCallback(() => {
    requestIdRef.current += 1;
  }, []);

  const resetTimeline = useCallback(() => {
    cancelOutstandingRequests();
    setEntries([]);
    setError(null);
    setLoading(false);
  }, [cancelOutstandingRequests]);

  const loadTimeline = useCallback(
    async ({ accountId, treeId }: LoadTimelineParams) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      setLoading(true);
      setError(null);
      setEntries([]);

      if (!treeId) {
        setLoading(false);
        return;
      }

      try {
        const collected: AccountTimelineEntry[] = [];

        let page = 1;
        while (true) {
          const response = await financeApi.listSnapshots({
            page,
            size: 100,
            tree_id: treeId ?? undefined,
          });
          if (requestIdRef.current !== requestId) {
            return;
          }

          const snapshots = response.items ?? [];
          if (!snapshots.length && page === 1) {
            setEntries([]);
            setLoading(false);
            return;
          }

          for (let index = 0; index < snapshots.length; index += batchSize) {
            const chunk = snapshots.slice(index, index + batchSize);
            const details = await Promise.all(
              chunk.map((snapshot) =>
                queryClient.ensureQueryData({
                  queryKey: financeKeys.snapshotDetail(
                    snapshot.id as UUID,
                    snapshot.tree_id,
                  ),
                  queryFn: () =>
                    financeApi.getSnapshotDetail(snapshot.id as UUID, {
                      tree_id: snapshot.tree_id,
                    }),
                }),
              ),
            );

            if (requestIdRef.current !== requestId) {
              return;
            }

            details.forEach((detail: BalanceSnapshotDetail) => {
              const match = detail.accounts.find(
                (item) => item.account_id === accountId,
              );
              if (!match) {
                return;
              }
              collected.push({
                snapshotId: detail.id,
                snapshotTs: detail.snapshot_ts,
                displayTimestamp: formatDateTime(detail.snapshot_ts),
                convertedAmount: match.balance_converted,
                convertedCurrency: detail.primary_currency,
                rawAmount: match.balance_raw,
                rawCurrency: match.currency_code,
              });
            });
          }

          const totalPages = response.pagination.pages ?? page;
          if (page >= totalPages) {
            break;
          }
          page += 1;
        }

        if (requestIdRef.current !== requestId) {
          return;
        }

        setEntries(collected);
      } catch (err) {
        if (requestIdRef.current !== requestId) {
          return;
        }
        const description =
          resolveErrorMessage?.(err) ??
          (err instanceof Error ? err.message : String(err ?? ""));
        setError(description);
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [batchSize, queryClient, resolveErrorMessage],
  );

  return {
    entries,
    loading,
    error,
    loadTimeline,
    resetTimeline,
  };
}
