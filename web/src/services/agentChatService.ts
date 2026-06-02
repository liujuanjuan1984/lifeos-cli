import type { AgentMessage } from "@/types/agentMessage";
import {
  dispatchSessionMessageAction,
  getSessionMessageSnapshot,
} from "@/stores/sessionMessageStore";

type MessageUpdater = (messages: AgentMessage[]) => AgentMessage[];

export const appendOptimisticMessages = (
  sessionId: string | null,
  messages: AgentMessage[],
): void => {
  if (!messages.length) return;
  dispatchSessionMessageAction(
    sessionId,
    messages.map((message) => ({
      type: "appendOptimistic" as const,
      payload: { message },
    })),
  );
};

export const upsertSessionMessage = (
  sessionId: string | null,
  message: AgentMessage,
  fallbackMatcher?: (candidate: AgentMessage) => boolean,
): void => {
  dispatchSessionMessageAction(sessionId, {
    type: "upsertMessage",
    payload: { message, fallbackMatcher },
  });
};

export const appendSessionDelta = (
  sessionId: string | null,
  deltaId: string,
  chunk: string,
): void => {
  if (!chunk) return;
  dispatchSessionMessageAction(sessionId, {
    type: "appendDelta",
    payload: { id: deltaId, chunk },
  });
};

export const updateSessionMessages = (
  sessionId: string | null,
  updater: MessageUpdater,
): void => {
  const snapshot = getSessionMessageSnapshot(sessionId);
  const current = snapshot.messages;
  const next = updater(current);
  if (next === current) {
    return;
  }
  dispatchSessionMessageAction(sessionId, {
    type: "replaceMessages",
    payload: { messages: next },
  });
};
