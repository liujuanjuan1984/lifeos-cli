import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentMessage, ChatHistory } from "@/types/agentMessage";
import type { PendingAgentMessage } from "@/types/pendingAgentMessage";
import { useAgentMessages } from "@/features/agent/controller/useAgentMessages";

type UseAgentMessagesOptions = Parameters<typeof useAgentMessages>[0];

const baseMessage = (overrides: Partial<AgentMessage> = {}): AgentMessage => ({
  id: overrides.id ?? "msg-1",
  content: overrides.content ?? "hello",
  sender: overrides.sender ?? "user",
  timestamp: overrides.timestamp ?? new Date().toISOString(),
  ...overrides,
});

const basePending = (
  overrides: Partial<PendingAgentMessage> = {},
): PendingAgentMessage => ({
  id: overrides.id ?? "pending-1",
  sessionId: overrides.sessionId ?? "session-1",
  content: overrides.content ?? "hello",
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  deliveryState: overrides.deliveryState ?? "pending",
  agentName: overrides.agentName ?? "demo",
  errorMessage: overrides.errorMessage ?? null,
});

const baseHistory = (
  messages: AgentMessage[],
  overrides: Partial<ChatHistory & { sessionId: string | null }> = {},
): ChatHistory & { sessionId: string | null } => ({
  items: messages,
  pagination: {
    page: 1,
    size: messages.length,
    total: overrides.totalCount ?? messages.length,
    pages: 1,
  },
  meta: {},
  messages,
  totalCount: overrides.totalCount ?? messages.length,
  sessionId: overrides.sessionId ?? "session-1",
});

const normalize = (message: AgentMessage): AgentMessage => message;

describe("useAgentMessages", () => {
  it("synchronizes pending messages into local state", async () => {
    const removePendingMessage = vi.fn();
    const pending = basePending();

    const buildProps = (overrides: Partial<UseAgentMessagesOptions> = {}) => ({
      resolvedSessionId: "session-1",
      isSystemSession: false,
      isStreaming: false,
      chatHistory: null,
      systemNotificationMessages: null,
      pendingMessages: [] as PendingAgentMessage[],
      removePendingMessage,
      normalizeMessage: normalize,
      lastStreamCompletionAtRef: { current: null },
      ...overrides,
    });

    const { result, rerender } = renderHook(
      (props) => useAgentMessages(props),
      {
        initialProps: buildProps(),
      },
    );

    await act(async () => {
      rerender(buildProps({ pendingMessages: [pending] }));
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].id).toBe(pending.id);
      expect(result.current.messages[0].isLocalOnly).toBe(true);
    });
  });

  it("resolves pending entries when matching history arrives", async () => {
    const removePendingMessage = vi.fn();
    const pending = basePending();
    const historyMessage = baseMessage({ id: "server-1" });

    const buildProps = (overrides: Partial<UseAgentMessagesOptions> = {}) => ({
      resolvedSessionId: "session-1",
      isSystemSession: false,
      isStreaming: false,
      chatHistory: null as (ChatHistory & { sessionId: string | null }) | null,
      systemNotificationMessages: null as AgentMessage[] | null,
      pendingMessages: [pending] as PendingAgentMessage[],
      removePendingMessage,
      normalizeMessage: normalize,
      lastStreamCompletionAtRef: { current: null },
      ...overrides,
    });

    const { result, rerender } = renderHook(
      (props) => useAgentMessages(props),
      {
        initialProps: buildProps(),
      },
    );

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    await act(async () => {
      rerender(buildProps({ chatHistory: baseHistory([historyMessage]) }));
    });

    await waitFor(() => {
      expect(removePendingMessage).toHaveBeenCalledWith(pending.id);
      expect(
        result.current.messages.some((msg) => msg.id === historyMessage.id),
      ).toBe(true);
    });
  });

  it("adopts system notification messages for system sessions", async () => {
    const notification = baseMessage({
      id: "notification-1",
      sender: "system",
      kind: "system_notification",
    });

    const baseRemove = vi.fn();
    const buildProps = (overrides: Partial<UseAgentMessagesOptions> = {}) => ({
      resolvedSessionId: "session-1",
      isSystemSession: true,
      isStreaming: false,
      chatHistory: null,
      systemNotificationMessages: null as AgentMessage[] | null,
      pendingMessages: [] as PendingAgentMessage[],
      removePendingMessage: baseRemove,
      normalizeMessage: normalize,
      lastStreamCompletionAtRef: { current: null },
      ...overrides,
    });

    const { result, rerender } = renderHook(
      (props) => useAgentMessages(props),
      {
        initialProps: buildProps(),
      },
    );

    await act(async () => {
      rerender(buildProps({ systemNotificationMessages: [notification] }));
    });

    await waitFor(() => {
      expect(result.current.messages).toEqual([notification]);
    });
  });
});
