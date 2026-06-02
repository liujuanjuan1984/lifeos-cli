// Session Management Types
export type AgentSessionType = "chat" | "system" | "scheduled";

export interface AgentSession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  messageCount: number;
  isFavorite: boolean;
  cardbox_box_id?: string | null;
  summary?: string | null;
  agentName?: string | null;
  sessionType?: AgentSessionType;
  unreadCount?: number;
  promptTokensTotal?: number;
  completionTokensTotal?: number;
  totalTokensTotal?: number;
  costUsdTotal?: string | null;
  // Raw API fields
  message_count?: number;
  created_at?: string;
  updated_at?: string;
  last_activity_at?: string;
  is_favorite?: boolean;
  session_type?: AgentSessionType;
  unread_count?: number;
  module_key?: string | null;
  agent_name?: string | null;
  prompt_tokens_total?: number;
  completion_tokens_total?: number;
  total_tokens_total?: number;
  cost_usd_total?: string | null;
}

export interface CreateSessionRequest {
  name: string;
  agent_name?: string;
}

export interface UpdateSessionRequest {
  name?: string;
  agent_name?: string;
}
