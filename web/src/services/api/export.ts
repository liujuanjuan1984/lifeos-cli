import { http } from "./client";
import { ENDPOINTS } from "./endpoints";
import type { ActualEventAdvancedSearchMetadata } from "./actualEvents";

// Export parameter types for different data types
export interface TimelogExportParams {
  start_date: string;
  end_date: string;
  dimension_id?: string | null;
  description_keyword?: string | null;
  locale?: string;
}

export interface NotesExportParams {
  selected_filter_tags: Array<{ id: string; name: string }>;
  selected_filter_persons: Array<{ id: string; display_name: string }>;
  search_keyword: string;
  filter_summary?: string[];
  locale?: string;
}

export interface PlanningExportParams {
  view_type: "year" | "month" | "week" | "day";
  selected_date: string;
  include_notes?: boolean;
  include_task_notes?: boolean;
  include_cycle_notes?: boolean;
  locale?: string;
}

export interface VisionExportParams {
  vision_id: string;
  include_subtasks?: boolean;
  include_notes?: boolean;
  include_time_records?: boolean;
  locale?: string;
}

export interface FinanceTradingExportParams {
  plan_id: string;
  instrument_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  format?: "text" | "csv" | "json";
  locale?: string;
}

export interface FinanceAccountsExportParams {
  format?: "text" | "csv" | "json";
  tree_id?: string | null;
  locale?: string;
}

export interface FinanceCashflowExportParams {
  start_time?: string | null;
  end_time?: string | null;
  format?: "text" | "csv" | "json";
  tree_id?: string | null;
  locale?: string;
}

// Extended parameter types with Date objects for frontend use
export interface ExtendedTimelogExportParams
  extends Omit<TimelogExportParams, "start_date" | "end_date"> {
  start_date: Date;
  end_date: Date;
}

export interface ExtendedPlanningExportParams
  extends Omit<PlanningExportParams, "selected_date"> {
  selected_date: Date;
}

export interface ExportResult {
  success: boolean;
  message: string;
  export_text?: string;
  content_type?: string;
  filename?: string;
  metadata?: ActualEventAdvancedSearchMetadata | null;
}

export interface ExportEstimateResult {
  estimated_size_bytes: number;
  record_count: number;
  can_clipboard: boolean;
}

/**
 * Export API service
 * Provides methods to export different types of data from the backend
 */
export const exportApi = {
  /**
   * Export timelog data
   */
  timelog: (params: TimelogExportParams) =>
    http.post<ExportResult>(ENDPOINTS.EXPORT.TIMELOG, params),

  /**
   * Export notes data
   */
  notes: (params: NotesExportParams) =>
    http.post<ExportResult>(ENDPOINTS.EXPORT.NOTES, params),

  /**
   * Export planning data
   */
  planning: (params: PlanningExportParams) =>
    http.post<ExportResult>(ENDPOINTS.EXPORT.PLANNING, params),

  /**
   * Export vision data with task tree
   */
  vision: (visionId: string, params: Omit<VisionExportParams, "vision_id">) =>
    http.get<ExportResult>(ENDPOINTS.EXPORT.VISION_BY_ID(visionId), params),

  /** Finance trading export */
  financeTrading: (params: FinanceTradingExportParams) =>
    http.post<ExportResult>(ENDPOINTS.EXPORT.FINANCE_TRADING, params),

  financeAccounts: (params: FinanceAccountsExportParams) =>
    http.post<ExportResult>(ENDPOINTS.EXPORT.FINANCE_ACCOUNTS, params),

  financeCashflow: (params: FinanceCashflowExportParams) =>
    http.post<ExportResult>(ENDPOINTS.EXPORT.FINANCE_CASHFLOW, params),

  full: () => http.post<ExportResult>(ENDPOINTS.EXPORT.FULL, {}),

  estimate: (module: string, params: Record<string, unknown>) =>
    http.post<ExportEstimateResult>(ENDPOINTS.EXPORT.ESTIMATE, {
      module,
      params,
    }),

  /**
   * Generate export text without copying (for preview or other uses)
   * Note: These endpoints may not exist in backend yet, included for future use
   */
  timelogText: (params: TimelogExportParams) =>
    http.post<ExportResult>(ENDPOINTS.EXPORT.TIMELOG_TEXT, params),

  notesText: (params: NotesExportParams) =>
    http.post<ExportResult>(ENDPOINTS.EXPORT.NOTES_TEXT, params),

  planningText: (params: PlanningExportParams) =>
    http.post<ExportResult>(ENDPOINTS.EXPORT.PLANNING_TEXT, params),

  visionText: (
    visionId: string,
    params: Omit<VisionExportParams, "vision_id">,
  ) => http.post<ExportResult>(ENDPOINTS.VISIONS.EXPORT(visionId), params),
};
