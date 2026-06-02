import type { AgentMessage } from "@/types/agentMessage";
import type { PendingAgentMessage } from "@/types/pendingAgentMessage";

const LOCAL_MESSAGE_MATCH_WINDOW_MS = 2 * 60 * 1000;

const normalizeContentSnapshot = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

export const sortMessagesByTimestamp = (list: AgentMessage[]): AgentMessage[] =>
  [...list].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

export const pendingToAgentMessage = (
  pending: PendingAgentMessage,
): AgentMessage => ({
  id: pending.id,
  content: pending.content,
  sender: "user",
  timestamp: pending.createdAt,
  sessionId: pending.sessionId ?? undefined,
  agentName: pending.agentName ?? undefined,
  isPlaceholder: false,
  isTyping: false,
  isLocalOnly: true,
  deliveryState:
    pending.deliveryState === "sent" ? undefined : pending.deliveryState,
  errorMessage: pending.errorMessage ?? null,
});

const isLocalMessageSatisfiedByHistory = (
  localMessage: AgentMessage,
  historyMessage: AgentMessage,
): boolean => {
  if (localMessage.sender !== historyMessage.sender) return false;
  const localContent = normalizeContentSnapshot(localMessage.content ?? "");
  const historyContent = normalizeContentSnapshot(historyMessage.content ?? "");
  if (localContent && historyContent && localContent === historyContent) {
    const localTs = Date.parse(localMessage.timestamp);
    const historyTs = Date.parse(historyMessage.timestamp);
    if (!Number.isNaN(localTs) && !Number.isNaN(historyTs)) {
      return Math.abs(historyTs - localTs) <= LOCAL_MESSAGE_MATCH_WINDOW_MS;
    }
    return true;
  }
  return false;
};

export const mergeHistoryWithLocalMessages = (
  historyMessages: AgentMessage[],
  currentMessages: AgentMessage[],
): AgentMessage[] => {
  if (historyMessages.length === 0) {
    return currentMessages;
  }
  const historyIds = new Set(historyMessages.map((message) => message.id));
  const historyToolIds = new Set(
    historyMessages
      .filter((message) => message.kind === "tool" && message.toolCallId)
      .map((message) => message.toolCallId as string),
  );

  const preserved = currentMessages.filter((message) => {
    if (message.isSticky) {
      return true;
    }
    if (message.kind === "tool" && message.toolCallId) {
      return !historyToolIds.has(message.toolCallId);
    }
    if (message.isLocalOnly) {
      return !historyMessages.some((history) =>
        isLocalMessageSatisfiedByHistory(message, history),
      );
    }
    return !historyIds.has(message.id);
  });

  if (!preserved.length) {
    return historyMessages;
  }
  return sortMessagesByTimestamp([...historyMessages, ...preserved]);
};

export const isHistoryMatchForPending = (
  historyMessage: AgentMessage,
  pending: PendingAgentMessage,
): boolean => {
  if (historyMessage.sender !== "user") return false;
  const historyContent = normalizeContentSnapshot(historyMessage.content ?? "");
  if (!historyContent) return false;
  if (historyContent !== normalizeContentSnapshot(pending.content)) {
    return false;
  }
  const historyTs = Date.parse(historyMessage.timestamp);
  const pendingTs = Date.parse(pending.createdAt);
  if (Number.isNaN(historyTs) || Number.isNaN(pendingTs)) {
    return false;
  }
  return Math.abs(historyTs - pendingTs) <= LOCAL_MESSAGE_MATCH_WINDOW_MS;
};

export const findPendingMatchForMessage = (
  message: AgentMessage,
  pendingList: PendingAgentMessage[],
): PendingAgentMessage | null => {
  if (message.sender !== "user") return null;
  for (let index = pendingList.length - 1; index >= 0; index -= 1) {
    const pending = pendingList[index];
    if (
      pending.sessionId &&
      message.sessionId &&
      pending.sessionId !== message.sessionId
    ) {
      continue;
    }
    if (isHistoryMatchForPending(message, pending)) {
      return pending;
    }
  }
  return null;
};

const mergeMessage = (
  base: AgentMessage,
  incoming: Partial<AgentMessage>,
): AgentMessage => {
  const incomingContent =
    typeof incoming.content === "string" ? incoming.content : undefined;
  const content =
    incomingContent && incomingContent.length > 0
      ? incomingContent
      : base.content;
  const isTyping =
    typeof incoming.isTyping === "boolean" ? incoming.isTyping : base.isTyping;
  const isSticky =
    typeof incoming.isSticky === "boolean"
      ? incoming.isSticky
      : Boolean(base.isSticky);

  return {
    ...base,
    ...incoming,
    id: incoming.id ?? base.id,
    content,
    sessionId: incoming.sessionId ?? base.sessionId,
    agentName: incoming.agentName ?? base.agentName,
    isTyping,
    isPlaceholder:
      typeof incoming.isPlaceholder === "boolean"
        ? incoming.isPlaceholder
        : false,
    isSticky,
  };
};

const replaceMessageAtIndex = (
  list: AgentMessage[],
  index: number,
  incoming: Partial<AgentMessage>,
): AgentMessage[] => {
  const next = [...list];
  next[index] = mergeMessage(list[index], incoming);
  return next;
};

export const upsertMessage = (
  list: AgentMessage[],
  incoming: AgentMessage,
  fallbackMatcher?: (message: AgentMessage) => boolean,
): AgentMessage[] => {
  const existingIndex = list.findIndex((message) => message.id === incoming.id);
  if (existingIndex !== -1) {
    return replaceMessageAtIndex(list, existingIndex, incoming);
  }

  if (fallbackMatcher) {
    for (let idx = list.length - 1; idx >= 0; idx -= 1) {
      if (fallbackMatcher(list[idx])) {
        return replaceMessageAtIndex(list, idx, incoming);
      }
    }
  }

  return [...list, { ...incoming, isPlaceholder: false }];
};

export const appendDeltaToMessage = (
  list: AgentMessage[],
  deltaId: string,
  chunk: string,
  sessionId: string | null,
): AgentMessage[] => {
  if (!chunk) return list;

  const byIdIndex = list.findIndex((message) => message.id === deltaId);
  if (byIdIndex !== -1) {
    const target = list[byIdIndex];
    return replaceMessageAtIndex(list, byIdIndex, {
      id: deltaId || target.id,
      content: `${target.content ?? ""}${chunk}`,
      isTyping: true,
      isPlaceholder: false,
      isSticky: false,
    });
  }

  for (let idx = list.length - 1; idx >= 0; idx -= 1) {
    const candidate = list[idx];
    if (
      candidate.isPlaceholder &&
      candidate.sender === "agent" &&
      (!sessionId || candidate.sessionId === sessionId)
    ) {
      return replaceMessageAtIndex(list, idx, {
        id: deltaId || candidate.id,
        content: `${candidate.content ?? ""}${chunk}`,
        isTyping: true,
        isPlaceholder: false,
        isSticky: false,
      });
    }
  }

  return list;
};

export const isSameSession = (
  message: AgentMessage,
  sessionId: string | null,
): boolean => {
  if (!sessionId) return true;
  if (!message.sessionId) return true;
  return message.sessionId === sessionId;
};

type SessionMessageUtilsTestHooks = {
  LOCAL_MESSAGE_MATCH_WINDOW_MS: number;
  mergeMessage: typeof mergeMessage;
  replaceMessageAtIndex: typeof replaceMessageAtIndex;
};

declare global {
  var __SESSION_MESSAGE_UTILS_TEST_HOOKS__:
    | SessionMessageUtilsTestHooks
    | undefined;
}

if (import.meta.env.MODE === "test") {
  (
    globalThis as typeof globalThis & {
      __SESSION_MESSAGE_UTILS_TEST_HOOKS__?: SessionMessageUtilsTestHooks;
    }
  ).__SESSION_MESSAGE_UTILS_TEST_HOOKS__ = {
    LOCAL_MESSAGE_MATCH_WINDOW_MS,
    mergeMessage,
    replaceMessageAtIndex,
  };
}

export {};
