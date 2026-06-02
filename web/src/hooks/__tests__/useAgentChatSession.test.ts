import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { applyAgentAssignmentToSessionCache } from "@/utils/session";
import { sessionKeys } from "@/services/api/session";
import type { AgentSession } from "@/types/session";

const buildSession = (overrides: Partial<AgentSession> = {}): AgentSession => ({
  id: "session-1",
  name: "Test Session",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  lastActivityAt: "2025-01-01T00:00:00.000Z",
  messageCount: 0,
  isFavorite: false,
  sessionType: "chat",
  agentName: null,
  agent_name: null,
  module_key: null,
  unreadCount: 0,
  promptTokensTotal: 0,
  completionTokensTotal: 0,
  totalTokensTotal: 0,
  ...overrides,
});

describe("applyAgentAssignmentToSessionCache", () => {
  it("updates cached session list and detail entries", () => {
    const queryClient = new QueryClient();
    const session = buildSession({ id: "session-42" });
    queryClient.setQueryData(sessionKeys.list({ page: 1, size: 20 }), {
      items: [session],
      pagination: { page: 1, size: 20, total: 1, pages: 1 },
      meta: {},
    });
    queryClient.setQueryData(sessionKeys.session(session.id), session);

    applyAgentAssignmentToSessionCache({
      queryClient,
      sessionId: session.id,
      agentName: "focus_agent",
    });

    const list = queryClient.getQueryData<{
      items: AgentSession[];
      pagination: { page: number; size: number; total: number; pages: number };
      meta: Record<string, never>;
    }>(sessionKeys.list({ page: 1, size: 20 }));
    expect(list?.items[0].agentName).toBe("focus_agent");
    expect(list?.items[0].agent_name).toBe("focus_agent");
    expect(list?.items[0].module_key).toBe("focus_agent");

    const detail = queryClient.getQueryData<AgentSession>(
      sessionKeys.session(session.id),
    );
    expect(detail?.agentName).toBe("focus_agent");
    queryClient.clear();
  });

  it("hydrates detail cache with updated session when missing", () => {
    const queryClient = new QueryClient();
    const response = buildSession({
      id: "session-missing",
      agentName: "focus_agent",
      agent_name: "focus_agent",
      module_key: "focus_agent",
    });

    applyAgentAssignmentToSessionCache({
      queryClient,
      sessionId: response.id,
      agentName: "focus_agent",
      updatedSession: response,
    });

    const detail = queryClient.getQueryData<AgentSession>(
      sessionKeys.session(response.id),
    );
    expect(detail?.agentName).toBe("focus_agent");
    queryClient.clear();
  });
});
