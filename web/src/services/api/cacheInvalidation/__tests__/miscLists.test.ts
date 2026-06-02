import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { invalidateActualEventTemplateLists } from "@/services/api/cacheInvalidation/actualEventTemplates";
import { invalidateInvitationMineLists } from "@/services/api/cacheInvalidation/invitations";
import { invalidateLlmCredentialList } from "@/services/api/cacheInvalidation/llmCredentials";
import { invalidateTagList } from "@/services/api/cacheInvalidation/tags";
import {
  actualEventTemplatesKeys,
  invitationsKeys,
  llmCredentialKeys,
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

  it("invalidates invitation mine lists via the namespace key", () => {
    invalidateInvitationMineLists(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: invitationsKeys.mineLists(),
    });
  });

  it("invalidates llm credential list precisely", () => {
    invalidateLlmCredentialList(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: llmCredentialKeys.list(),
      exact: true,
    });
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
