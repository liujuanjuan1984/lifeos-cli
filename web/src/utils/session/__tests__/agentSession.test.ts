import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { sessionKeys } from "@/services/api/session";
import {
  applyAgentAssignmentToSessionCache,
  normalizeAgentSession,
} from "@/utils/session";

describe("applyAgentAssignmentToSessionCache", () => {
  it("updates cached session lists that use the list response shape", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const session = normalizeAgentSession({
      id: "session-1",
      name: "Session 1",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
      lastActivityAt: "2025-01-01T00:00:00Z",
      messageCount: 0,
      isFavorite: false,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      last_activity_at: "2025-01-01T00:00:00Z",
      session_type: "chat",
      agent_name: "old-agent",
      module_key: "old-agent",
      unread_count: 0,
      is_favorite: false,
      prompt_tokens_total: 0,
      completion_tokens_total: 0,
      total_tokens_total: 0,
      message_count: 0,
    });

    queryClient.setQueryData(sessionKeys.list({ page: 1, size: 20 }), {
      items: [session],
      pagination: { page: 1, size: 20, total: 1, pages: 1 },
      meta: {},
    });

    applyAgentAssignmentToSessionCache({
      queryClient,
      sessionId: "session-1",
      agentName: "new-agent",
    });

    expect(
      queryClient.getQueryData<{
        items: Array<{ agent_name?: string; module_key?: string }>;
      }>(sessionKeys.list({ page: 1, size: 20 })),
    ).toMatchObject({
      items: [{ agent_name: "new-agent", module_key: "new-agent" }],
    });
  });
});
