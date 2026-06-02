import { useCallback } from "react";
import type { PendingAgentMessage } from "@/types/pendingAgentMessage";
import {
  dispatchSessionMessageAction,
  getSessionMessageSnapshot,
  useSessionMessageState,
} from "@/stores/sessionMessageStore";

export type { PendingAgentMessage } from "@/types/pendingAgentMessage";

export function usePendingAgentMessages(sessionId: string | null) {
  const normalizedSessionId = sessionId ?? null;
  const sessionSlice = useSessionMessageState(normalizedSessionId);
  const pendingMessages = sessionSlice.pendingMessages;

  const updatePendingMessages = useCallback(
    (updater: (current: PendingAgentMessage[]) => PendingAgentMessage[]) => {
      const snapshot = getSessionMessageSnapshot(normalizedSessionId);
      const next = updater(snapshot.pendingMessages);
      dispatchSessionMessageAction(normalizedSessionId, {
        type: "setPendingMessages",
        payload: { pendingMessages: next },
      });
    },
    [normalizedSessionId],
  );

  const addPendingMessage = useCallback(
    (message: PendingAgentMessage) => {
      updatePendingMessages((current) => {
        const existingIndex = current.findIndex(
          (item) => item.id === message.id,
        );
        if (existingIndex === -1) {
          return [...current, message];
        }
        const next = [...current];
        next[existingIndex] = message;
        return next;
      });
    },
    [updatePendingMessages],
  );

  const updatePendingMessage = useCallback(
    (
      id: string,
      updater: (message: PendingAgentMessage) => PendingAgentMessage,
    ) => {
      updatePendingMessages((current) => {
        const index = current.findIndex((item) => item.id === id);
        if (index === -1) {
          return current;
        }
        const updated = updater(current[index]);
        if (updated === current[index]) {
          return current;
        }
        const next = [...current];
        next[index] = updated;
        return next;
      });
    },
    [updatePendingMessages],
  );

  const markPendingMessageFailed = useCallback(
    (id: string, errorMessage: string | null = null) => {
      updatePendingMessage(id, (message) => ({
        ...message,
        deliveryState: "failed",
        errorMessage,
      }));
    },
    [updatePendingMessage],
  );

  const markPendingMessageSent = useCallback(
    (id: string) => {
      updatePendingMessage(id, (message) => ({
        ...message,
        deliveryState: "sent",
        errorMessage: null,
      }));
    },
    [updatePendingMessage],
  );

  const removePendingMessage = useCallback(
    (id: string) => {
      updatePendingMessages((current) =>
        current.filter((message) => message.id !== id),
      );
    },
    [updatePendingMessages],
  );

  return {
    pendingMessages,
    addPendingMessage,
    markPendingMessageFailed,
    markPendingMessageSent,
    removePendingMessage,
  };
}
