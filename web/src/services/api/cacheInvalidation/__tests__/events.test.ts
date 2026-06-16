import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateTimelogList,
  invalidateTimelogLists,
  invalidateTimelogsAdvancedSearch,
  removeTimelogDetailCache,
  setTimelogDetailCache,
} from "@/services/api/cacheInvalidation/timelogs";
import { invalidatePlannedEventLists } from "@/services/api/cacheInvalidation/plannedEvents";
import { timelogsKeys, plannedEventsKeys } from "@/services/api/queryKeys";

describe("event cache invalidation helpers", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let setQueryDataMock: ReturnType<typeof vi.fn>;
  let removeQueriesMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    setQueryDataMock = vi.fn();
    removeQueriesMock = vi.fn();
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
      setQueryData: setQueryDataMock,
      removeQueries: removeQueriesMock,
    } as unknown as QueryClient;
  });

  it("invalidates timelog list queries using the shared predicate", () => {
    invalidateTimelogLists(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);
    const [{ predicate }] = invalidateQueriesMock.mock.calls[0];
    expect(
      predicate({ queryKey: timelogsKeys.list({ start: "2025-01-01" }) }),
    ).toBe(true);
    expect(predicate({ queryKey: timelogsKeys.detail("event-1") })).toBe(
      false,
    );
  });

  it("invalidates one timelog list exactly", () => {
    const filters = {
      start: "2025-01-01T00:00:00.000Z",
      end: "2025-01-01T23:59:59.999Z",
      sort_order: "asc" as const,
      timezone: "America/Toronto",
    };

    invalidateTimelogList(queryClient, filters);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: timelogsKeys.list(filters),
      exact: true,
    });
  });

  it("invalidates timelog advanced search queries using the shared predicate", () => {
    invalidateTimelogsAdvancedSearch(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);
    const [{ predicate }] = invalidateQueriesMock.mock.calls[0];
    expect(
      predicate({
        queryKey: timelogsKeys.advancedSearch({ start_date: "2025-01-01" }),
      }),
    ).toBe(true);
    expect(predicate({ queryKey: timelogsKeys.list({}) })).toBe(false);
  });

  it("updates and removes timelog detail caches with shared keys", () => {
    const event = {
      id: "event-1",
      title: "Focus time",
    };

    setTimelogDetailCache(queryClient, event as never);
    removeTimelogDetailCache(queryClient, "event-1");

    expect(setQueryDataMock).toHaveBeenCalledWith(
      timelogsKeys.detail("event-1"),
      event,
    );
    expect(removeQueriesMock).toHaveBeenCalledWith({
      queryKey: timelogsKeys.detail("event-1"),
      exact: true,
    });
  });

  it("invalidates planned event list queries using the shared predicate", () => {
    invalidatePlannedEventLists(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);
    const [{ predicate }] = invalidateQueriesMock.mock.calls[0];
    expect(
      predicate({
        queryKey: plannedEventsKeys.list({
          start: "2025-01-01T00:00:00Z",
          end: "2025-01-02T00:00:00Z",
        }),
      }),
    ).toBe(true);
    expect(
      predicate({
        queryKey: plannedEventsKeys.rawList({ page: 1, size: 100 }),
      }),
    ).toBe(false);
  });
});
