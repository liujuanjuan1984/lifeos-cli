import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateHabitActions,
  invalidateHabitActionsByDate,
} from "@/services/api/cacheInvalidation/habits";
import { habitsKeys } from "@/services/api/queryKeys";
import type { QueryLike } from "@/services/api/queryPredicates";

describe("habit cache invalidation helpers", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
    } as unknown as QueryClient;
  });

  it("invalidates only action queries for one habit", () => {
    invalidateHabitActions(queryClient, "habit-1");

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);
    const [{ predicate }] = invalidateQueriesMock.mock.calls[0] as [
      { predicate: (query: QueryLike) => boolean },
    ];

    expect(
      predicate({ queryKey: habitsKeys.actions("habit-1", { page: 1 }) }),
    ).toBe(true);
    expect(
      predicate({ queryKey: habitsKeys.actions("habit-2", { page: 1 }) }),
    ).toBe(false);
    expect(predicate({ queryKey: habitsKeys.actionsByDate("2026-07-04") }))
      .toBe(false);
    expect(
      predicate({
        queryKey: habitsKeys.actionsInRange({
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          referenceDate: "2026-07-04",
        }),
      }),
    ).toBe(false);
  });

  it("invalidates habit actions grouped by planning date windows", () => {
    invalidateHabitActionsByDate(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);
    const [{ predicate }] = invalidateQueriesMock.mock.calls[0] as [
      { predicate: (query: QueryLike) => boolean },
    ];

    expect(predicate({ queryKey: habitsKeys.actionsByDate("2026-07-04") }))
      .toBe(true);
    expect(
      predicate({
        queryKey: habitsKeys.actionsInRange({
          startDate: "2026-07-01",
          endDate: "2026-07-31",
          referenceDate: "2026-07-04",
        }),
      }),
    ).toBe(true);
    expect(
      predicate({ queryKey: habitsKeys.actions("habit-1", { page: 1 }) }),
    ).toBe(false);
    expect(predicate({ queryKey: habitsKeys.list({}) })).toBe(false);
  });
});
