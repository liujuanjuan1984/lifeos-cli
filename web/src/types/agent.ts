export interface AgentProfileSummary {
  name: string;
  description: string;
  tools: string[];
  allow_unassigned_tools: boolean;
  system_prompt_en?: string | null;
  prompt_version: string;
}

export const DEFAULT_AGENT_NAME = "root_agent";
