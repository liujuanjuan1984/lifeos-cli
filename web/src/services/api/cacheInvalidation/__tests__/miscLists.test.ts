import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invalidateTimelogTemplateLists } from "@/services/api/cacheInvalidation/timelogTemplates";
import { invalidateTagList } from "@/services/api/cacheInvalidation/tags";
import {
  timelogTemplatesKeys,
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

  it("invalidates timelog template list namespace", () => {
    invalidateTimelogTemplateLists(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: timelogTemplatesKeys.lists(),
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
