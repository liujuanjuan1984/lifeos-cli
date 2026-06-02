import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { useSessionAgent } from "@/features/agent/controller/useSessionAgent";
import type { AgentProfileSummary } from "@/types/agent";
import type { AgentSession } from "@/types/session";
import { DEFAULT_AGENT_NAME } from "@/types/agent";
import { sessionApi } from "@/services/api/session";

vi.mock("@/services/api/session", () => ({
  sessionApi: {
    updateSession: vi.fn(),
  },
  sessionKeys: {
    lists: () => ["sessions", "list"],
    list: (filters?: { page?: number; size?: number }) => [
      "sessions",
      "list",
      filters ?? {},
    ],
    sessions: (filters?: { page?: number; size?: number }) => [
      "sessions",
      "list",
      filters ?? {},
    ],
    details: () => ["sessions", "detail"],
    session: (id: string) => ["sessions", "detail", id],
  },
}));

vi.mock("@/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/session")>();
  return {
    ...actual,
    applyAgentAssignmentToSessionCache: vi.fn(),
  };
});

const agentProfiles: AgentProfileSummary[] = [
  {
    name: "root_agent",
    description: "Root agent",
    tools: [],
    allow_unassigned_tools: true,
    system_prompt_en: null,
    prompt_version: "1",
  },
  {
    name: "habit_agent",
    description: "Habit agent",
    tools: [],
    allow_unassigned_tools: false,
    system_prompt_en: null,
    prompt_version: "1",
  },
];

const buildSession = (overrides: Partial<AgentSession> = {}): AgentSession => {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? "session-default",
    name: overrides.name ?? "Session",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    lastActivityAt: overrides.lastActivityAt ?? now,
    messageCount: overrides.messageCount ?? 0,
    isFavorite: overrides.isFavorite ?? false,
    agentName: overrides.agentName ?? null,
    module_key: overrides.module_key ?? overrides.agentName ?? null,
    ...overrides,
  };
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return wrapper;
};

describe("useSessionAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to root_agent when session has no assigned agent", () => {
    const session = buildSession({ id: "session-new", agentName: null });
    const { result } = renderHook((props) => useSessionAgent(props), {
      initialProps: {
        resolvedSessionId: session.id,
        activeSession: session,
        agentOptions: agentProfiles,
      },
      wrapper: createWrapper(),
    });

    expect(result.current.sessionAgentName).toBeNull();
    expect(result.current.selectedAgent).toBe(DEFAULT_AGENT_NAME);
  });

  it("switches selection when active session changes", async () => {
    const first = buildSession({
      id: "session-a",
      agentName: "habit_agent",
      module_key: "habit_agent",
    });
    const second = buildSession({
      id: "session-b",
      agentName: DEFAULT_AGENT_NAME,
      module_key: DEFAULT_AGENT_NAME,
    });

    const hook = renderHook((props) => useSessionAgent(props), {
      initialProps: {
        resolvedSessionId: first.id,
        activeSession: first,
        agentOptions: agentProfiles,
      },
      wrapper: createWrapper(),
    });

    expect(hook.result.current.selectedAgent).toBe("habit_agent");

    await act(async () => {
      hook.rerender({
        resolvedSessionId: second.id,
        activeSession: second,
        agentOptions: agentProfiles,
      });
    });

    await waitFor(() => {
      expect(hook.result.current.selectedAgent).toBe(DEFAULT_AGENT_NAME);
    });
  });

  it("updates backend when user selects a new agent", async () => {
    const session = buildSession({
      id: "session-choose",
      agentName: DEFAULT_AGENT_NAME,
    });
    const wrapper = createWrapper();

    vi.mocked(sessionApi.updateSession).mockResolvedValue({
      ...session,
      agentName: "habit_agent",
      agent_name: "habit_agent",
      module_key: "habit_agent",
    });

    const { result } = renderHook((props) => useSessionAgent(props), {
      initialProps: {
        resolvedSessionId: session.id,
        activeSession: session,
        agentOptions: agentProfiles,
      },
      wrapper,
    });

    await act(async () => {
      await result.current.handleAgentSelect("habit_agent");
    });

    expect(sessionApi.updateSession).toHaveBeenCalledWith(session.id, {
      agent_name: "habit_agent",
    });

    await waitFor(() => {
      expect(result.current.selectedAgent).toBe("habit_agent");
    });
  });

  it("clears local override when switching to a brand-new session", async () => {
    const existing = buildSession({
      id: "session-existing",
      agentName: DEFAULT_AGENT_NAME,
    });
    const fresh = buildSession({
      id: "session-fresh",
      agentName: null,
    });
    vi.mocked(sessionApi.updateSession).mockResolvedValue({
      ...existing,
      agentName: "habit_agent",
      agent_name: "habit_agent",
      module_key: "habit_agent",
    });

    const hook = renderHook((props) => useSessionAgent(props), {
      initialProps: {
        resolvedSessionId: existing.id,
        activeSession: existing,
        agentOptions: agentProfiles,
      },
      wrapper: createWrapper(),
    });

    await act(async () => {
      await hook.result.current.handleAgentSelect("habit_agent");
    });
    await waitFor(() => {
      expect(hook.result.current.selectedAgent).toBe("habit_agent");
    });

    await act(async () => {
      hook.rerender({
        resolvedSessionId: fresh.id,
        activeSession: fresh,
        agentOptions: agentProfiles,
      });
    });

    await waitFor(() => {
      expect(hook.result.current.selectedAgent).toBe(DEFAULT_AGENT_NAME);
      expect(hook.result.current.sessionAgentName).toBeNull();
    });
  });

  it("ensureAgentAssignment only calls backend when necessary", async () => {
    const session = buildSession({
      id: "session-ensure",
      agentName: null,
    });
    vi.mocked(sessionApi.updateSession).mockResolvedValue({
      ...session,
      agentName: "habit_agent",
      agent_name: "habit_agent",
      module_key: "habit_agent",
    });

    const { result } = renderHook((props) => useSessionAgent(props), {
      initialProps: {
        resolvedSessionId: session.id,
        activeSession: session,
        agentOptions: agentProfiles,
      },
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.ensureAgentAssignment("habit_agent");
    });
    expect(sessionApi.updateSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.ensureAgentAssignment("habit_agent");
    });
    expect(sessionApi.updateSession).toHaveBeenCalledTimes(1);
  });
});
