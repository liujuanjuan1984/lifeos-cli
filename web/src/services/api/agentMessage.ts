import type {
  AgentMessage,
  AgentStreamEvent,
  AgentStreamMetrics,
  ChatHistory,
  SendMessageRequest,
  SendMessageResponse,
  TokenUsageSnapshot,
  ToolRunProgress,
  ToolRunSummary,
  ToolRunStatus,
} from "@/types/agentMessage";
import {
  http,
  ApiError,
  API_BASE_URL,
  resolveAccessTokenForPath,
} from "./client";
import { ENDPOINTS } from "./endpoints";
import { clearAuth } from "@/services/auth";
import { logger } from "@/utils/core";
import { t } from "@/i18n";
import type { RateLimitInfo } from "@/types/rateLimit";

type RateLimitDetailMeta = {
  limit?: unknown;
  used?: unknown;
  reset_at?: unknown;
  resetAt?: unknown;
};

type RateLimitDetailPayload = {
  message?: unknown;
  meta?: RateLimitDetailMeta;
  limit?: unknown;
  used?: unknown;
  reset_at?: unknown;
  resetAt?: unknown;
};

const extractRateLimitDetail = (payload: unknown): RateLimitDetailPayload => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  if ("detail" in payload) {
    const detailValue = (payload as { detail?: unknown }).detail;
    if (detailValue && typeof detailValue === "object") {
      const detailObject = detailValue as RateLimitDetailPayload;
      const meta =
        detailObject.meta && typeof detailObject.meta === "object"
          ? (detailObject.meta as RateLimitDetailMeta)
          : undefined;
      return {
        message: detailObject.message,
        limit: meta?.limit ?? detailObject.limit,
        used: meta?.used ?? detailObject.used,
        reset_at: meta?.reset_at ?? detailObject.reset_at,
        resetAt: meta?.resetAt ?? detailObject.resetAt,
      };
    }
  }

  return payload as RateLimitDetailPayload;
};

const parseRateLimitInfo = async (
  response: Response,
): Promise<RateLimitInfo> => {
  try {
    const payload = await response.json();
    const detail = extractRateLimitDetail(payload);
    const limitValue =
      typeof detail.limit === "number" && Number.isFinite(detail.limit)
        ? detail.limit
        : null;
    const usedValue =
      typeof detail.used === "number" && Number.isFinite(detail.used)
        ? detail.used
        : null;
    const resetAtValue =
      typeof detail.reset_at === "string"
        ? detail.reset_at
        : typeof detail.resetAt === "string"
          ? detail.resetAt
          : null;
    const messageValue =
      typeof detail.message === "string" && detail.message.trim().length > 0
        ? detail.message
        : t("agent.errors.rateLimited");

    return {
      message: messageValue,
      limit: limitValue,
      used: usedValue,
      resetAt: resetAtValue,
      capturedAt: new Date().toISOString(),
    };
  } catch {
    return {
      message: t("agent.errors.rateLimited"),
      limit: null,
      used: null,
      resetAt: null,
      capturedAt: new Date().toISOString(),
    };
  }
};

export class RateLimitError extends Error {
  info: RateLimitInfo;
  status: number;

  constructor(info: RateLimitInfo, status = 429) {
    super(info.message);
    this.name = "RateLimitError";
    this.info = info;
    this.status = status;
  }
}

export const agentMessageApi = {
  // Send a message to the agent
  sendMessage: async (
    data: SendMessageRequest,
  ): Promise<SendMessageResponse> => {
    const response = await http.post<SendMessageResponse>(
      ENDPOINTS.AGENTS.CHAT,
      data,
    );
    return {
      ...response,
      toolRuns: response.toolRuns ?? response.tool_runs ?? null,
    };
  },

  // Get chat history
  getHistory: async (params?: {
    sessionId?: string;
    page?: number;
    size?: number;
  }): Promise<ChatHistory> => {
    const queryParams: Record<string, string | number | undefined> = {
      session_id: params?.sessionId,
      page: params?.page,
      size: params?.size,
    };
    const response = await http.get<ChatHistory>(
      ENDPOINTS.AGENTS.HISTORY,
      queryParams,
    );
    return {
      ...response,
      messages: response.items,
      totalCount: response.pagination.total,
    };
  },

  // Clear chat history
  clearHistory: async (): Promise<void> => {
    await http.delete(ENDPOINTS.AGENTS.HISTORY);
  },

  // Clear chat history for a specific session
  clearSessionHistory: async (sessionId: string): Promise<void> => {
    await http.delete(ENDPOINTS.AGENTS.HISTORY_BY_ID(sessionId));
  },

  streamMessage: async (
    data: SendMessageRequest,
    options: {
      signal?: AbortSignal;
      onEvent: (event: AgentStreamEvent) => void;
    },
  ): Promise<void> => {
    const url = `${API_BASE_URL}${ENDPOINTS.AGENTS.CHAT}?stream=true`;

    const controller = new AbortController();
    const rawTimeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 60000);
    const timeoutMs =
      Number.isFinite(rawTimeoutMs) && rawTimeoutMs > 0
        ? Math.min(rawTimeoutMs, 120000)
        : 0;
    let timeoutId: number | null = null;
    const resetStreamTimeout = () => {
      if (!timeoutMs) return;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        logger.warn(
          `Streaming timeout (no SSE activity for ${timeoutMs}ms), aborting...`,
        );
        controller.abort("stream_timeout");
      }, timeoutMs);
    };
    resetStreamTimeout();

    if (options.signal) {
      if (options.signal.aborted) {
        controller.abort(options.signal.reason ?? "upstream_abort");
      } else {
        options.signal.addEventListener(
          "abort",
          () => controller.abort(options.signal?.reason ?? "upstream_abort"),
          {
            once: true,
          },
        );
      }
    }

    const headers = new Headers({ "Content-Type": "application/json" });

    try {
      const token = await resolveAccessTokenForPath(ENDPOINTS.AGENTS.CHAT);
      if (!token) {
        throw new ApiError(t("apiErrors.notLoggedIn"), 401);
      }
      headers.set("Authorization", `Bearer ${token}`);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401 && typeof window !== "undefined") {
          clearAuth();
          const current = window.location.pathname + window.location.search;
          const loginPath = `/login?next=${encodeURIComponent(current)}`;
          if (!window.location.pathname.startsWith("/login")) {
            window.location.replace(loginPath);
          }
        }

        if (response.status === 429) {
          const info = await parseRateLimitInfo(response);
          throw new RateLimitError(info, response.status);
        }

        const statusKey = `apiErrors.${response.status}`;
        const translated = t(statusKey);
        const message =
          (translated === statusKey ? null : translated) ||
          response.statusText ||
          t("common.requestFailed");
        throw new ApiError(message, response.status);
      }

      if (!response.body) {
        throw new ApiError(t("common.requestFailed"), 500);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const emitEvent = (raw: string) => {
        resetStreamTimeout();
        const parsed = parseSseEvent(raw);
        if (!parsed) return;
        options.onEvent(parsed);
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        resetStreamTimeout();
        buffer += decoder.decode(value, { stream: true });

        let separator = buffer.indexOf("\n\n");
        while (separator !== -1) {
          const chunk = buffer.slice(0, separator);
          buffer = buffer.slice(separator + 2);
          emitEvent(chunk.trim());
          separator = buffer.indexOf("\n\n");
        }
      }

      if (buffer.trim()) {
        emitEvent(buffer.trim());
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        typeof window !== "undefined"
      ) {
        clearAuth();
        const current = window.location.pathname + window.location.search;
        const loginPath = `/login?next=${encodeURIComponent(current)}`;
        if (!window.location.pathname.startsWith("/login")) {
          window.location.replace(loginPath);
        }
      }
      // 在 agentMessage.ts 中特殊处理 AbortError
      if (error instanceof Error && error.name === "AbortError") {
        logger.debug("Streaming aborted in agentMessage.ts:", error.message);
        return; // 静默处理 AbortError，不重新抛出
      }
      throw error; // 重新抛出其他错误
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    }
  },
};

export const agentMessageKeys = {
  all: ["agentMessages"] as const,
  history: () => [...agentMessageKeys.all, "history"] as const,
  sessionHistory: (sessionId: string | null) =>
    [...agentMessageKeys.history(), sessionId] as const,
  messages: () => [...agentMessageKeys.all, "messages"] as const,
};

type SsePayload = {
  event?: string;
  type?: string;
  data?: unknown;
};

const normalizeAgentMessage = (message: unknown): AgentMessage => {
  const raw = (message ?? {}) as Record<string, unknown>;
  const timestampValue = raw.timestamp;
  const timestamp =
    typeof timestampValue === "string" && timestampValue
      ? timestampValue
      : new Date().toISOString();
  const messageType =
    (raw.message_type as AgentMessage["messageType"]) ??
    ((raw as { messageType?: unknown })
      .messageType as AgentMessage["messageType"]);
  const metadata =
    (raw.metadata as AgentMessage["metadata"]) ??
    ((raw as { message_metadata?: unknown })
      .message_metadata as AgentMessage["metadata"]);
  const severity =
    (raw.severity as AgentMessage["severity"]) ??
    (metadata && typeof metadata === "object"
      ? (metadata.severity as AgentMessage["severity"])
      : undefined);
  const derivedKind: AgentMessage["kind"] =
    messageType === "tool"
      ? "tool"
      : messageType === "system_notification"
        ? "system_notification"
        : ((raw.kind as AgentMessage["kind"]) ?? "chat");

  return {
    id: String(raw.id ?? ""),
    content: String(raw.content ?? ""),
    sender: (raw.sender as AgentMessage["sender"]) ?? "agent",
    timestamp,
    isTyping:
      typeof (raw as { isTyping?: unknown }).isTyping === "boolean"
        ? ((raw as { isTyping?: boolean }).isTyping as boolean)
        : typeof (raw as { is_typing?: unknown }).is_typing === "boolean"
          ? ((raw as { is_typing?: boolean }).is_typing as boolean)
          : false,
    sessionId:
      typeof (raw as { session_id?: unknown }).session_id === "string"
        ? ((raw as { session_id?: string }).session_id as string)
        : undefined,
    agentName:
      typeof (raw as { agent_name?: unknown }).agent_name === "string"
        ? ((raw as { agent_name?: string }).agent_name as string)
        : typeof (raw as { agentName?: unknown }).agentName === "string"
          ? ((raw as { agentName?: string }).agentName as string)
          : undefined,
    kind: derivedKind,
    messageType: messageType ?? derivedKind,
    metadata:
      metadata && typeof metadata === "object"
        ? (metadata as AgentMessage["metadata"])
        : null,
    severity:
      severity ?? (messageType === "system_notification" ? "info" : undefined),
  };
};

const parseUsageSnapshot = (input: unknown): TokenUsageSnapshot | null => {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const prompt = Number(
    record.prompt_tokens ?? (record.promptTokens as number | undefined) ?? 0,
  );
  const completion = Number(
    record.completion_tokens ??
      (record.completionTokens as number | undefined) ??
      0,
  );
  const total = Number(
    record.total_tokens ?? (record.totalTokens as number | undefined) ?? 0,
  );
  const costRaw =
    (record.cost_usd as string | number | null | undefined) ??
    (record.costUsd as string | number | null | undefined) ??
    null;
  const costString =
    costRaw === null || costRaw === undefined ? null : String(costRaw);
  const sourceRaw =
    (record.token_source as string | undefined) ??
    (record.tokenSource as string | undefined);
  const normalizedSource =
    sourceRaw && (sourceRaw === "system" || sourceRaw === "user")
      ? sourceRaw
      : null;

  return {
    prompt_tokens: Number.isFinite(prompt) ? prompt : 0,
    completion_tokens: Number.isFinite(completion) ? completion : 0,
    total_tokens: Number.isFinite(total) ? total : 0,
    cost_usd: costString,
    token_source: normalizedSource,
  };
};

const parseNumericRecord = (input: unknown): Record<string, number> | null => {
  if (!input || typeof input !== "object") return null;
  const entries = Object.entries(input as Record<string, unknown>)
    .map(([key, value]) => [key, Number(value)] as const)
    .filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return null;
  return Object.fromEntries(entries);
};

const coerceNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveToolStatus = (value: unknown): ToolRunStatus => {
  const raw =
    typeof value === "string"
      ? value.toLowerCase()
      : typeof value === "number"
        ? value === 0
          ? "started"
          : value > 0
            ? "finished"
            : "failed"
        : "started";
  if (["finished", "success", "succeeded", "done", "complete"].includes(raw)) {
    return "finished";
  }
  if (["failed", "error", "errored", "failure"].includes(raw)) {
    return "failed";
  }
  return "started";
};

const normalizeIsoString = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
};

const parseToolProgress = (input: unknown): ToolRunProgress | null => {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") {
    const numeric = coerceNumber(input);
    return numeric === null ? null : { percent: numeric };
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed.length ? { detail: trimmed } : null;
  }
  if (typeof input !== "object") return null;

  const record = input as Record<string, unknown>;
  const percent = coerceNumber(
    record.percent ??
      record.value ??
      record.progress ??
      record.percent_complete ??
      record.percentComplete ??
      record.percentage ??
      record.completion,
  );
  const labelValue =
    record.label ?? record.stage ?? record.status ?? record.state ?? null;
  const detailValue =
    record.detail ??
    record.description ??
    record.message ??
    record.info ??
    null;
  const stageValue = record.stage ?? record.state ?? null;
  const messageValue = record.message ?? record.detail ?? null;

  const progress: ToolRunProgress = {
    percent,
    label: typeof labelValue === "string" ? labelValue : null,
    detail: typeof detailValue === "string" ? detailValue : null,
    stage: typeof stageValue === "string" ? stageValue : null,
    message: typeof messageValue === "string" ? messageValue : null,
  };

  if (
    progress.percent === null &&
    !progress.label &&
    !progress.detail &&
    !progress.stage &&
    !progress.message
  ) {
    return null;
  }
  return progress;
};

const parseToolRunSummary = (value: unknown): ToolRunSummary | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const toolCallId = String(
    record.tool_call_id ?? record.toolCallId ?? record.id ?? "",
  );
  const toolName = String(
    record.tool_name ?? record.toolName ?? record.name ?? "",
  );
  const status = resolveToolStatus(record.status);
  const messageValue = record.message;
  const message =
    messageValue === null || messageValue === undefined
      ? null
      : String(messageValue);
  const argsValue =
    (record.arguments as Record<string, unknown> | undefined) ??
    (record.tool_arguments as Record<string, unknown> | undefined);
  const sequence = coerceNumber(
    record.sequence ?? record.order ?? record.index ?? record.position ?? null,
  );
  const startedAt = normalizeIsoString(
    record.started_at ??
      record.startedAt ??
      record.start_time ??
      record.startTime,
  );
  const finishedAt = normalizeIsoString(
    record.finished_at ??
      record.finishedAt ??
      record.complete_time ??
      record.completeTime,
  );
  const durationMs = coerceNumber(
    record.duration_ms ??
      record.durationMs ??
      record.latency_ms ??
      record.latencyMs ??
      record.elapsed_ms ??
      record.elapsedMs,
  );
  const progress = parseToolProgress(
    record.progress ??
      record.tool_progress ??
      record.progress_update ??
      record.progressUpdate ??
      undefined,
  );
  return {
    tool_call_id: toolCallId,
    tool_name: toolName,
    status,
    message,
    arguments:
      argsValue && typeof argsValue === "object"
        ? (argsValue as Record<string, unknown>)
        : null,
    sequence,
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: durationMs,
    progress,
  };
};

const normalizeMetrics = (metrics: unknown): AgentStreamMetrics => {
  const raw = (metrics ?? {}) as Record<string, unknown>;
  const promptTokens = Number(raw.prompt_tokens ?? raw.promptTokens ?? 0);
  const completionTokens = Number(
    raw.completion_tokens ?? raw.completionTokens ?? 0,
  );
  const totalTokens = Number(raw.total_tokens ?? raw.totalTokens ?? 0);

  return {
    content: String(raw.content ?? ""),
    prompt_tokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    completion_tokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    total_tokens: Number.isFinite(totalTokens) ? totalTokens : 0,
    cost_usd:
      raw.cost_usd === null || raw.cost_usd === undefined
        ? raw.costUsd === null || raw.costUsd === undefined
          ? null
          : String(raw.costUsd)
        : String(raw.cost_usd),
    response_time_ms:
      raw.response_time_ms === null || raw.response_time_ms === undefined
        ? raw.responseTimeMs === null || raw.responseTimeMs === undefined
          ? null
          : Number(raw.responseTimeMs)
        : Number(raw.response_time_ms),
    model_name:
      raw.model_name === null || raw.model_name === undefined
        ? raw.modelName === null || raw.modelName === undefined
          ? null
          : String(raw.modelName)
        : String(raw.model_name),
    usage_delta: parseUsageSnapshot(
      raw.usage_delta ?? raw.usageDelta ?? undefined,
    ),
    usage_total: parseUsageSnapshot(
      raw.usage_total ?? raw.usageTotal ?? undefined,
    ),
    context_token_usage: parseNumericRecord(
      raw.context_token_usage ?? raw.contextTokenUsage ?? undefined,
    ),
    context_window_tokens: coerceNumber(
      raw.context_window_tokens ?? raw.contextWindowTokens ?? undefined,
    ),
    context_budget_tokens: coerceNumber(
      raw.context_budget_tokens ?? raw.contextBudgetTokens ?? undefined,
    ),
    context_messages_selected: coerceNumber(
      raw.context_messages_selected ?? raw.contextMessagesSelected ?? undefined,
    ),
    context_messages_dropped: coerceNumber(
      raw.context_messages_dropped ?? raw.contextMessagesDropped ?? undefined,
    ),
    context_box_messages_selected: coerceNumber(
      raw.context_box_messages_selected ??
        raw.contextBoxMessagesSelected ??
        undefined,
    ),
    context_box_messages_dropped: coerceNumber(
      raw.context_box_messages_dropped ??
        raw.contextBoxMessagesDropped ??
        undefined,
    ),
    tool_runs: Array.isArray(raw.tool_runs ?? raw.toolRuns)
      ? ((raw.tool_runs ?? raw.toolRuns) as unknown[])
          .map((item) => parseToolRunSummary(item))
          .filter((item): item is ToolRunSummary => Boolean(item))
      : null,
  };
};

const parseSseEvent = (chunk: string): AgentStreamEvent | null => {
  if (!chunk) return null;

  const lines = chunk.split("\n");
  let sseEventName: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      sseEventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) return null;

  let parsedData: SsePayload | undefined;
  try {
    parsedData = JSON.parse(dataLines.join("\n")) as SsePayload;
  } catch (error) {
    console.error("Failed to parse SSE chunk", error);
    return null;
  }

  const payload = parsedData?.data ?? parsedData;
  const fallbackType =
    (parsedData?.type as string | undefined) ??
    ((payload as { type?: string } | undefined)?.type as string | undefined);
  const eventName =
    (parsedData?.event as string | undefined) ?? sseEventName ?? fallbackType;

  switch (eventName) {
    case "message":
      return { event: "message", data: normalizeAgentMessage(payload) };
    case "agent_message":
      return {
        event: "agent_message",
        data: normalizeAgentMessage(payload),
      };
    case "delta":
      return {
        event: "delta",
        data: {
          id: String((payload as Record<string, unknown>).id ?? ""),
          content: String((payload as Record<string, unknown>).content ?? ""),
        },
      };
    case "final": {
      const dataRecord = (payload ?? {}) as Record<string, unknown>;
      return {
        event: "final",
        data: {
          message: normalizeAgentMessage(dataRecord.message),
          metrics: normalizeMetrics(dataRecord.metrics),
        },
      };
    }
    case "metadata":
      return {
        event: "metadata",
        data: (payload ?? {}) as Record<string, unknown>,
      };
    case "tool_started": {
      const record = (payload ?? {}) as Record<string, unknown>;
      const sequence = coerceNumber(
        record.sequence ?? record.order ?? record.index ?? record.position,
      );
      const startedAt = normalizeIsoString(
        record.started_at ??
          record.startedAt ??
          record.start_time ??
          record.startTime,
      );
      const status = resolveToolStatus(record.status ?? "started");
      return {
        event: "tool_started",
        data: {
          tool_call_id: String(
            record.tool_call_id ?? record.toolCallId ?? record.id ?? "",
          ),
          tool_name: String(
            record.tool_name ?? record.toolName ?? record.name ?? "",
          ),
          status,
          sequence,
          started_at: startedAt ?? undefined,
          arguments:
            record.arguments && typeof record.arguments === "object"
              ? (record.arguments as Record<string, unknown>)
              : undefined,
        },
      };
    }
    case "tool_progress": {
      const record = (payload ?? {}) as Record<string, unknown>;
      const sequence = coerceNumber(
        record.sequence ?? record.order ?? record.index ?? record.position,
      );
      const progressSource =
        record.progress ??
        record.progress_update ??
        record.progressUpdate ??
        (record.percent !== undefined ||
        record.label !== undefined ||
        record.detail !== undefined ||
        record.message !== undefined
          ? record
          : undefined);
      return {
        event: "tool_progress",
        data: {
          tool_call_id: String(
            record.tool_call_id ?? record.toolCallId ?? record.id ?? "",
          ),
          tool_name: String(
            record.tool_name ?? record.toolName ?? record.name ?? "",
          ),
          status: resolveToolStatus(record.status ?? "started"),
          sequence,
          progress: parseToolProgress(progressSource),
        },
      };
    }
    case "tool_finished": {
      const record = (payload ?? {}) as Record<string, unknown>;
      const sequence = coerceNumber(
        record.sequence ?? record.order ?? record.index ?? record.position,
      );
      const finishedAt = normalizeIsoString(
        record.finished_at ??
          record.finishedAt ??
          record.end_time ??
          record.endTime,
      );
      const duration = coerceNumber(
        record.duration_ms ??
          record.durationMs ??
          record.latency_ms ??
          record.latencyMs ??
          record.elapsed_ms ??
          record.elapsedMs,
      );
      const resultValue =
        record.result ??
        record.message ??
        record.summary ??
        record.output ??
        null;
      const resultString =
        resultValue === null || resultValue === undefined
          ? undefined
          : String(resultValue);
      return {
        event: "tool_finished",
        data: {
          tool_call_id: String(
            record.tool_call_id ?? record.toolCallId ?? record.id ?? "",
          ),
          tool_name: String(
            record.tool_name ?? record.toolName ?? record.name ?? "",
          ),
          status: resolveToolStatus(record.status ?? "finished"),
          sequence,
          result: resultString,
          message: resultString,
          finished_at: finishedAt ?? undefined,
          duration_ms: duration ?? undefined,
        },
      };
    }
    case "tool_failed": {
      const record = (payload ?? {}) as Record<string, unknown>;
      const sequence = coerceNumber(
        record.sequence ?? record.order ?? record.index ?? record.position,
      );
      const finishedAt = normalizeIsoString(
        record.finished_at ??
          record.finishedAt ??
          record.end_time ??
          record.endTime,
      );
      const duration = coerceNumber(
        record.duration_ms ??
          record.durationMs ??
          record.latency_ms ??
          record.latencyMs ??
          record.elapsed_ms ??
          record.elapsedMs,
      );
      const errorValue =
        record.error ??
        record.message ??
        record.detail ??
        record.reason ??
        null;
      const errorString =
        errorValue === null || errorValue === undefined
          ? undefined
          : String(errorValue);
      return {
        event: "tool_failed",
        data: {
          tool_call_id: String(
            record.tool_call_id ?? record.toolCallId ?? record.id ?? "",
          ),
          tool_name: String(
            record.tool_name ?? record.toolName ?? record.name ?? "",
          ),
          status: resolveToolStatus(record.status ?? "failed"),
          sequence,
          error: errorString,
          message: errorString,
          finished_at: finishedAt ?? undefined,
          duration_ms: duration ?? undefined,
        },
      };
    }
    case "tool_call": {
      const record = (payload ?? {}) as Record<string, unknown>;
      return {
        event: "tool_finished",
        data: {
          tool_call_id: String(record.id ?? record.tool_call_id ?? ""),
          tool_name: String(record.name ?? record.tool_name ?? ""),
          status: "finished",
          sequence: coerceNumber(
            record.sequence ?? record.order ?? record.index ?? record.position,
          ),
        },
      };
    }
    case "tool_call_error": {
      const record = (payload ?? {}) as Record<string, unknown>;
      return {
        event: "tool_failed",
        data: {
          tool_call_id: String(record.id ?? record.tool_call_id ?? ""),
          tool_name: String(record.name ?? record.tool_name ?? ""),
          status: "failed",
          sequence: coerceNumber(
            record.sequence ?? record.order ?? record.index ?? record.position,
          ),
          error:
            record.error === null || record.error === undefined
              ? undefined
              : String(record.error),
        },
      };
    }
    case "heartbeat": {
      const record = (payload ?? {}) as Record<string, unknown>;
      const timestamp =
        normalizeIsoString(
          record.timestamp ?? record.ts ?? record.time ?? null,
        ) ?? new Date().toISOString();
      return {
        event: "heartbeat",
        data: {
          timestamp,
          session_id:
            typeof record.session_id === "string"
              ? record.session_id
              : typeof record.sessionId === "string"
                ? record.sessionId
                : undefined,
          agent_name:
            typeof record.agent_name === "string"
              ? record.agent_name
              : typeof record.agentName === "string"
                ? record.agentName
                : undefined,
          message_id:
            typeof record.message_id === "string"
              ? record.message_id
              : typeof record.messageId === "string"
                ? record.messageId
                : undefined,
        },
      };
    }
    case "stream_end":
      return { event: "stream_end", data: {} };
    case "error":
      return {
        event: "error",
        data: {
          message: String((payload as Record<string, unknown>).message ?? ""),
        },
      };
    default:
      return null;
  }
};
