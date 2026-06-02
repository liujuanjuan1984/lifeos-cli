import type { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  invalidateSessionDetail,
  invalidateSessionHistory,
  invalidateSessionLists,
} from "@/services/api/cacheInvalidation/sessions";
import { agentMessageKeys } from "@/services/api/agentMessage";
import { sessionKeys } from "@/services/api/session";

describe("session cache invalidation helpers", () => {
  let invalidateQueriesMock: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  beforeEach(() => {
    invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);
    queryClient = {
      invalidateQueries: invalidateQueriesMock,
    } as unknown as QueryClient;
  });

  it("invalidates session list queries via the list namespace", () => {
    invalidateSessionLists(queryClient);

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: sessionKeys.lists(),
    });
  });

  it("invalidates session detail queries precisely", () => {
    invalidateSessionDetail(queryClient, "session-1");

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: sessionKeys.session("session-1"),
      exact: true,
    });
  });

  it("invalidates session history queries precisely", () => {
    invalidateSessionHistory(queryClient, "session-1");

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: agentMessageKeys.sessionHistory("session-1"),
      exact: true,
    });
  });
});
