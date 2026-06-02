import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AgentSession } from "@/types/session";
import type { AgentProfileSummary } from "@/types/agent";
import { DEFAULT_AGENT_NAME } from "@/types/agent";
import { sessionApi } from "@/services/api/session";
import {
  invalidateSessionDetail,
  invalidateSessionLists,
} from "@/services/api/cacheInvalidation/sessions";
import { applyAgentAssignmentToSessionCache } from "@/utils/session";

interface UseSessionAgentOptions {
  resolvedSessionId: string | null;
  activeSession?: AgentSession | null;
  agentOptions: AgentProfileSummary[];
  onError?: (message: string) => void;
}

interface UseSessionAgentResult {
  selectedAgent: string;
  sessionAgentName: string | null;
  isAssigningAgent: boolean;
  agentOptionsAvailable: boolean;
  handleAgentSelect: (agentName: string) => Promise<void>;
  ensureAgentAssignment: (agentName?: string) => Promise<void>;
}

const extractSessionAgentName = (
  session: AgentSession | null | undefined,
): string | null => {
  if (!session) return null;
  const candidate =
    session.agentName ?? session.agent_name ?? session.module_key ?? null;
  return candidate ?? null;
};

export function useSessionAgent({
  resolvedSessionId,
  activeSession,
  agentOptions,
  onError,
}: UseSessionAgentOptions): UseSessionAgentResult {
  const queryClient = useQueryClient();
  const sessionAgentFromServer = extractSessionAgentName(activeSession);
  const [sessionAgentOverride, setSessionAgentOverride] = useState<
    string | null
  >(null);
  const sessionAgentName =
    sessionAgentOverride ?? sessionAgentFromServer ?? null;

  const [selectedAgent, setSelectedAgent] = useState(() => {
    if (sessionAgentName) return sessionAgentName;
    if (agentOptions.length > 0) {
      const defaultMatch = agentOptions.find(
        (profile) => profile.name === DEFAULT_AGENT_NAME,
      );
      return defaultMatch?.name ?? agentOptions[0].name;
    }
    return DEFAULT_AGENT_NAME;
  });
  const [isAssigningAgent, setIsAssigningAgent] = useState(false);
  const previousSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousSessionIdRef.current === resolvedSessionId) {
      return;
    }
    previousSessionIdRef.current = resolvedSessionId ?? null;
    setSessionAgentOverride(null);
    setSelectedAgent(() => {
      if (sessionAgentFromServer) {
        return sessionAgentFromServer;
      }
      if (agentOptions.length > 0) {
        const defaultMatch = agentOptions.find(
          (profile) => profile.name === DEFAULT_AGENT_NAME,
        );
        return defaultMatch?.name ?? agentOptions[0].name;
      }
      return DEFAULT_AGENT_NAME;
    });
  }, [agentOptions, resolvedSessionId, sessionAgentFromServer]);

  useEffect(() => {
    if (!sessionAgentOverride) return;
    if (
      sessionAgentFromServer &&
      sessionAgentFromServer === sessionAgentOverride
    ) {
      setSessionAgentOverride(null);
    }
  }, [sessionAgentFromServer, sessionAgentOverride]);

  useEffect(() => {
    if (sessionAgentName && sessionAgentName !== selectedAgent) {
      setSelectedAgent(sessionAgentName);
      return;
    }
    if (!agentOptions.length) return;
    const exists = agentOptions.some(
      (profile) => profile.name === selectedAgent,
    );
    if (!exists) {
      const fallback =
        sessionAgentName ??
        agentOptions.find((profile) => profile.name === DEFAULT_AGENT_NAME)
          ?.name ??
        agentOptions[0]?.name ??
        DEFAULT_AGENT_NAME;
      setSelectedAgent(fallback);
    }
  }, [agentOptions, selectedAgent, sessionAgentName]);

  const assignAgentToSession = useCallback(
    async (agent: string) => {
      if (!resolvedSessionId) return;
      if (sessionAgentName === agent) return;
      setIsAssigningAgent(true);
      try {
        const updatedSession = await sessionApi.updateSession(
          resolvedSessionId,
          {
            agent_name: agent,
          },
        );
        applyAgentAssignmentToSessionCache({
          queryClient,
          sessionId: resolvedSessionId,
          agentName: agent,
          updatedSession,
        });
        setSessionAgentOverride(agent);
        invalidateSessionLists(queryClient);
        invalidateSessionDetail(queryClient, resolvedSessionId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        onError?.(message);
        throw error;
      } finally {
        setIsAssigningAgent(false);
      }
    },
    [onError, queryClient, resolvedSessionId, sessionAgentName],
  );

  const handleAgentSelect = useCallback(
    async (agentName: string) => {
      setSelectedAgent(agentName);
      if (!resolvedSessionId) return;
      await assignAgentToSession(agentName);
    },
    [assignAgentToSession, resolvedSessionId],
  );

  const ensureAgentAssignment = useCallback(
    async (agentName?: string) => {
      const target = agentName ?? selectedAgent;
      if (!resolvedSessionId) return;
      if (sessionAgentName === target) return;
      await assignAgentToSession(target);
    },
    [assignAgentToSession, resolvedSessionId, selectedAgent, sessionAgentName],
  );

  const agentOptionsAvailable = useMemo(() => {
    if (agentOptions.length === 0) return false;
    return agentOptions.some((profile) => profile.name === selectedAgent);
  }, [agentOptions, selectedAgent]);

  return {
    selectedAgent,
    sessionAgentName,
    isAssigningAgent,
    agentOptionsAvailable,
    handleAgentSelect,
    ensureAgentAssignment,
  };
}
