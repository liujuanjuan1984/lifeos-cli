import type { ListResponse } from "./pagination";

export interface ContextBoxSummary {
  box_id: string;
  name: string;
  module: string;
  display_name: string;
  card_count: number;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface ContextBoxListMeta {
  source?: string | null;
}

export type ContextBoxListResponse = ListResponse<
  ContextBoxSummary,
  ContextBoxListMeta
>;

export interface ContextBoxCreateRequest {
  module: string;
  name?: string;
  filters?: Record<string, unknown>;
  overwrite?: boolean;
}

export interface ContextBoxCreateResponse {
  box: ContextBoxSummary;
}

export interface ContextBoxItem {
  card_id: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface ContextBoxPreviewResponse
  extends ListResponse<ContextBoxItem, Record<string, unknown>> {
  box: ContextBoxSummary;
  items: ContextBoxItem[];
}

export interface SessionContextBox {
  box: ContextBoxSummary;
  order: number;
}

export interface SessionContextStateResponse {
  session_id: string;
  boxes: SessionContextBox[];
}

export interface SessionContextSelectionRequest {
  session_id: string;
  box_ids: string[];
}

export interface SessionContextSelectionResponse {
  session_id: string;
  boxes: SessionContextBox[];
  preview_messages: unknown[];
  source_card_ids: string[];
}
