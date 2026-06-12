import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invalidateDimensionOrder } from "@/services/api/cacheInvalidation/dimensions";
import { invalidatePersonAnniversaries } from "@/services/api/cacheInvalidation/persons";
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
