import type { QueryClient } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { invalidatePlanningSnapshots } from "@/utils/query";
import { habitsKeys, tasksKeys } from "@/services/api/queryKeys";
import type { QueryLike } from "@/services/api/queryPredicates";

const FIELD_MODES = ["basic", "full"] as const;

const DEFAULT_PLANNING_TASK_SIZE = 100;

describe("invalidatePlanningSnapshots", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
    } as unknown as QueryClient;
  });

  it("deduplicates planning snapshots and invalidates day habit actions", async () => {
    await invalidatePlanningSnapshots(queryClient, [
      {
        planning_cycle_type: "day",
        planning_cycle_start_date: "2025-01-01",
      },
      {
        planning_cycle_type: "day",
        planning_cycle_start_date: "2025-01-01",
      },
      {
        planning_cycle_type: "week",
        planning_cycle_start_date: "2025-01-08",
      },
    ]);

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(5);
    FIELD_MODES.forEach((mode) => {
      expect(invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: tasksKeys.list({
          planning_cycle_type: "day",
          planning_cycle_start_date: "2025-01-01",
          fields: mode,
          size: DEFAULT_PLANNING_TASK_SIZE,
        }),
      });
      expect(invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: tasksKeys.list({
          planning_cycle_type: "week",
          planning_cycle_start_date: "2025-01-08",
          fields: mode,
          size: DEFAULT_PLANNING_TASK_SIZE,
        }),
      });
    });
    const habitInvalidation = invalidateQueriesMock.mock.calls.find(
      ([options]) => "predicate" in options,
    )?.[0] as { predicate: (query: QueryLike) => boolean } | undefined;
    expect(habitInvalidation?.predicate({
      queryKey: habitsKeys.actionsInRange({
        startDate: "2025-01-01",
        endDate: "2025-01-01",
        referenceDate: "2025-01-01",
      }),
    })).toBe(true);
    expect(habitInvalidation?.predicate({
      queryKey: tasksKeys.list({
        planning_cycle_type: "day",
        planning_cycle_start_date: "2025-01-01",
        fields: "basic",
        size: DEFAULT_PLANNING_TASK_SIZE,
      }),
    })).toBe(false);
  });

  it("does not invalidate habit action windows for non-day snapshots", async () => {
    await invalidatePlanningSnapshots(queryClient, [
      {
        planning_cycle_type: "month",
        planning_cycle_start_date: "2025-05-01",
      },
    ]);

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(2);
    FIELD_MODES.forEach((mode) => {
      expect(invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: tasksKeys.list({
          planning_cycle_type: "month",
          planning_cycle_start_date: "2025-05-01",
          fields: mode,
          size: DEFAULT_PLANNING_TASK_SIZE,
        }),
      });
    });
  });

  it("skips invalidation when no snapshots are provided", async () => {
    await invalidatePlanningSnapshots(queryClient, []);
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });
});
