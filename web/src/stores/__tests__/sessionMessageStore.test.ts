import { beforeEach, describe, expect, it } from "vitest";
import type { AgentMessage } from "@/types/agentMessage";
import type { PendingAgentMessage } from "@/types/pendingAgentMessage";
import {
  dispatchSessionMessageAction,
  getSessionMessageSnapshot,
} from "@/stores/sessionMessageStore";
import { resetSessionMessageStoreForTests } from "./helpers/sessionMessageStoreTestUtils";

let idCounter = 0;
const nextId = (prefix: string): string => `${prefix}-${++idCounter}`;

const baseMessage = (overrides: Partial<AgentMessage> = {}): AgentMessage => ({
  id: overrides.id ?? nextId("msg"),
  content: overrides.content ?? "hello",
  sender: overrides.sender ?? "user",
  timestamp: overrides.timestamp ?? new Date().toISOString(),
  sessionId: overrides.sessionId ?? "session-a",
  ...overrides,
});

const basePending = (
  overrides: Partial<PendingAgentMessage> = {},
): PendingAgentMessage => ({
  id: overrides.id ?? nextId("pending"),
  sessionId: overrides.sessionId ?? "session-a",
  content: overrides.content ?? "hello",
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  deliveryState: overrides.deliveryState ?? "pending",
  agentName: overrides.agentName ?? "demo",
  errorMessage: overrides.errorMessage ?? null,
});

describe("sessionMessageStore", () => {
  beforeEach(() => {
    resetSessionMessageStoreForTests();
    idCounter = 0;
  });

  it("hydrates messages for a session without touching others", () => {
    const first = baseMessage({ id: "1" });
    const second = baseMessage({ id: "2" });
    dispatchSessionMessageAction("session-a", {
      type: "hydrate",
      payload: { messages: [first, second], totalCount: 2 },
    });

    const sessionA = getSessionMessageSnapshot("session-a");
    const sessionB = getSessionMessageSnapshot("session-b");
    expect(sessionA.messages.map((msg) => msg.id)).toEqual(["1", "2"]);
    expect(sessionA.history.isHydrated).toBe(true);
    expect(sessionA.history.totalCount).toBe(2);
    expect(sessionB.messages).toHaveLength(0);
    expect(sessionB.history.isHydrated).toBe(false);
  });

  it("appends optimistic messages and keeps them scoped per session", () => {
    const optimistic = baseMessage({
      id: "opt-1",
      sessionId: "session-a",
      content: "draft",
      isLocalOnly: true,
    });
    dispatchSessionMessageAction("session-a", {
      type: "appendOptimistic",
      payload: { message: optimistic },
    });
    dispatchSessionMessageAction("session-b", {
      type: "appendOptimistic",
      payload: {
        message: {
          ...optimistic,
          id: "opt-2",
          sessionId: "session-b",
          content: "other",
        },
      },
    });

    expect(getSessionMessageSnapshot("session-a").messages).toHaveLength(1);
    expect(getSessionMessageSnapshot("session-b").messages).toHaveLength(1);
    expect(getSessionMessageSnapshot("session-a").messages[0].id).toBe("opt-1");
  });

  it("applies delta updates to agent placeholders", () => {
    const placeholder = baseMessage({
      id: "placeholder-1",
      sessionId: "session-a",
      sender: "agent",
      isPlaceholder: true,
      content: "",
    });
    dispatchSessionMessageAction("session-a", {
      type: "appendOptimistic",
      payload: { message: placeholder },
    });
    dispatchSessionMessageAction("session-a", {
      type: "appendDelta",
      payload: { id: "placeholder-1", chunk: "Hello" },
    });
    const snapshot = getSessionMessageSnapshot("session-a");
    expect(snapshot.messages[0].content).toBe("Hello");
    expect(snapshot.messages[0].isPlaceholder).toBe(false);
  });

  it("tracks pending messages per session", () => {
    const pendingOne = basePending({ id: "pending-1" });
    const pendingTwo = basePending({ id: "pending-2" });
    dispatchSessionMessageAction("session-a", {
      type: "setPendingMessages",
      payload: { pendingMessages: [pendingOne, pendingTwo] },
    });
    expect(getSessionMessageSnapshot("session-a").pendingMessages).toHaveLength(
      2,
    );

    dispatchSessionMessageAction("session-a", {
      type: "markPendingResolved",
      payload: { pendingId: "pending-1" },
    });
    const pending = getSessionMessageSnapshot("session-a").pendingMessages;
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe("pending-2");
  });
});
