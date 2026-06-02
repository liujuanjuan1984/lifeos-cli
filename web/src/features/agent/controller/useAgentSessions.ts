import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sessionApi, sessionKeys } from "@/services/api/session";
import type { CreateSessionRequest } from "@/types/session";
import { useSessionsMutations } from "./useSessionsMutations";
import { normalizeAgentSession } from "@/utils/session";

interface UseAgentSessionsOptions {
  limit?: number;
  offset?: number;
  enabled?: boolean;
  initialSessionId?: string | null;
  autoSelectMostRecent?: boolean;
}

export const useAgentSessions = (options: UseAgentSessionsOptions = {}) => {
  const {
    limit = 50,
    offset = 0,
    enabled = true,
    initialSessionId = null,
    autoSelectMostRecent = true,
  } = options;
  const size = limit;
  const page = limit > 0 ? Math.floor(offset / limit) + 1 : 1;
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initialSessionId,
  );
  const pendingSessionIdRef = useRef<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: sessionKeys.list({ page, size }),
    queryFn: () => sessionApi.getSessions(page, size),
    enabled,
  });
  const {
    createSession: createSessionMutation,
    deleteSession: deleteSessionMutation,
  } = useSessionsMutations();

  const sessions = useMemo(
    () =>
      (sessionsQuery.data?.items ?? []).map((session) =>
        normalizeAgentSession(session),
      ),
    [sessionsQuery.data],
  );

  const chatSessions = useMemo(
    () =>
      sessions.filter(
        (session) => (session.sessionType ?? "chat") !== "system",
      ),
    [sessions],
  );

  const systemSessions = useMemo(
    () =>
      sessions.filter(
        (session) => (session.sessionType ?? "chat") === "system",
      ),
    [sessions],
  );

  useEffect(() => {
    const pendingId = pendingSessionIdRef.current;
    if (!pendingId) return;
    const exists = sessions.some((session) => session.id === pendingId);
    if (exists) {
      pendingSessionIdRef.current = null;
    }
  }, [sessions]);

  useEffect(() => {
    if (!autoSelectMostRecent) {
      return;
    }

    if (sessions.length === 0) {
      if (activeSessionId !== null) {
        setActiveSessionId(null);
      }
      return;
    }

    if (pendingSessionIdRef.current) {
      return;
    }

    const hasActiveSession = activeSessionId
      ? sessions.some((session) => session.id === activeSessionId)
      : false;

    if (!hasActiveSession) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId, autoSelectMostRecent]);

  const activeSession = useMemo(() => {
    if (!activeSessionId) {
      return null;
    }
    return sessions.find((session) => session.id === activeSessionId) ?? null;
  }, [activeSessionId, sessions]);

  const selectSession = useCallback((sessionId: string | null) => {
    pendingSessionIdRef.current = null;
    setActiveSessionId(sessionId);
  }, []);

  const createSession = useCallback(
    async (payload: CreateSessionRequest) => {
      const result = await createSessionMutation.mutateAsync(payload);
      pendingSessionIdRef.current = result.id;
      setActiveSessionId(result.id);
      return result;
    },
    [createSessionMutation],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      await deleteSessionMutation.mutateAsync(sessionId);
      if (activeSessionId === sessionId) {
        const fallback = sessions.find((session) => session.id !== sessionId);
        pendingSessionIdRef.current = null;
        setActiveSessionId(fallback?.id ?? null);
      }
    },
    [activeSessionId, deleteSessionMutation, sessions],
  );

  return {
    sessions,
    chatSessions,
    systemSessions,
    activeSessionId,
    activeSession,
    setActiveSessionId: selectSession,
    selectSession,
    createSession,
    deleteSession,
    isLoading: sessionsQuery.isLoading,
    isFetching: sessionsQuery.isFetching,
    isCreatingSession: createSessionMutation.isPending,
    isDeletingSession: deleteSessionMutation.isPending,
    refetch: sessionsQuery.refetch,
    createSessionMutation,
    deleteSessionMutation,
  };
};
