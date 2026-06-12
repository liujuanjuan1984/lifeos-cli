import type { QueryClient } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { invalidatePlanningSnapshots } from "@/utils/query";
import { habitsKeys, tasksKeys } from "@/services/api/queryKeys";

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
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: habitsKeys.actionsByDate("2025-01-01"),
    });
  });

  it("uses extra habit dates even when not invalidating day snapshots", async () => {
    await invalidatePlanningSnapshots(
      queryClient,
      [
        {
          planning_cycle_type: "month",
          planning_cycle_start_date: "2025-05-01",
        },
      ],
      {
        includeHabitActions: false,
        extraHabitDates: ["2025-06-01"],
      },
    );

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(3);
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
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: habitsKeys.actionsByDate("2025-06-01"),
    });
  });

  it("skips invalidation when no snapshots or extra dates are provided", async () => {
    await invalidatePlanningSnapshots(queryClient, []);
    expect(invalidateQueriesMock).not.toHaveBeenCalled();
  });
});
