import { useSyncExternalStore } from "react";
import type { AgentMessage } from "@/types/agentMessage";
import type { PendingAgentMessage } from "@/types/pendingAgentMessage";
import {
  appendDeltaToMessage,
  sortMessagesByTimestamp,
  upsertMessage,
} from "@/utils/session";

type HistorySource = "history" | "system";

interface SessionMessageHistoryState {
  isHydrated: boolean;
  totalCount: number | null;
  lastFetchedAt: number | null;
  source: HistorySource | null;
}

interface SessionMessageState {
  sessionId: string | null;
  messages: AgentMessage[];
  pendingMessages: PendingAgentMessage[];
  history: SessionMessageHistoryState;
  lastUpdatedAt: number;
}

type SessionMessageAction =
  | {
      type: "hydrate";
      payload: {
        messages: AgentMessage[];
        totalCount?: number | null;
        hydratedAt?: number | null;
        source?: HistorySource | null;
      };
    }
  | {
      type: "appendOptimistic";
      payload: { message: AgentMessage };
    }
  | {
      type: "upsertMessage";
      payload: {
        message: AgentMessage;
        fallbackMatcher?: (candidate: AgentMessage) => boolean;
      };
    }
  | {
      type: "appendDelta";
      payload: {
        id: string;
        chunk: string;
      };
    }
  | {
      type: "replaceMessages";
      payload: { messages: AgentMessage[] };
    }
  | {
      type: "removeMessage";
      payload: { id: string };
    }
  | {
      type: "setPendingMessages";
      payload: { pendingMessages: PendingAgentMessage[] };
    }
  | {
      type: "markPendingResolved";
      payload: { pendingId: string };
    }
  | { type: "clear" };

type SessionKey = string;
const DEFAULT_SESSION_KEY = "__agent_session_default__";

const sessionStateMap = new Map<SessionKey, SessionMessageState>();
const sessionListeners = new Map<SessionKey, Set<() => void>>();

const toSessionKey = (sessionId: string | null | undefined): SessionKey =>
  sessionId && sessionId.length > 0 ? sessionId : DEFAULT_SESSION_KEY;

const now = (): number => Date.now();

const createInitialState = (sessionId: string | null): SessionMessageState => ({
  sessionId,
  messages: [],
  pendingMessages: [],
  history: {
    isHydrated: false,
    totalCount: null,
    lastFetchedAt: null,
    source: null,
  },
  lastUpdatedAt: now(),
});

const getOrCreateState = (sessionId: string | null): SessionMessageState => {
  const key = toSessionKey(sessionId);
  const existing = sessionStateMap.get(key);
  if (existing) return existing;
  const created = createInitialState(sessionId ?? null);
  sessionStateMap.set(key, created);
  return created;
};

const notify = (key: SessionKey): void => {
  const listeners = sessionListeners.get(key);
  if (!listeners) return;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // swallow errors to avoid breaking other listeners
    }
  });
};

const maybeUpdateState = (
  key: SessionKey,
  previous: SessionMessageState,
  next: SessionMessageState,
): SessionMessageState => {
  if (next === previous) {
    return previous;
  }
  sessionStateMap.set(key, next);
  notify(key);
  return next;
};

const withUpdatedMessages = (
  state: SessionMessageState,
  nextMessages: AgentMessage[],
): SessionMessageState => {
  if (state.messages === nextMessages) {
    return state;
  }
  return {
    ...state,
    messages: nextMessages,
    lastUpdatedAt: now(),
  };
};

const reducer = (
  state: SessionMessageState,
  action: SessionMessageAction,
): SessionMessageState => {
  switch (action.type) {
    case "hydrate": {
      const nextMessages = sortMessagesByTimestamp(action.payload.messages);
      return {
        ...withUpdatedMessages(state, nextMessages),
        history: {
          isHydrated: true,
          totalCount:
            typeof action.payload.totalCount === "number"
              ? action.payload.totalCount
              : action.payload.totalCount === null
                ? null
                : state.history.totalCount,
          lastFetchedAt:
            typeof action.payload.hydratedAt === "number"
              ? action.payload.hydratedAt
              : now(),
          source: action.payload.source ?? state.history.source ?? "history",
        },
      };
    }
    case "appendOptimistic": {
      const appended = sortMessagesByTimestamp([
        ...state.messages,
        action.payload.message,
      ]);
      return withUpdatedMessages(state, appended);
    }
    case "upsertMessage": {
      const updated = upsertMessage(
        state.messages,
        action.payload.message,
        action.payload.fallbackMatcher,
      );
      return withUpdatedMessages(state, updated);
    }
    case "appendDelta": {
      const updated = appendDeltaToMessage(
        state.messages,
        action.payload.id,
        action.payload.chunk,
        state.sessionId,
      );
      return withUpdatedMessages(state, updated);
    }
    case "removeMessage": {
      const filtered = state.messages.filter(
        (message) => message.id !== action.payload.id,
      );
      if (filtered.length === state.messages.length) {
        return state;
      }
      return withUpdatedMessages(state, filtered);
    }
    case "replaceMessages": {
      const next = [...action.payload.messages];
      return withUpdatedMessages(state, next);
    }
    case "setPendingMessages": {
      const nextPending = [...action.payload.pendingMessages];
      const shouldUpdate =
        nextPending.length !== state.pendingMessages.length ||
        nextPending.some((message, index) => {
          const existing = state.pendingMessages[index];
          return (
            !existing ||
            existing.id !== message.id ||
            existing.deliveryState !== message.deliveryState ||
            existing.errorMessage !== message.errorMessage ||
            existing.content !== message.content
          );
        });
      if (!shouldUpdate) {
        return state;
      }
      return {
        ...state,
        pendingMessages: nextPending,
        lastUpdatedAt: now(),
      };
    }
    case "markPendingResolved": {
      const filtered = state.pendingMessages.filter(
        (message) => message.id !== action.payload.pendingId,
      );
      if (filtered.length === state.pendingMessages.length) {
        return state;
      }
      return {
        ...state,
        pendingMessages: filtered,
        lastUpdatedAt: now(),
      };
    }
    case "clear": {
      if (
        state.messages.length === 0 &&
        state.pendingMessages.length === 0 &&
        !state.history.isHydrated
      ) {
        return state;
      }
      const cleared = createInitialState(state.sessionId ?? null);
      return {
        ...cleared,
        history: {
          ...cleared.history,
          source: state.history.source,
        },
      };
    }
    default:
      return state;
  }
};

export const dispatchSessionMessageAction = (
  sessionId: string | null,
  action: SessionMessageAction | SessionMessageAction[],
): SessionMessageState => {
  const key = toSessionKey(sessionId);
  const previous = getOrCreateState(sessionId ?? null);
  const actions = Array.isArray(action) ? action : [action];
  let nextState = previous;
  for (const current of actions) {
    nextState = reducer(nextState, current);
  }
  return maybeUpdateState(key, previous, nextState);
};

const subscribeSession = (
  sessionId: string | null,
  listener: () => void,
): (() => void) => {
  const key = toSessionKey(sessionId);
  const listeners = sessionListeners.get(key) ?? new Set();
  listeners.add(listener);
  sessionListeners.set(key, listeners);
  return () => {
    const bucket = sessionListeners.get(key);
    if (!bucket) return;
    bucket.delete(listener);
    if (bucket.size === 0) {
      sessionListeners.delete(key);
    }
  };
};

export const getSessionMessageSnapshot = (
  sessionId: string | null,
): SessionMessageState => getOrCreateState(sessionId ?? null);

export const useSessionMessageState = (
  sessionId: string | null,
): SessionMessageState =>
  useSyncExternalStore(
    (listener) => subscribeSession(sessionId ?? null, listener),
    () => getSessionMessageSnapshot(sessionId ?? null),
    () => getSessionMessageSnapshot(sessionId ?? null),
  );

const resetSessionMessageStore = (): void => {
  sessionStateMap.clear();
  sessionListeners.clear();
};

type SessionMessageStoreTestHooks = {
  resetSessionMessageStore: () => void;
};

declare global {
  var __SESSION_MESSAGE_STORE_TEST_HOOKS__:
    | SessionMessageStoreTestHooks
    | undefined;
}

if (import.meta.env.MODE === "test") {
  (
    globalThis as typeof globalThis & {
      __SESSION_MESSAGE_STORE_TEST_HOOKS__?: SessionMessageStoreTestHooks;
    }
  ).__SESSION_MESSAGE_STORE_TEST_HOOKS__ = {
    resetSessionMessageStore,
  };
}

export {};
