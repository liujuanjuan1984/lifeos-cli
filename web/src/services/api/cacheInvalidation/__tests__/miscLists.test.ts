import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invalidateActualEventTemplateLists } from "@/services/api/cacheInvalidation/actualEventTemplates";
import { invalidateTagList } from "@/services/api/cacheInvalidation/tags";
import {
  actualEventTemplatesKeys,
  tagsKeys,
} from "@/services/api/queryKeys";

describe("misc list cache invalidation helpers", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
    } as unknown as QueryClient;
  });

  it("invalidates actual event template list namespace", () => {
    invalidateActualEventTemplateLists(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: actualEventTemplatesKeys.lists(),
    });
  });

  it("invalidates one tag list exactly", () => {
    const filters = {
      entity_type: "note",
      category: "topic",
      page: 1,
      size: 1000,
    };

    invalidateTagList(queryClient, filters);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: tagsKeys.list(filters),
      exact: true,
    });
  });
});
