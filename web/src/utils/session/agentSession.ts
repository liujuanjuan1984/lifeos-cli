import type { QueryClient } from "@tanstack/react-query";
import type { AgentSession } from "@/types/session";
import type { AgentSessionListResponse } from "@/services/api/session";
import { sessionKeys } from "@/services/api/session";

export const normalizeAgentSession = (session: AgentSession): AgentSession => {
  const resolvedAgentName =
    session.agentName ?? session.agent_name ?? session.module_key ?? null;
  const createdAt = session.createdAt ?? session.created_at ?? "";
  const updatedAt = session.updatedAt ?? session.updated_at ?? createdAt;
  const lastActivityAt =
    session.lastActivityAt ?? session.last_activity_at ?? updatedAt;
  const isFavorite = session.isFavorite ?? session.is_favorite ?? false;
  const sessionType = session.sessionType ?? session.session_type ?? "chat";
  const unreadCount = session.unreadCount ?? session.unread_count ?? 0;
  const costUsdTotal = session.costUsdTotal ?? session.cost_usd_total ?? null;

  return {
    ...session,
    agentName: resolvedAgentName,
    agent_name: session.agent_name ?? resolvedAgentName,
    module_key: session.module_key ?? resolvedAgentName,
    createdAt,
    created_at: session.created_at ?? createdAt,
    updatedAt,
    updated_at: session.updated_at ?? updatedAt,
    lastActivityAt,
    last_activity_at: session.last_activity_at ?? lastActivityAt,
    isFavorite,
    is_favorite: session.is_favorite ?? isFavorite,
    sessionType,
    session_type: session.session_type ?? sessionType,
    unreadCount,
    unread_count: session.unread_count ?? unreadCount,
    costUsdTotal,
    cost_usd_total: session.cost_usd_total ?? costUsdTotal,
    messageCount:
      session.messageCount ??
      (session as { message_count?: number }).message_count ??
      0,
    message_count:
      (session as { message_count?: number }).message_count ??
      session.messageCount ??
      0,
    promptTokensTotal:
      session.promptTokensTotal ??
      (session as { prompt_tokens_total?: number }).prompt_tokens_total ??
      0,
    prompt_tokens_total:
      (session as { prompt_tokens_total?: number }).prompt_tokens_total ??
      session.promptTokensTotal ??
      0,
    completionTokensTotal:
      session.completionTokensTotal ??
      (session as { completion_tokens_total?: number })
        .completion_tokens_total ??
      0,
    completion_tokens_total:
      (session as { completion_tokens_total?: number })
        .completion_tokens_total ??
      session.completionTokensTotal ??
      0,
    totalTokensTotal:
      session.totalTokensTotal ??
      (session as { total_tokens_total?: number }).total_tokens_total ??
      0,
    total_tokens_total:
      (session as { total_tokens_total?: number }).total_tokens_total ??
      session.totalTokensTotal ??
      0,
  };
};

interface AgentCacheUpdateOptions {
  queryClient: QueryClient;
  sessionId: string;
  agentName: string;
  updatedSession?: AgentSession | null;
}

export const applyAgentAssignmentToSessionCache = ({
  queryClient,
  sessionId,
  agentName,
  updatedSession,
}: AgentCacheUpdateOptions): void => {
  const normalizedUpdate = updatedSession
    ? normalizeAgentSession(updatedSession)
    : null;

  queryClient.setQueryData(
    sessionKeys.session(sessionId),
    (current: AgentSession | undefined) => {
      if (normalizedUpdate) return normalizedUpdate;
      if (!current) return current;
      return {
        ...current,
        agentName,
        agent_name: agentName,
        module_key: agentName,
      };
    },
  );

  queryClient.setQueriesData(
    { queryKey: sessionKeys.lists() },
    (
      current: AgentSessionListResponse | AgentSession[] | undefined,
    ): AgentSessionListResponse | AgentSession[] | undefined => {
      if (!current) return current;
      if (Array.isArray(current)) {
        return current.map((session) => {
          if (session.id !== sessionId) return session;
          if (normalizedUpdate) {
            return {
              ...session,
              ...normalizedUpdate,
            };
          }
          return {
            ...session,
            agentName,
            agent_name: agentName,
            module_key: agentName,
          };
        });
      }
      return {
        ...current,
        items: current.items.map((session) => {
          if (session.id !== sessionId) return session;
          if (normalizedUpdate) {
            return {
              ...session,
              ...normalizedUpdate,
            };
          }
          return {
            ...session,
            agentName,
            agent_name: agentName,
            module_key: agentName,
          };
        }),
      };
    },
  );
};
