import type { ListResponse } from "./pagination";

// Agent Message Types
type AgentMessageSender = "user" | "agent" | "system" | "automation";

type AgentMessageSeverity = "info" | "warning" | "critical";

type AgentMessageType = "chat" | "tool" | "system_notification";

type AgentMessageKind = "chat" | "tool" | "system_notification";

interface AgentNotificationMetadata {
  title?: string | null;
  severity?: AgentMessageSeverity | null;
  payload?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface ToolRunProgress {
  percent?: number | null;
  label?: string | null;
  detail?: string | null;
  stage?: string | null;
  message?: string | null;
}

export interface AgentMessage {
  id: string;
  content: string;
  sender: AgentMessageSender;
  timestamp: string;
  isTyping?: boolean;
  isPlaceholder?: boolean;
  sessionId?: string;
  agentName?: string;
  kind?: AgentMessageKind;
  messageType?: AgentMessageType;
  severity?: AgentMessageSeverity;
  metadata?: AgentNotificationMetadata | null;
  message_metadata?: AgentNotificationMetadata | null;
  toolCallId?: string;
  toolName?: string;
  toolStatus?: ToolRunStatus;
  toolMessage?: string | null;
  toolArguments?: Record<string, unknown> | null;
  toolSequence?: number | null;
  toolStartedAt?: string | null;
  toolFinishedAt?: string | null;
  toolDurationMs?: number | null;
  toolProgress?: ToolRunProgress | null;
  deliveryState?: "pending" | "failed" | "sent";
  errorMessage?: string | null;
  isLocalOnly?: boolean;
  isSticky?: boolean;
}

export interface TokenUsageSnapshot {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: string | null;
  token_source?: "system" | "user" | null;
}

export type ToolRunStatus = "started" | "finished" | "failed";

export interface ToolRunSummary {
  tool_call_id: string;
  tool_name: string;
  status: ToolRunStatus;
  message?: string | null;
  arguments?: Record<string, unknown> | null;
  sequence?: number | null;
  started_at?: string | null;
  finished_at?: string | null;
  duration_ms?: number | null;
  progress?: ToolRunProgress | null;
}

export interface AgentStreamMetrics {
  content: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: string | null;
  response_time_ms: number | null;
  model_name: string | null;
  usage_delta?: TokenUsageSnapshot | null;
  usage_total?: TokenUsageSnapshot | null;
  context_token_usage?: Record<string, number> | null;
  context_window_tokens?: number | null;
  context_budget_tokens?: number | null;
  context_messages_selected?: number | null;
  context_messages_dropped?: number | null;
  context_box_messages_selected?: number | null;
  context_box_messages_dropped?: number | null;
  tool_runs?: ToolRunSummary[] | null;
}

export type AgentStreamEvent =
  | { event: "message"; data: AgentMessage }
  | { event: "agent_message"; data: AgentMessage }
  | { event: "delta"; data: { id: string; content: string } }
  | {
      event: "final";
      data: { message: AgentMessage; metrics: AgentStreamMetrics };
    }
  | { event: "metadata"; data: Record<string, unknown> }
  | {
      event: "tool_started";
      data: {
        tool_call_id: string;
        tool_name: string;
        status?: ToolRunStatus;
        sequence?: number | null;
        started_at?: string | null;
        arguments?: Record<string, unknown>;
      };
    }
  | {
      event: "tool_finished";
      data: {
        tool_call_id: string;
        tool_name: string;
        status?: ToolRunStatus;
        sequence?: number | null;
        result?: string | null;
        message?: string | null;
        finished_at?: string | null;
        duration_ms?: number | null;
      };
    }
  | {
      event: "tool_failed";
      data: {
        tool_call_id: string;
        tool_name: string;
        status?: ToolRunStatus;
        sequence?: number | null;
        error?: string | null;
        message?: string | null;
        finished_at?: string | null;
        duration_ms?: number | null;
      };
    }
  | {
      event: "tool_progress";
      data: {
        tool_call_id: string;
        tool_name: string;
        status?: ToolRunStatus;
        sequence?: number | null;
        progress?: ToolRunProgress | null;
      };
    }
  | {
      event: "heartbeat";
      data: {
        timestamp: string;
        session_id?: string;
        agent_name?: string;
        message_id?: string;
      };
    }
  | { event: "error"; data: { message: string } }
  | { event: "stream_end"; data: Record<string, never> };

export interface ChatHistory
  extends ListResponse<AgentMessage, Record<string, unknown>> {
  /** @deprecated use items */
  messages: AgentMessage[];
  /** @deprecated use pagination.total */
  totalCount: number;
}

export interface SendMessageRequest {
  content: string;
  session_id?: string;
  agent_name?: string;
}

export interface SendMessageResponse {
  message: AgentMessage;
  agentResponse?: AgentMessage;
  sessionId?: string;
  usageDelta?: TokenUsageSnapshot | null;
  usageTotal?: TokenUsageSnapshot | null;
  contextTokenUsage?: Record<string, number> | null;
  contextWindowTokens?: number | null;
  contextBudgetTokens?: number | null;
  contextMessagesSelected?: number | null;
  contextMessagesDropped?: number | null;
  contextBoxMessagesSelected?: number | null;
  contextBoxMessagesDropped?: number | null;
  toolRuns?: ToolRunSummary[] | null;
  // Raw snake_case fields for compatibility
  usage_delta?: TokenUsageSnapshot | null;
  usage_total?: TokenUsageSnapshot | null;
  context_token_usage?: Record<string, number> | null;
  context_window_tokens?: number | null;
  context_budget_tokens?: number | null;
  context_messages_selected?: number | null;
  context_messages_dropped?: number | null;
  context_box_messages_selected?: number | null;
  context_box_messages_dropped?: number | null;
  tool_runs?: ToolRunSummary[] | null;
}
