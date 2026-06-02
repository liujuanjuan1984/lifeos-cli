import type { AgentProfileSummary } from "@/types/agent";
import type { ListResponse } from "@/types/pagination";
import { http } from "./client";
import { ENDPOINTS } from "./endpoints";

export interface AgentRegistryListMeta {
  source?: string | null;
}

export type AgentRegistryListResponse = ListResponse<
  AgentProfileSummary,
  AgentRegistryListMeta
>;

export const agentsApi = {
  listProfiles: async (): Promise<AgentRegistryListResponse> => {
    return await http.get<AgentRegistryListResponse>(ENDPOINTS.AGENTS.REGISTRY);
  },
};

export const agentsKeys = {
  all: ["agents"] as const,
  profiles: () => [...agentsKeys.all, "profiles"] as const,
};
