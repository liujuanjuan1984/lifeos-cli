import type {
  AgentSession,
  AgentSessionType,
  CreateSessionRequest,
  UpdateSessionRequest,
} from "@/types/session";
import type { ListResponse } from "@/types/pagination";
import { http } from "./client";
import { ENDPOINTS } from "./endpoints";

export type AgentSessionListResponse = ListResponse<
  AgentSession,
  Record<string, never>
>;

export const sessionApi = {
  // Create a new session
  createSession: async (data: CreateSessionRequest): Promise<AgentSession> => {
    return await http.post<AgentSession>(ENDPOINTS.AGENTS.SESSIONS, data);
  },

  // Get user sessions
  getSessions: async (
    page: number = 1,
    size: number = 20,
    options?: { type?: AgentSessionType },
  ): Promise<AgentSessionListResponse> => {
    return await http.get<AgentSessionListResponse>(ENDPOINTS.AGENTS.SESSIONS, {
      page,
      size,
      type: options?.type,
    });
  },

  // Get a specific session
  getSession: async (sessionId: string): Promise<AgentSession> => {
    return await http.get<AgentSession>(
      ENDPOINTS.AGENTS.SESSION_BY_ID(sessionId),
    );
  },

  // Update a session
  updateSession: async (
    sessionId: string,
    data: UpdateSessionRequest,
  ): Promise<AgentSession> => {
    return await http.put<AgentSession>(
      ENDPOINTS.AGENTS.SESSION_BY_ID(sessionId),
      data,
    );
  },

  // Delete a session
  deleteSession: async (sessionId: string): Promise<void> => {
    await http.delete(ENDPOINTS.AGENTS.SESSION_BY_ID(sessionId));
  },
};

export const sessionKeys = {
  all: ["sessions"] as const,
  lists: () => [...sessionKeys.all, "list"] as const,
  list: (filters?: { page?: number; size?: number }) =>
    [...sessionKeys.lists(), filters ?? {}] as const,
  sessions: (filters?: { page?: number; size?: number }) =>
    sessionKeys.list(filters),
  details: () => [...sessionKeys.all, "detail"] as const,
  session: (id: string) => [...sessionKeys.details(), id] as const,
};
