import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

import type { AgentSession } from "@/types/session";
import type { AgentProfileSummary } from "@/types/agent";
import ChatInterface from "@/components/agent/ChatInterface";
import type { ChatHistory } from "@/types/agentMessage";
import { renderWithProviders, setupTranslationMock } from "@test/utils";

const {
  getHistoryMock,
  listProfilesMock,
  updateSessionMock,
  sessionContextState,
  listSystemNotificationsMock,
  streamMessageMock,
} = vi.hoisted(() => {
  const sessionContextValue = {
    sessionContext: { boxes: [] },
    isLoading: false,
    isUpdating: false,
    addSessionBoxes: vi.fn(),
  };

  return {
    getHistoryMock: vi.fn<() => Promise<ChatHistory>>(async () => ({
      items: [],
      pagination: { page: 1, size: 0, total: 0, pages: 0 },
      meta: {},
      messages: [],
      totalCount: 0,
    })),
    listProfilesMock: vi.fn<
      () => Promise<{
        items: AgentProfileSummary[];
        pagination: {
          page: number;
          size: number;
          total: number;
          pages: number;
        };
        meta: { source?: string | null };
      }>
    >(async () => ({
      items: [],
      pagination: { page: 1, size: 0, total: 0, pages: 0 },
      meta: { source: "agent_registry" },
    })),
    updateSessionMock: vi.fn(async () => ({})),
    sessionContextState: { value: sessionContextValue },
    listSystemNotificationsMock: vi.fn(async () => ({
      items: [],
      pagination: {
        page: 1,
        size: 20,
        total: 0,
        pages: 0,
      },
      meta: {
        unreadCount: 0,
      },
    })),
    streamMessageMock: vi.fn(),
  };
});

vi.mock("@/services/api/agentMessage", () => ({
  agentMessageApi: {
    getHistory: getHistoryMock,
    streamMessage: streamMessageMock,
  },
  agentMessageKeys: {
    history: () => ["agentMessages", "history"],
    sessionHistory: (sessionId: string | null) => [
      "agentMessages",
      "history",
      sessionId,
    ],
  },
}));

vi.mock("@/services/api/agents", () => ({
  agentsApi: {
    listProfiles: listProfilesMock,
  },
  agentsKeys: {
    profiles: () => ["agents", "profiles"],
  },
}));

vi.mock("@/services/api/session", () => ({
  sessionApi: {
    updateSession: updateSessionMock,
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

vi.mock("@/services/api/notifications", () => ({
  notificationsApi: {
    markSystemNotificationsRead: vi.fn(async () => ({
      updated: 0,
      unreadCount: 0,
    })),
    listSystemNotifications: listSystemNotificationsMock,
  },
  notificationsKeys: {
    system: () => ["notifications", "system"],
    systemList: (id: string | null | undefined) => [
      "notifications",
      "system",
      "list",
      id ?? "default",
    ],
  },
}));

vi.mock("@/hooks/useSessionContext", () => ({
  useSessionContext: () => sessionContextState.value,
}));

vi.mock("@/components/agent/SessionContextBar", () => ({
  __esModule: true,
  default: () => <div data-testid="session-context-bar" />,
}));

vi.mock("@/components/agent/SessionContextPicker", () => ({
  __esModule: true,
  default: () => <div data-testid="session-context-picker" />,
}));

const baseSession: AgentSession = {
  id: "session-id",
  name: "Sample Session",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  lastActivityAt: "2025-01-01T00:00:00Z",
  messageCount: 0,
  isFavorite: false,
  sessionType: "chat",
  session_type: "chat",
};

const agentProfiles: AgentProfileSummary[] = [
  {
    name: "root_agent",
    description: "Root Agent",
    tools: [],
    allow_unassigned_tools: true,
    system_prompt_en: null,
    prompt_version: "1",
  },
  {
    name: "habit_agent",
    description: "Habit Agent",
    tools: [],
    allow_unassigned_tools: false,
    system_prompt_en: null,
    prompt_version: "1",
  },
];

describe("ChatInterface", () => {
  beforeEach(() => {
    setupTranslationMock();
    getHistoryMock.mockClear();
    listProfilesMock.mockClear();
    updateSessionMock.mockClear();
    sessionContextState.value.addSessionBoxes.mockClear();
    listSystemNotificationsMock.mockClear();
    streamMessageMock.mockReset();
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    listProfilesMock.mockResolvedValue({
      items: agentProfiles,
      pagination: {
        page: 1,
        size: agentProfiles.length,
        total: agentProfiles.length,
        pages: agentProfiles.length > 0 ? 1 : 0,
      },
      meta: { source: "agent_registry" },
    });
  });

  it("renders agent controls and input for chat sessions", () => {
    renderWithProviders(
      <ChatInterface
        activeSessionId={baseSession.id}
        activeSession={baseSession}
        sessionType="chat"
      />,
    );

    expect(screen.getByText("agent.selectLabel")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("agent.inputPlaceholderWithAgent"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("session-context-picker")).toBeInTheDocument();
  });

  it("hides agent controls and input for system sessions", () => {
    const systemSession: AgentSession = {
      ...baseSession,
      id: "system-session",
      sessionType: "system",
      session_type: "system",
    };

    renderWithProviders(
      <ChatInterface
        activeSessionId={systemSession.id}
        activeSession={systemSession}
        sessionType="system"
      />,
    );

    expect(screen.queryByText("agent.selectLabel")).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("agent.inputPlaceholderWithAgent"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("session-context-picker"),
    ).not.toBeInTheDocument();
  });

  it("defaults agent selector to root_agent for new sessions", async () => {
    renderWithProviders(
      <ChatInterface
        activeSessionId={baseSession.id}
        activeSession={{ ...baseSession, agentName: null }}
        sessionType="chat"
      />,
    );

    const selector = (await screen.findByLabelText(
      "agent.selectLabel",
    )) as HTMLInputElement;
    await waitFor(() => {
      expect(selector.value).toBe("root_agent");
    });
  });

  it("locks agent selector after sending the first message", async () => {
    const timestamp = new Date().toISOString();
    streamMessageMock.mockImplementation(async (_payload, { onEvent }) => {
      onEvent({
        event: "agent_message",
        data: {
          id: "agent-message",
          content: "你好",
          sender: "agent",
          timestamp,
        },
      });
      onEvent({ event: "stream_end", data: {} });
    });

    renderWithProviders(
      <ChatInterface
        activeSessionId={baseSession.id}
        activeSession={{ ...baseSession, agentName: null }}
        sessionType="chat"
      />,
    );

    const selector = (await screen.findByLabelText(
      "agent.selectLabel",
    )) as HTMLInputElement;
    const textarea = await screen.findByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hello" } });
    const sendButton = screen.getByRole("button", {
      name: "agent.sendMessageAriaLabel",
    });
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(streamMessageMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(selector.disabled).toBe(true);
    });
  });
});
