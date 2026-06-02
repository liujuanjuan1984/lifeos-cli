import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AgentMessage,
  AgentStreamEvent,
  ChatHistory,
  TokenUsageSnapshot,
  ToolRunStatus,
  ToolRunSummary,
} from "@/types/agentMessage";
import type { AgentProfileSummary } from "@/types/agent";
import type { AgentSession, AgentSessionType } from "@/types/session";
import type { SystemNotification } from "@/types/notification";
import {
  agentMessageApi,
  agentMessageKeys,
  RateLimitError,
} from "@/services/api/agentMessage";
import { agentsApi, agentsKeys } from "@/services/api/agents";
import {
  invalidateSessionHistory,
  invalidateSessionLists,
} from "@/services/api/cacheInvalidation/sessions";
import { resolveSessionId } from "@/utils/session";
import { logger } from "@/utils/core";
import { formatTokens } from "@/utils/core";
import { formatDateTime } from "@/utils/datetime";
import { useAgentRateLimit } from "./useAgentRateLimit";
import {
  usePendingAgentMessages,
  type PendingAgentMessage,
} from "./usePendingAgentMessages";
import { useAgentMessages } from "./useAgentMessages";
import { isSameSession } from "@/utils/session";
import { useAgentStreaming, type StreamPhase } from "./useAgentStreaming";
import { useToast } from "@/contexts/ToastContext";
import { clearAuth } from "@/services/auth";
import { useSystemNotifications } from "./useSystemNotifications";
import {
  appendOptimisticMessages,
  appendSessionDelta,
  updateSessionMessages,
  upsertSessionMessage,
} from "@/services/agentChatService";
import { useSessionAgent } from "./useSessionAgent";

interface RateLimitNotice {
  message: string;
  title?: string;
}

interface UseAgentChatSessionOptions {
  activeSessionId?: string | null;
  activeSession?: AgentSession | null;
  sessionType?: AgentSessionType | null;
  onMarkNotificationsRead?: (payload: {
    sessionId: string | null;
    messageIds: string[];
  }) => void;
}

interface UseAgentChatSessionResult {
  resolvedSessionId: string | null;
  isSystemSession: boolean;
  messages: AgentMessage[];
  isStreaming: boolean;
  abortReason: string | null;
  handleSendMessage: (content: string) => Promise<void>;
  rateLimitNotice: RateLimitNotice | null;
  selectedAgent: string;
  selectedAgentProfile: AgentProfileSummary | undefined;
  agentOptions: AgentProfileSummary[];
  translateAgentName: (agentName: string) => string;
  handleAgentSelect: (agentName: string) => Promise<void>;
  sendDisabled: boolean;
  usageTotal: TokenUsageSnapshot | null;
  sessionAgentName: string | null;
  isAssigningAgent: boolean;
  isAgentLocked: boolean;
}

const STREAM_STALL_TIMEOUT_MS = Number(
  import.meta.env.VITE_AGENT_STREAM_STALL_TIMEOUT_MS ?? 15_000,
);

type SessionScopedChatHistory = ChatHistory & {
  sessionId: string | null;
};

export function useAgentChatSession(
  options: UseAgentChatSessionOptions = {},
): UseAgentChatSessionResult {
  const {
    activeSessionId = null,
    activeSession = null,
    sessionType = null,
    onMarkNotificationsRead,
  } = options;
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const toast = useToast();
  const showErrorToast = useCallback(
    (message: string) => {
      toast.showError(t("common.error"), message);
    },
    [toast, t],
  );
  const showWarningToast = useCallback(
    (message: string) => {
      toast.showWarning(t("common.warning"), message);
    },
    [toast, t],
  );

  const resolvedSessionId = resolveSessionId(activeSessionId);
  const {
    pendingMessages,
    addPendingMessage,
    markPendingMessageFailed,
    markPendingMessageSent,
    removePendingMessage,
  } = usePendingAgentMessages(resolvedSessionId);
  const currentSessionIdRef = useRef<string | null>(null);
  const lastStreamCompletionAtRef = useRef<number | null>(null);
  useEffect(() => {
    setHistoryGuardReason(null);
  }, [resolvedSessionId]);
  const notificationAckRef = useRef(new Set<string>());

  const resolvedSessionType: AgentSessionType =
    sessionType ??
    activeSession?.sessionType ??
    (activeSession?.session_type as AgentSessionType | undefined) ??
    "chat";
  const isSystemSession = resolvedSessionType === "system";
  const isScheduledSession = resolvedSessionType === "scheduled";

  const [usageTotal, setUsageTotal] = useState<TokenUsageSnapshot | null>(null);
  const { rateLimitInfo, setRateLimitInfo, clearRateLimitInfo } =
    useAgentRateLimit();
  const [historyGuardReason, setHistoryGuardReason] = useState<string | null>(
    null,
  );

  const activateHistoryGuard = useCallback((reason: string) => {
    setHistoryGuardReason(reason);
  }, []);

  const releaseHistoryGuard = useCallback((reason?: string) => {
    setHistoryGuardReason((current) => {
      if (!current) return current;
      if (reason && current !== reason) {
        return current;
      }
      return null;
    });
  }, []);

  const redirectToLogin = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      clearAuth();
    } catch {
      // ignore errors while clearing auth
    }
    const current = window.location.pathname + window.location.search;
    const loginPath = `/login?next=${encodeURIComponent(current)}`;
    if (!window.location.pathname.startsWith("/login")) {
      window.location.replace(loginPath);
    }
  }, []);

  const handleStreamStall = useCallback(
    ({
      abort,
    }: {
      abort: (reason?: string, nextPhase?: StreamPhase) => void;
    }) => {
      const friendlyMessage = t("agent.errors.streamTimeout");
      logger.warn("Detected stalled stream, aborting request");
      abort(friendlyMessage, "stalled");
      showWarningToast(friendlyMessage);
    },
    [showWarningToast, t],
  );

  const {
    phase: streamPhase,
    isStreaming,
    abortReason,
    setAbortReason,
    startStreaming,
    completeStreaming,
    abortStreaming,
    setPhase: setStreamPhase,
    registerStreamActivity,
  } = useAgentStreaming({
    stallTimeoutMs: STREAM_STALL_TIMEOUT_MS,
    onStall: handleStreamStall,
  });

  const { data: chatHistory } = useQuery<SessionScopedChatHistory>({
    queryKey: agentMessageKeys.sessionHistory(resolvedSessionId),
    queryFn: async () => {
      const history = await agentMessageApi.getHistory({
        sessionId: resolvedSessionId || undefined,
      });
      return { ...history, sessionId: resolvedSessionId };
    },
    enabled: !!resolvedSessionId && !isSystemSession,
    placeholderData: (previousData) =>
      previousData?.sessionId === resolvedSessionId ? previousData : undefined,
  });

  const { systemNotifications, systemNotificationsQuery } =
    useSystemNotifications({
      sessionId: resolvedSessionId,
      enabled: isSystemSession && Boolean(resolvedSessionId),
      includeList: true,
      listLimit: 100,
    });
  const notificationsSessionId =
    systemNotificationsQuery.data?.sessionId ?? null;

  useEffect(() => {
    if (!activeSession) {
      setUsageTotal(null);
      return;
    }

    const promptTokens = Number(
      activeSession.promptTokensTotal ?? activeSession.prompt_tokens_total ?? 0,
    );
    const completionTokens = Number(
      activeSession.completionTokensTotal ??
        activeSession.completion_tokens_total ??
        0,
    );
    const totalTokens = Number(
      activeSession.totalTokensTotal ?? activeSession.total_tokens_total ?? 0,
    );
    const costRaw =
      activeSession.costUsdTotal ?? activeSession.cost_usd_total ?? null;
    const costValue =
      typeof costRaw === "string" && costRaw.length > 0 ? costRaw : null;

    setUsageTotal({
      prompt_tokens: Number.isFinite(promptTokens) ? promptTokens : 0,
      completion_tokens: Number.isFinite(completionTokens)
        ? completionTokens
        : 0,
      total_tokens: Number.isFinite(totalTokens) ? totalTokens : 0,
      cost_usd: costValue,
    });
  }, [activeSession]);

  useEffect(() => {
    notificationAckRef.current.clear();
  }, [resolvedSessionId]);

  const { data: agentProfilesData } = useQuery({
    queryKey: agentsKeys.profiles(),
    queryFn: async () => {
      const response = await agentsApi.listProfiles();
      return response.items ?? [];
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60,
    placeholderData: (previousData) => previousData,
  });

  const agentOptions = useMemo(
    () => agentProfilesData ?? [],
    [agentProfilesData],
  );

  const {
    selectedAgent,
    sessionAgentName,
    isAssigningAgent,
    agentOptionsAvailable,
    handleAgentSelect,
    ensureAgentAssignment,
  } = useSessionAgent({
    resolvedSessionId,
    activeSession,
    agentOptions,
    onError: showErrorToast,
  });

  const translateAgentName = useCallback(
    (agentName: string) => {
      const key = `agent.agents.${agentName}`;
      const translated = t(key);
      return translated === key ? agentName : translated;
    },
    [t],
  );

  const selectedAgentProfile = useMemo(() => {
    return agentOptions.find((profile) => profile.name === selectedAgent);
  }, [agentOptions, selectedAgent]);

  const sendDisabled =
    isStreaming ||
    isAssigningAgent ||
    !resolvedSessionId ||
    !agentOptionsAvailable ||
    isSystemSession ||
    isScheduledSession;

  const normalizeMessage = useCallback(
    (
      message: AgentMessage | (AgentMessage & { is_typing?: boolean }),
    ): AgentMessage => {
      const rawKind = ((message as { kind?: AgentMessage["kind"] }).kind ??
        (message as { message_type?: AgentMessage["kind"] }).message_type ??
        (message as { messageType?: AgentMessage["kind"] }).messageType ??
        "chat") as AgentMessage["kind"];
      const messageType = ((
        message as { messageType?: AgentMessage["messageType"] }
      ).messageType ??
        (message as { message_type?: AgentMessage["messageType"] })
          .message_type ??
        rawKind) as AgentMessage["messageType"];
      const severity =
        (message as { severity?: AgentMessage["severity"] }).severity ??
        (
          message as {
            severity?: AgentMessage["severity"];
          }
        ).severity ??
        undefined;
      const metadata =
        (message as { metadata?: Record<string, unknown> }).metadata ??
        undefined;

      const effectiveAgentName: string | undefined =
        sessionAgentName ?? undefined;

      const extractAgentName = (
        value: string | null | undefined,
      ): string | undefined => (value == null ? undefined : value);

      const incomingSessionId =
        resolveSessionId(
          (message as { sessionId?: string | null }).sessionId ??
            (message as { session_id?: string | null }).session_id ??
            null,
        ) ??
        resolvedSessionId ??
        undefined;

      const base: AgentMessage = {
        id: message.id,
        content: message.content ?? "",
        sender: message.sender,
        timestamp: message.timestamp,
        sessionId: incomingSessionId,
        agentName:
          extractAgentName(
            (message as { agentName?: string | null }).agentName,
          ) ??
          extractAgentName(
            (message as { agent_name?: string | null }).agent_name,
          ) ??
          effectiveAgentName,
        kind: rawKind,
        messageType,
        severity,
        metadata,
        isTyping: Boolean((message as { is_typing?: boolean }).is_typing),
        isLocalOnly: false,
      };

      if ("tool_name" in message) {
        base.toolName = (message as { tool_name?: string }).tool_name;
      }
      if ("tool_call_id" in message) {
        base.toolCallId = (message as { tool_call_id?: string }).tool_call_id;
      }
      if ("tool_status" in message) {
        base.toolStatus = (
          message as { tool_status?: ToolRunStatus }
        ).tool_status;
      }

      return base;
    },
    [resolvedSessionId, sessionAgentName],
  );

  const mapNotificationToMessage = useCallback(
    (notification: SystemNotification): AgentMessage => ({
      id: notification.id,
      content: notification.body,
      sender: "system",
      timestamp: notification.createdAt,
      sessionId: notification.sessionId,
      agentName: sessionAgentName ?? undefined,
      kind: "system_notification",
      messageType: "system_notification",
      severity: notification.severity,
      metadata: {
        title: notification.title,
        severity: notification.severity,
        payload: notification.metadata ?? {},
        unread: notification.unread,
        readAt: notification.readAt,
      },
    }),
    [sessionAgentName],
  );

  const systemNotificationMessages = useMemo(() => {
    if (
      !isSystemSession ||
      notificationsSessionId !== resolvedSessionId ||
      !systemNotifications
    ) {
      return null;
    }
    if (!systemNotifications.length) {
      return [];
    }
    const ordered = [...systemNotifications];
    return ordered.slice().reverse().map(mapNotificationToMessage);
  }, [
    isSystemSession,
    mapNotificationToMessage,
    notificationsSessionId,
    resolvedSessionId,
    systemNotifications,
  ]);

  const shouldFreezeHistory = isAssigningAgent || Boolean(historyGuardReason);

  const {
    messages,
    resolvePendingMatchForMessage,
    registerPendingMessageSnapshot,
  } = useAgentMessages({
    resolvedSessionId,
    isSystemSession,
    isStreaming,
    isHistoryFrozen: shouldFreezeHistory,
    chatHistory: chatHistory ?? null,
    systemNotificationMessages,
    pendingMessages,
    removePendingMessage,
    normalizeMessage,
    lastStreamCompletionAtRef,
  });

  const hasUserMessages = useMemo(
    () =>
      messages.some(
        (message) =>
          message.sender === "user" &&
          !message.isPlaceholder &&
          (!message.sessionId || message.sessionId === resolvedSessionId),
      ),
    [messages, resolvedSessionId],
  );
  const isAgentLocked = hasUserMessages;

  const upsertToolMessage = useCallback(
    (run: ToolRunSummary, sessionOverride?: string | null) => {
      const targetSession = sessionOverride ?? resolvedSessionId ?? null;
      updateSessionMessages(targetSession, (prev) => {
        const id = `tool-${run.tool_call_id}`;
        const existingIndex = prev.findIndex((msg) => msg.id === id);
        const existingMessage = existingIndex >= 0 ? prev[existingIndex] : null;
        const safeName = run.tool_name || t("agent.toolRun.unknownTool");
        const status: ToolRunStatus = run.status ?? "started";
        const detail = run.message ?? null;
        const lines: string[] = [];

        if (status === "started") {
          lines.push(t("agent.toolRun.started", { tool: safeName }));
        } else if (status === "finished") {
          if (detail && detail.trim().length > 0) {
            lines.push(
              t("agent.toolRun.finishedWithResult", {
                tool: safeName,
                result: detail,
              }),
            );
          } else {
            lines.push(t("agent.toolRun.finished", { tool: safeName }));
          }
        } else {
          lines.push(
            t("agent.toolRun.failed", {
              tool: safeName,
              reason:
                detail && detail.trim().length > 0
                  ? detail
                  : t("common.unknownError"),
            }),
          );
        }

        const progress = run.progress;
        if (progress) {
          const progressParts: string[] = [];
          if (typeof progress.percent === "number") {
            progressParts.push(
              t("agent.toolRun.progressPercent", {
                value: Math.round(progress.percent),
              }),
            );
          }
          if (progress.label) {
            progressParts.push(progress.label);
          }
          if (progress.detail && progress.detail !== progress.label) {
            progressParts.push(progress.detail);
          }
          if (progressParts.length) {
            lines.push(progressParts.join(" · "));
          }
        }

        const content = lines.join("\n");
        const startedAt =
          run.started_at ?? existingMessage?.toolStartedAt ?? null;
        const finishedAt =
          run.finished_at ?? existingMessage?.toolFinishedAt ?? null;
        const durationMs =
          typeof run.duration_ms === "number"
            ? run.duration_ms
            : (existingMessage?.toolDurationMs ?? null);
        const progressState =
          run.progress ?? existingMessage?.toolProgress ?? null;
        const sequence =
          typeof run.sequence === "number"
            ? run.sequence
            : (existingMessage?.toolSequence ?? null);

        const baseMessage: AgentMessage = {
          id,
          content,
          sender: "system",
          timestamp:
            existingMessage?.timestamp ?? startedAt ?? new Date().toISOString(),
          kind: "tool",
          toolCallId: run.tool_call_id,
          toolName: run.tool_name,
          toolStatus: status,
          toolMessage: run.message ?? null,
          toolArguments: run.arguments ?? null,
          toolSequence: sequence,
          toolStartedAt: startedAt,
          toolFinishedAt: finishedAt,
          toolDurationMs: durationMs,
          toolProgress: progressState,
          isLocalOnly: true,
          sessionId: targetSession ?? undefined,
        };

        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...prev[existingIndex],
            ...baseMessage,
            timestamp: prev[existingIndex].timestamp,
          };
          return next;
        }

        return [...prev, baseMessage];
      });
    },
    [resolvedSessionId, t],
  );

  useEffect(() => {
    if (!isSystemSession || !messages.length) return;
    const unreadIds = messages
      .filter((msg) => {
        if (msg.messageType !== "system_notification") return false;
        const metadataRaw =
          (msg.metadata as Record<string, unknown> | undefined) ??
          (msg.message_metadata as Record<string, unknown> | undefined);
        const unreadFlag =
          metadataRaw && typeof metadataRaw["unread"] === "boolean"
            ? (metadataRaw["unread"] as boolean)
            : false;
        return unreadFlag;
      })
      .map((msg) => msg.id)
      .filter((id) => !notificationAckRef.current.has(id));
    if (!unreadIds.length) return;
    unreadIds.forEach((id) => notificationAckRef.current.add(id));
    onMarkNotificationsRead?.({
      sessionId: resolvedSessionId,
      messageIds: unreadIds,
    });
  }, [isSystemSession, messages, onMarkNotificationsRead, resolvedSessionId]);

  useEffect(() => {
    if (!isStreaming || !resolvedSessionId) return;
    if (
      currentSessionIdRef.current &&
      currentSessionIdRef.current !== resolvedSessionId
    ) {
      abortStreaming();
    }
    currentSessionIdRef.current = resolvedSessionId;
  }, [resolvedSessionId, isStreaming, abortStreaming]);

  useEffect(
    () => () => {
      abortStreaming();
    },
    [abortStreaming],
  );

  const rateLimitNotice = useMemo(() => {
    if (!rateLimitInfo) return null;

    const usedText =
      typeof rateLimitInfo.used === "number"
        ? formatTokens(rateLimitInfo.used)
        : "—";
    const limitText =
      typeof rateLimitInfo.limit === "number"
        ? formatTokens(rateLimitInfo.limit)
        : "—";

    let hours = 0;
    let minutes = 0;
    let title: string | undefined;
    if (rateLimitInfo.resetAt) {
      const resetTime = Date.parse(rateLimitInfo.resetAt);
      if (!Number.isNaN(resetTime)) {
        const diffMs = Math.max(0, resetTime - Date.now());
        hours = Math.floor(diffMs / 3600000);
        minutes = Math.floor((diffMs % 3600000) / 60000);
        title = formatDateTime(new Date(resetTime).toISOString());
      } else {
        title = rateLimitInfo.resetAt;
      }
    }

    return {
      message: t("agent.quota.exceededMessage", {
        used: usedText,
        limit: limitText,
        hours,
        minutes,
      }),
      title,
    };
  }, [rateLimitInfo, t]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (isSystemSession || isScheduledSession) {
        showWarningToast(t("agent.notifications.readonlyMode"));
        return;
      }
      const trimmed = content.trim();
      if (!trimmed) return;
      if (isStreaming) return;
      if (!resolvedSessionId) {
        showErrorToast(t("agent.errors.sessionRequired"));
        return;
      }

      if (!agentOptionsAvailable) {
        showErrorToast(t("agent.noAgentsAvailable"));
        return;
      }

      try {
        await ensureAgentAssignment(selectedAgent);
      } catch {
        return;
      }

      const targetSessionId = resolvedSessionId;

      const nowMs = Date.now();
      const timestamp = new Date(nowMs).toISOString();
      const tempUserId = `temp-user-${nowMs}`;
      const tempAgentId = `temp-agent-${nowMs + 1}`;
      const historyGuardId = `history-guard-${tempAgentId}`;
      activateHistoryGuard(historyGuardId);
      let historyGuardReleased = false;
      const releaseHistoryGuardOnce = () => {
        if (historyGuardReleased) return;
        historyGuardReleased = true;
        releaseHistoryGuard(historyGuardId);
        updateSessionMessages(targetSessionId, (prev) => {
          let changed = false;
          const next = prev.map((msg) => {
            if (msg.id !== tempAgentId || !msg.isSticky) {
              return msg;
            }
            changed = true;
            return { ...msg, isSticky: false };
          });
          return changed ? next : prev;
        });
      };

      appendOptimisticMessages(targetSessionId, [
        {
          id: tempUserId,
          content: trimmed,
          sender: "user",
          timestamp,
          sessionId: targetSessionId,
          agentName: selectedAgent,
          isPlaceholder: false,
          isLocalOnly: true,
          deliveryState: "pending",
          errorMessage: null,
        },
        {
          id: tempAgentId,
          content: "",
          sender: "agent",
          timestamp,
          isTyping: true,
          sessionId: targetSessionId,
          agentName: selectedAgent,
          isPlaceholder: true,
          isLocalOnly: true,
          isSticky: true,
        },
      ]);

      const pendingPayload: PendingAgentMessage = {
        id: tempUserId,
        sessionId: targetSessionId,
        content: trimmed,
        createdAt: timestamp,
        deliveryState: "pending",
        agentName: selectedAgent,
        errorMessage: null,
      };
      addPendingMessage(pendingPayload);
      registerPendingMessageSnapshot(pendingPayload);

      currentSessionIdRef.current = targetSessionId;
      const controller = startStreaming();

      let hasClearedRateLimit = false;
      const ensureRateLimitCleared = () => {
        if (hasClearedRateLimit) return;
        hasClearedRateLimit = true;
        clearRateLimitInfo();
      };

      try {
        await queryClient.cancelQueries({
          queryKey: agentMessageKeys.sessionHistory(targetSessionId),
        });

        await agentMessageApi.streamMessage(
          {
            content: trimmed,
            session_id: targetSessionId,
            agent_name: selectedAgent,
          },
          {
            signal: controller.signal,
            onEvent: (event: AgentStreamEvent) => {
              if (event.event !== "error") {
                ensureRateLimitCleared();
              }
              if (event.event !== "stream_end") {
                registerStreamActivity();
              }
              if (event.event !== "heartbeat") {
                releaseHistoryGuardOnce();
              }
              switch (event.event) {
                case "message": {
                  const normalized = normalizeMessage(event.data);
                  const resolvedPendingId =
                    normalized.sender === "user"
                      ? resolvePendingMatchForMessage(normalized)
                      : null;
                  upsertSessionMessage(
                    targetSessionId,
                    normalized,
                    (candidate) => {
                      if (
                        resolvedPendingId &&
                        candidate.id === resolvedPendingId &&
                        candidate.sender === "user"
                      ) {
                        return true;
                      }
                      return (
                        Boolean(candidate.isPlaceholder) &&
                        candidate.sender === normalized.sender &&
                        isSameSession(candidate, targetSessionId)
                      );
                    },
                  );
                  break;
                }
                case "agent_message": {
                  const normalized = normalizeMessage({
                    ...event.data,
                    is_typing: true,
                  });
                  upsertSessionMessage(
                    targetSessionId,
                    normalized,
                    (candidate) =>
                      Boolean(candidate.isPlaceholder) &&
                      candidate.sender === "agent" &&
                      isSameSession(candidate, targetSessionId),
                  );
                  break;
                }
                case "delta": {
                  appendSessionDelta(
                    targetSessionId,
                    event.data.id,
                    event.data.content,
                  );
                  break;
                }
                case "heartbeat": {
                  logger.debug("Heartbeat event received", event.data);
                  break;
                }
                case "tool_started": {
                  upsertToolMessage(
                    {
                      tool_call_id: event.data.tool_call_id,
                      tool_name: event.data.tool_name,
                      status:
                        (event.data.status as ToolRunStatus | undefined) ??
                        "started",
                      message: null,
                      arguments:
                        event.data.arguments &&
                        typeof event.data.arguments === "object"
                          ? (event.data.arguments as Record<string, unknown>)
                          : null,
                      sequence:
                        typeof event.data.sequence === "number"
                          ? event.data.sequence
                          : null,
                      started_at:
                        typeof event.data.started_at === "string"
                          ? event.data.started_at
                          : null,
                      finished_at: null,
                      duration_ms: null,
                      progress: null,
                    },
                    targetSessionId,
                  );
                  break;
                }
                case "tool_progress": {
                  upsertToolMessage(
                    {
                      tool_call_id: event.data.tool_call_id,
                      tool_name: event.data.tool_name,
                      status:
                        (event.data.status as ToolRunStatus | undefined) ??
                        "started",
                      message: null,
                      arguments: null,
                      sequence:
                        typeof event.data.sequence === "number"
                          ? event.data.sequence
                          : null,
                      started_at: null,
                      finished_at: null,
                      duration_ms: null,
                      progress: event.data.progress ?? null,
                    },
                    targetSessionId,
                  );
                  break;
                }
                case "tool_finished": {
                  upsertToolMessage(
                    {
                      tool_call_id: event.data.tool_call_id,
                      tool_name: event.data.tool_name,
                      status:
                        (event.data.status as ToolRunStatus | undefined) ??
                        "finished",
                      message:
                        event.data.result === null ||
                        event.data.result === undefined
                          ? null
                          : String(event.data.result),
                      arguments: null,
                      sequence:
                        typeof event.data.sequence === "number"
                          ? event.data.sequence
                          : null,
                      started_at: null,
                      finished_at:
                        typeof event.data.finished_at === "string"
                          ? event.data.finished_at
                          : null,
                      duration_ms:
                        typeof event.data.duration_ms === "number"
                          ? event.data.duration_ms
                          : null,
                      progress: null,
                    },
                    targetSessionId,
                  );
                  break;
                }
                case "tool_failed": {
                  upsertToolMessage(
                    {
                      tool_call_id: event.data.tool_call_id,
                      tool_name: event.data.tool_name,
                      status:
                        (event.data.status as ToolRunStatus | undefined) ??
                        "failed",
                      message:
                        event.data.error === null ||
                        event.data.error === undefined
                          ? null
                          : String(event.data.error),
                      arguments: null,
                      sequence:
                        typeof event.data.sequence === "number"
                          ? event.data.sequence
                          : null,
                      started_at: null,
                      finished_at:
                        typeof event.data.finished_at === "string"
                          ? event.data.finished_at
                          : null,
                      duration_ms:
                        typeof event.data.duration_ms === "number"
                          ? event.data.duration_ms
                          : null,
                      progress: null,
                    },
                    targetSessionId,
                  );
                  break;
                }
                case "final": {
                  const normalized = normalizeMessage({
                    ...event.data.message,
                    is_typing: false,
                  });
                  upsertSessionMessage(
                    targetSessionId,
                    normalized,
                    (candidate) =>
                      Boolean(candidate.isPlaceholder) &&
                      candidate.sender === normalized.sender &&
                      isSameSession(candidate, targetSessionId),
                  );
                  setStreamPhase("idle");
                  markPendingMessageSent(tempUserId);
                  updateSessionMessages(targetSessionId, (prev) =>
                    prev.map((msg) =>
                      msg.id === tempUserId
                        ? {
                            ...msg,
                            deliveryState: undefined,
                            errorMessage: null,
                          }
                        : msg,
                    ),
                  );

                  const metrics = event.data.metrics;
                  if (metrics) {
                    if (metrics.usage_total) {
                      setUsageTotal(metrics.usage_total);
                    }
                    const toolRuns =
                      metrics.tool_runs ||
                      (metrics as unknown as { toolRuns?: ToolRunSummary[] })
                        .toolRuns ||
                      [];
                    if (toolRuns.length) {
                      toolRuns.forEach((run) => {
                        upsertToolMessage(run, targetSessionId);
                      });
                    }
                  }
                  lastStreamCompletionAtRef.current = Date.now();
                  break;
                }
                case "error": {
                  const errorMessage = event.data.message || "";
                  const isTokenError =
                    errorMessage.includes("401") ||
                    errorMessage.includes("unauthorized") ||
                    errorMessage.includes("token");
                  const isServerError =
                    errorMessage.includes("500") ||
                    errorMessage.includes("temporary") ||
                    errorMessage.includes("unavailable") ||
                    errorMessage.includes("API");
                  const isNetworkError =
                    errorMessage.includes("network") ||
                    errorMessage.includes("connection") ||
                    errorMessage.includes("timeout");
                  const isPermissionError =
                    errorMessage.includes("permission") ||
                    errorMessage.includes("forbidden") ||
                    errorMessage.includes("403");
                  const isRateLimitError =
                    errorMessage.includes("rate") ||
                    errorMessage.includes("limit") ||
                    errorMessage.includes("429");

                  let friendlyMessage = errorMessage;
                  if (isTokenError) {
                    friendlyMessage = t("agent.errors.authExpired");
                    redirectToLogin();
                  } else if (isServerError) {
                    friendlyMessage = t("agent.errors.serviceUnavailable");
                  } else if (isNetworkError) {
                    friendlyMessage = t("agent.errors.networkError");
                  } else if (isPermissionError) {
                    friendlyMessage = t("agent.errors.permissionDenied");
                  } else if (isRateLimitError) {
                    friendlyMessage = t("agent.errors.rateLimited");
                  } else if (!friendlyMessage) {
                    friendlyMessage = t("agent.errors.requestFailed");
                  }

                  markPendingMessageFailed(tempUserId, friendlyMessage);
                  showErrorToast(friendlyMessage);
                  updateSessionMessages(targetSessionId, (prev) =>
                    prev.map((msg) =>
                      msg.id === tempAgentId && msg.isTyping
                        ? { ...msg, isTyping: false, content: friendlyMessage }
                        : msg.id === tempUserId
                          ? {
                              ...msg,
                              deliveryState: "failed",
                              errorMessage: friendlyMessage,
                            }
                          : msg,
                    ),
                  );
                  setStreamPhase("error");
                  controller.abort();
                  break;
                }
                case "stream_end": {
                  setStreamPhase("idle");
                  break;
                }
                default:
                  break;
              }
            },
          },
        );
        ensureRateLimitCleared();
        markPendingMessageSent(tempUserId);
        lastStreamCompletionAtRef.current = Date.now();
        updateSessionMessages(targetSessionId, (prev) =>
          prev.map((msg) =>
            msg.id === tempUserId
              ? { ...msg, deliveryState: undefined, errorMessage: null }
              : msg,
          ),
        );
      } catch (error) {
        releaseHistoryGuardOnce();
        if (error instanceof RateLimitError) {
          const friendlyMessage = t("agent.errors.rateLimited");
          setRateLimitInfo(error.info);
          markPendingMessageFailed(tempUserId, friendlyMessage);
          updateSessionMessages(targetSessionId, (prev) =>
            prev.map((msg) => {
              if (msg.id === tempUserId) {
                return {
                  ...msg,
                  deliveryState: "failed",
                  errorMessage: friendlyMessage,
                };
              }
              if (msg.id === tempAgentId && msg.isTyping) {
                return { ...msg, isTyping: false, content: friendlyMessage };
              }
              return msg;
            }),
          );
          setStreamPhase("error");
          controller.abort();
        } else if (error instanceof Error && error.name === "AbortError") {
          ensureRateLimitCleared();
          const abortSignalReason =
            controller.signal.aborted && "reason" in controller.signal
              ? (controller.signal.reason as string | undefined)
              : undefined;
          const abortedByStall =
            streamPhase === "stalled" || abortSignalReason === "stream_timeout";
          const abortStatusMessage = abortedByStall
            ? t("agent.errors.streamTimeout")
            : t("agent.errors.requestFailed");
          markPendingMessageFailed(tempUserId, abortStatusMessage);
          updateSessionMessages(targetSessionId, (prev) =>
            prev.map((msg) =>
              msg.id === tempUserId
                ? {
                    ...msg,
                    deliveryState: "failed",
                    errorMessage: abortStatusMessage,
                  }
                : msg,
            ),
          );
          setAbortReason(abortStatusMessage);
          setTimeout(() => setAbortReason(null), 3000);
          setStreamPhase("idle");
          updateSessionMessages(targetSessionId, (prev) =>
            prev.map((msg) => {
              if (msg.id === tempAgentId && msg.isTyping) {
                return { ...msg, isTyping: false };
              }
              if (msg.id === tempUserId && msg.deliveryState !== "failed") {
                return { ...msg, deliveryState: "failed" };
              }
              return msg;
            }),
          );
        } else {
          ensureRateLimitCleared();
          const friendlyMessage =
            error instanceof Error
              ? error.message || t("agent.errors.requestFailed")
              : t("agent.errors.requestFailed");
          markPendingMessageFailed(tempUserId, friendlyMessage);
          updateSessionMessages(targetSessionId, (prev) =>
            prev.map((msg) =>
              msg.id === tempUserId
                ? {
                    ...msg,
                    deliveryState: "failed",
                    errorMessage: friendlyMessage,
                  }
                : msg,
            ),
          );
          setStreamPhase("error");
          showErrorToast(friendlyMessage);
        }
      } finally {
        releaseHistoryGuardOnce();
        setAbortReason(null);
        completeStreaming("idle");
        updateSessionMessages(targetSessionId, (prev) =>
          prev.map((msg) => {
            if (msg.isTyping && msg.id === tempAgentId) {
              return { ...msg, isTyping: false };
            }
            return msg;
          }),
        );

        invalidateSessionHistory(queryClient, targetSessionId);
        invalidateSessionLists(queryClient);
      }
    },
    [
      addPendingMessage,
      agentOptionsAvailable,
      activateHistoryGuard,
      ensureAgentAssignment,
      clearRateLimitInfo,
      completeStreaming,
      isScheduledSession,
      isStreaming,
      isSystemSession,
      normalizeMessage,
      queryClient,
      registerPendingMessageSnapshot,
      registerStreamActivity,
      releaseHistoryGuard,
      resolvePendingMatchForMessage,
      resolvedSessionId,
      selectedAgent,
      setRateLimitInfo,
      setAbortReason,
      setStreamPhase,
      showErrorToast,
      showWarningToast,
      startStreaming,
      streamPhase,
      t,
      markPendingMessageFailed,
      markPendingMessageSent,
      upsertToolMessage,
      redirectToLogin,
    ],
  );

  return {
    resolvedSessionId,
    isSystemSession,
    messages,
    isStreaming,
    abortReason,
    handleSendMessage,
    rateLimitNotice,
    selectedAgent,
    selectedAgentProfile,
    agentOptions,
    translateAgentName,
    handleAgentSelect,
    sendDisabled,
    usageTotal,
    sessionAgentName,
    isAssigningAgent,
    isAgentLocked,
  };
}
