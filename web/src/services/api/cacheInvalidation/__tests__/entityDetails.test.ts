import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateCardboxContextList,
  invalidateCardboxSessionState,
} from "@/services/api/cacheInvalidation/cardbox";
import { invalidateDimensionOrder } from "@/services/api/cacheInvalidation/dimensions";
import { invalidatePersonAnniversaries } from "@/services/api/cacheInvalidation/persons";
import { cardboxKeys } from "@/services/api/cardbox";
import { dimensionsKeys, personsKeys } from "@/services/api/queryKeys";

describe("entity detail cache invalidation helpers", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
    } as unknown as QueryClient;
  });

  it("invalidates cardbox context list and session state precisely", () => {
    invalidateCardboxContextList(queryClient);
    invalidateCardboxSessionState(queryClient, "session-1");

    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(1, {
      queryKey: cardboxKeys.contextList(),
      exact: true,
    });
    expect(invalidateQueriesMock).toHaveBeenNthCalledWith(2, {
      queryKey: cardboxKeys.sessionState("session-1"),
      exact: true,
    });
  });

  it("invalidates dimension order precisely", () => {
    invalidateDimensionOrder(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: dimensionsKeys.order(),
      exact: true,
    });
  });

  it("invalidates person anniversaries precisely", () => {
    invalidatePersonAnniversaries(queryClient, "person-1");

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: personsKeys.anniversaries("person-1"),
      exact: true,
    });
  });
});
