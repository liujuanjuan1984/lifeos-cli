import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

import type { AgentMessage, ChatHistory } from "@/types/agentMessage";
import type { PendingAgentMessage } from "@/types/pendingAgentMessage";
import {
  dispatchSessionMessageAction,
  getSessionMessageSnapshot,
  useSessionMessageState,
} from "@/stores/sessionMessageStore";
import {
  findPendingMatchForMessage,
  isHistoryMatchForPending,
  isSameSession,
  mergeHistoryWithLocalMessages,
  pendingToAgentMessage,
  sortMessagesByTimestamp,
} from "@/utils/session";

const HISTORY_EMPTY_GRACE_PERIOD_MS = 8 * 1000;

interface UseAgentMessagesOptions {
  resolvedSessionId: string | null;
  isSystemSession: boolean;
  isStreaming: boolean;
  isHistoryFrozen?: boolean;
  chatHistory?: (ChatHistory & { sessionId: string | null }) | null;
  systemNotificationMessages: AgentMessage[] | null;
  pendingMessages: PendingAgentMessage[];
  removePendingMessage: (id: string) => void;
  normalizeMessage: (
    message: AgentMessage | (AgentMessage & { is_typing?: boolean }),
  ) => AgentMessage;
  lastStreamCompletionAtRef?: MutableRefObject<number | null> | null;
}

interface UseAgentMessagesResult {
  messages: AgentMessage[];
  resolvePendingMatchForMessage: (message: AgentMessage) => string | null;
  registerPendingMessageSnapshot: (pending: PendingAgentMessage) => void;
}

export const useAgentMessages = ({
  resolvedSessionId,
  isSystemSession,
  isStreaming,
  isHistoryFrozen = false,
  chatHistory,
  systemNotificationMessages,
  pendingMessages,
  removePendingMessage,
  normalizeMessage,
  lastStreamCompletionAtRef,
}: UseAgentMessagesOptions): UseAgentMessagesResult => {
  const normalizedSessionId = resolvedSessionId ?? null;
  const sessionSlice = useSessionMessageState(normalizedSessionId);
  const messages = sessionSlice.messages;
  const messagesRef = useRef<AgentMessage[]>(messages);
  const previousSessionIdRef = useRef<string | null>(null);
  const pendingMessagesRef = useRef<PendingAgentMessage[]>([]);

  const setMessages = useCallback<Dispatch<SetStateAction<AgentMessage[]>>>(
    (value) => {
      const snapshot = getSessionMessageSnapshot(normalizedSessionId);
      const current = snapshot.messages;
      const nextValue = typeof value === "function" ? value(current) : value;
      if (nextValue === current) {
        return;
      }
      dispatchSessionMessageAction(normalizedSessionId, {
        type: "replaceMessages",
        payload: { messages: nextValue },
      });
    },
    [normalizedSessionId],
  );

  useEffect(() => {
    if (previousSessionIdRef.current === resolvedSessionId) {
      return;
    }
    previousSessionIdRef.current = resolvedSessionId;
    pendingMessagesRef.current = [];
  }, [resolvedSessionId]);

  useEffect(() => {
    pendingMessagesRef.current = pendingMessages;
  }, [pendingMessages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const registerPendingMessageSnapshot = useCallback(
    (pending: PendingAgentMessage) => {
      pendingMessagesRef.current = [
        ...pendingMessagesRef.current.filter((item) => item.id !== pending.id),
        pending,
      ];
    },
    [],
  );

  const resolvePendingMatchForMessage = useCallback(
    (message: AgentMessage): string | null => {
      const snapshot = pendingMessagesRef.current;
      if (!snapshot.length) return null;
      const match = findPendingMatchForMessage(message, snapshot);
      if (!match) {
        return null;
      }
      removePendingMessage(match.id);
      pendingMessagesRef.current = pendingMessagesRef.current.filter(
        (item) => item.id !== match.id,
      );
      return match.id;
    },
    [removePendingMessage],
  );

  useEffect(() => {
    if (!pendingMessages.length) {
      return;
    }
    setMessages((prev) => {
      const pendingMap = new Map(
        pendingMessages.map((pending) => [pending.id, pending]),
      );
      let changed = false;
      const next: AgentMessage[] = [];

      prev.forEach((message) => {
        if (!message.isLocalOnly) {
          next.push(message);
          return;
        }
        if (message.sender !== "user") {
          next.push(message);
          return;
        }
        const pending = pendingMap.get(message.id);
        if (!pending) {
          changed = true;
          return;
        }
        const pendingAgentMessage = pendingToAgentMessage(pending);
        pendingMap.delete(message.id);
        if (
          message.content !== pendingAgentMessage.content ||
          message.deliveryState !== pendingAgentMessage.deliveryState ||
          message.errorMessage !== pendingAgentMessage.errorMessage
        ) {
          next.push({ ...message, ...pendingAgentMessage });
          changed = true;
        } else {
          next.push(message);
        }
      });

      if (pendingMap.size > 0) {
        pendingMap.forEach((pending) => {
          next.push(pendingToAgentMessage(pending));
        });
        changed = true;
      }

      if (!changed) return prev;
      return sortMessagesByTimestamp(next);
    });
  }, [pendingMessages, setMessages]);

  useEffect(() => {
    if (isSystemSession) {
      return;
    }
    if (!chatHistory || typeof chatHistory.messages === "undefined") {
      return;
    }
    if (chatHistory.sessionId !== resolvedSessionId) {
      return;
    }
    if (isStreaming) return;
    if (isHistoryFrozen) return;

    const normalized = chatHistory.messages.map(normalizeMessage);

    if (normalized.length === 0) {
      if ((chatHistory.totalCount ?? 0) === 0) {
        const hasServerBackedMessages = messagesRef.current.some(
          (message) =>
            !message.isLocalOnly && isSameSession(message, resolvedSessionId),
        );
        const lastCompletion = lastStreamCompletionAtRef?.current ?? null;
        const withinGracePeriod =
          hasServerBackedMessages &&
          lastCompletion !== null &&
          Date.now() - lastCompletion <= HISTORY_EMPTY_GRACE_PERIOD_MS;
        if (withinGracePeriod) {
          return;
        }
        setMessages((prev) => {
          if (!prev.length) return prev;
          const preserved = prev.filter((msg) => {
            if (msg.isSticky) return true;
            if (!msg.isLocalOnly) return false;
            return true;
          });
          return preserved.length === prev.length ? prev : preserved;
        });
      }
      return;
    }

    if (
      lastStreamCompletionAtRef &&
      lastStreamCompletionAtRef.current !== null
    ) {
      lastStreamCompletionAtRef.current = null;
    }

    const pendingSnapshot = pendingMessagesRef.current;
    const resolvedIds: string[] = [];
    if (pendingSnapshot.length) {
      pendingSnapshot.forEach((pending) => {
        const matched = normalized.some((message) =>
          isHistoryMatchForPending(message, pending),
        );
        if (matched) {
          resolvedIds.push(pending.id);
        }
      });
    }

    const merged = mergeHistoryWithLocalMessages(
      normalized,
      messagesRef.current,
    );
    const current = messagesRef.current;
    const shouldUpdate =
      merged.length !== current.length ||
      merged.some((message, index) => {
        const existing = current[index];
        if (!existing) return true;
        return (
          message.id !== existing.id ||
          message.content !== existing.content ||
          message.deliveryState !== existing.deliveryState ||
          message.errorMessage !== existing.errorMessage
        );
      });

    if (shouldUpdate) {
      setMessages(merged);
    }

    if (resolvedIds.length) {
      resolvedIds.forEach((id) => removePendingMessage(id));
    }
  }, [
    chatHistory,
    isStreaming,
    isSystemSession,
    isHistoryFrozen,
    normalizeMessage,
    removePendingMessage,
    resolvedSessionId,
    lastStreamCompletionAtRef,
    setMessages,
  ]);

  useEffect(() => {
    if (!isSystemSession) return;
    if (systemNotificationMessages === null) return;
    const previous = messagesRef.current;
    if (systemNotificationMessages.length === 0) {
      if (previous.length > 0) {
        setMessages([]);
      }
      return;
    }
    if (
      previous.length === systemNotificationMessages.length &&
      previous.every(
        (msg, index) =>
          msg.id === systemNotificationMessages[index].id &&
          Boolean(
            (msg.metadata as Record<string, unknown> | undefined)?.unread,
          ) ===
            Boolean(
              (
                systemNotificationMessages[index].metadata as
                  | Record<string, unknown>
                  | undefined
              )?.unread,
            ),
      )
    ) {
      return;
    }
    setMessages(systemNotificationMessages);
  }, [isSystemSession, systemNotificationMessages, setMessages]);

  return {
    messages,
    resolvePendingMatchForMessage,
    registerPendingMessageSnapshot,
  };
};
