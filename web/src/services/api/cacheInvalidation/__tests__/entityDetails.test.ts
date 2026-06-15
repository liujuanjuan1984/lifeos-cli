import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invalidateAreaOrder } from "@/services/api/cacheInvalidation/areas";
import { invalidatePersonAnniversaries } from "@/services/api/cacheInvalidation/persons";
import { areasKeys, personsKeys } from "@/services/api/queryKeys";

describe("entity detail cache invalidation helpers", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
    } as unknown as QueryClient;
  });

  it("invalidates area order precisely", () => {
    invalidateAreaOrder(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: areasKeys.order(),
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
