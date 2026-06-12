import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateActualEventList,
  invalidateActualEventLists,
  invalidateActualEventsAdvancedSearch,
  removeActualEventDetailCache,
  setActualEventDetailCache,
} from "@/services/api/cacheInvalidation/actualEvents";
import { invalidatePlannedEventLists } from "@/services/api/cacheInvalidation/plannedEvents";
import { actualEventsKeys, plannedEventsKeys } from "@/services/api/queryKeys";

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

  it("invalidates actual event list queries using the shared predicate", () => {
    invalidateActualEventLists(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);
    const [{ predicate }] = invalidateQueriesMock.mock.calls[0];
    expect(
      predicate({ queryKey: actualEventsKeys.list({ start: "2025-01-01" }) }),
    ).toBe(true);
    expect(predicate({ queryKey: actualEventsKeys.detail("event-1") })).toBe(
      false,
    );
  });

  it("invalidates one actual event list exactly", () => {
    const filters = {
      start: "2025-01-01T00:00:00.000Z",
      end: "2025-01-01T23:59:59.999Z",
      sort_order: "asc" as const,
      timezone: "America/Toronto",
    };

    invalidateActualEventList(queryClient, filters);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: actualEventsKeys.list(filters),
      exact: true,
    });
  });

  it("invalidates actual event advanced search queries using the shared predicate", () => {
    invalidateActualEventsAdvancedSearch(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);
    const [{ predicate }] = invalidateQueriesMock.mock.calls[0];
    expect(
      predicate({
        queryKey: actualEventsKeys.advancedSearch({ start_date: "2025-01-01" }),
      }),
    ).toBe(true);
    expect(predicate({ queryKey: actualEventsKeys.list({}) })).toBe(false);
  });

  it("updates and removes actual event detail caches with shared keys", () => {
    const event = {
      id: "event-1",
      title: "Focus time",
    };

    setActualEventDetailCache(queryClient, event as never);
    removeActualEventDetailCache(queryClient, "event-1");

    expect(setQueryDataMock).toHaveBeenCalledWith(
      actualEventsKeys.detail("event-1"),
      event,
    );
    expect(removeQueriesMock).toHaveBeenCalledWith({
      queryKey: actualEventsKeys.detail("event-1"),
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
