// Common, cross-domain types
import type { UUID } from "@/types/primitive";
export interface PersonSummary {
  id: UUID;
  name?: string | null;
  display_name: string;
  primary_nickname: string;
  birth_date?: string | null;
  location?: string | null;
  tags: Array<{
    id: UUID;
    name: string;
    entity_type: string;
    category: string;
    description?: string | null;
    color?: string | null;
    created_at: string;
    updated_at: string;
  }>;
}
