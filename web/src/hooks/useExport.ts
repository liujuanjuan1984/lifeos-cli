/**
 * Universal export hook for all data types
 *
 * This hook provides a standardized way to export data from the backend
 * and copy it to the clipboard, replacing the individual export services.
 */

import { useCallback } from "react";
import { copyToClipboard } from "@/utils/core";
import { useToast } from "@/contexts/ToastContext";
import { logger } from "@/utils/core";
import { exportApi } from "@/services/api";
import type {
  TimelogExportParams,
  NotesExportParams,
  PlanningExportParams,
  VisionExportParams,
  ExportResult,
  FinanceTradingExportParams,
  FinanceAccountsExportParams,
  FinanceCashflowExportParams,
} from "@/services/api";
import type {
  ExtendedTimelogExportParams,
  ExtendedPlanningExportParams,
} from "@/services/api/export";

export { type ExtendedTimelogExportParams, type ExportResult };

type ExtendedExportParams =
  | ExtendedTimelogExportParams
  | NotesExportParams
  | ExtendedPlanningExportParams
  | VisionExportParams
  | FinanceTradingExportParams
  | FinanceAccountsExportParams
  | FinanceCashflowExportParams;

interface ExportOptions {
  onSuccess?: (result: ExportResult) => void;
  onError?: (error: Error) => void;
  showToasts?: boolean;
  /**
   * When true, always download as file rather than copying to clipboard
   */
  forceFile?: boolean;
  /**
   * Optional estimated size in bytes used to decide clipboard vs file when auto
   */
  estimatedSizeBytes?: number;
  /**
   * Preferred delivery: auto (default), clipboard, file
   */
  deliveryMode?: "auto" | "clipboard" | "file";
  /**
   * module key for /export/estimate, e.g. "notes", "planning", "timelog", "vision:<id>", "finance-trading"
   */
  estimateModule?: string;
}

/**
 * Universal export hook
 */
const useExportInternal = () => {
  const toast = useToast();

  /**
   * Export data using backend API and copy to clipboard
   */
  const exportData = useCallback(
    async <T extends ExtendedExportParams>(
      exportType:
        | "timelog"
        | "notes"
        | "planning"
        | "vision"
        | "finance-trading"
        | "finance-accounts"
        | "finance-cashflow",
      params: T,
      options: ExportOptions = {},
    ): Promise<void> => {
      const {
        onSuccess,
        onError,
        showToasts = true,
        forceFile = false,
        estimatedSizeBytes,
        deliveryMode = "auto",
      } = options;

      try {
        // Show loading toast
        if (showToasts) {
          toast.showInfo("导出中", "正在准备导出数据...");
        }

        // Prepare request parameters
        const requestParams = prepareRequestParams(exportType, params);

        let sizeForDecision = estimatedSizeBytes;
        if (!sizeForDecision && options.estimateModule) {
          try {
            const estimate = await exportApi.estimate(
              options.estimateModule,
              requestParams as Record<string, unknown>,
            );
            sizeForDecision = estimate.estimated_size_bytes;
          } catch (e) {
            // ignore estimate failure, continue export
          }
        }

        // Call backend export API using the dedicated service
        let response: ExportResult;

        switch (exportType) {
          case "timelog":
            response = await exportApi.timelog(
              requestParams as TimelogExportParams,
            );
            break;
          case "notes":
            response = await exportApi.notes(
              requestParams as NotesExportParams,
            );
            break;
          case "planning":
            response = await exportApi.planning(
              requestParams as PlanningExportParams,
            );
            break;
          case "vision": {
            const visionParams = params as VisionExportParams;
            const { vision_id, ...restParams } = visionParams;
            response = await exportApi.vision(vision_id, restParams);
            break;
          }
          case "finance-trading": {
            response = await exportApi.financeTrading(
              requestParams as unknown as FinanceTradingExportParams,
            );
            break;
          }
          case "finance-accounts": {
            response = await exportApi.financeAccounts(
              requestParams as FinanceAccountsExportParams,
            );
            break;
          }
          case "finance-cashflow": {
            response = await exportApi.financeCashflow(
              requestParams as FinanceCashflowExportParams,
            );
            break;
          }
          default:
            throw new Error(`Unsupported export type: ${exportType}`);
        }

        if (!response.success || !response.export_text) {
          throw new Error(response.message || "导出失败");
        }

        const chosenDelivery = (() => {
          if (deliveryMode !== "auto") return deliveryMode;
          if (forceFile) return "file";
          if (response.content_type && response.content_type !== "text/plain")
            return "file";
          if (sizeForDecision !== undefined && sizeForDecision > 20000)
            return "file";
          if (
            estimatedSizeBytes === undefined &&
            response.export_text &&
            response.export_text.length > 20000
          ) {
            return "file";
          }
          return "clipboard";
        })();

        if (chosenDelivery === "file") {
          const blob = new Blob([response.export_text], {
            type: response.content_type || "text/plain",
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = response.filename || "export.txt";
          link.click();
          URL.revokeObjectURL(url);
          if (showToasts) {
            toast.showSuccess("导出成功", "已准备文件下载");
          }
          onSuccess?.(response);
          return;
        }

        // Clipboard path
        const clipboardResult = await copyToClipboard(response.export_text);

        if (clipboardResult.success) {
          if (showToasts) {
            if (clipboardResult.requiresManualCopy) {
              toast.showInfo("导出成功", "请手动复制内容到剪贴板");
              openExportWindow(
                response.export_text,
                response.filename || "export.txt",
              );
            } else {
              toast.showSuccess("导出成功", "已复制到剪贴板");
            }
          }
          onSuccess?.(response);
        } else {
          if (showToasts) {
            toast.showInfo("需要手动复制", "请手动复制内容到剪贴板");
          }
          openExportWindow(
            response.export_text!,
            response.filename || "export.txt",
          );
          onSuccess?.(response);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "导出过程中发生错误";
        logger.error("Export failed:", error);

        if (showToasts) {
          toast.showError("导出失败", errorMessage);
        }

        onError?.(error instanceof Error ? error : new Error(errorMessage));
      }
    },
    [toast],
  );

  /**
   * Generate export text without copying (for preview or other uses)
   */
  const generateExportText = useCallback(
    async <T extends ExtendedExportParams>(
      exportType:
        | "timelog"
        | "notes"
        | "planning"
        | "vision"
        | "finance-trading"
        | "finance-accounts"
        | "finance-cashflow",
      params: T,
    ): Promise<string> => {
      try {
        // Prepare request parameters
        const requestParams = prepareRequestParams(exportType, params);

        // Call backend export API using the dedicated service
        let response: ExportResult;

        switch (exportType) {
          case "timelog":
            response = await exportApi.timelogText(
              requestParams as TimelogExportParams,
            );
            break;
          case "notes":
            response = await exportApi.notesText(
              requestParams as NotesExportParams,
            );
            break;
          case "planning":
            response = await exportApi.planningText(
              requestParams as PlanningExportParams,
            );
            break;
          case "vision": {
            const visionParams = params as VisionExportParams;
            const { vision_id, ...restParams } = visionParams;
            response = await exportApi.visionText(vision_id, restParams);
            break;
          }
          case "finance-accounts": {
            response = await exportApi.financeAccounts(
              requestParams as FinanceAccountsExportParams,
            );
            break;
          }
          case "finance-cashflow": {
            response = await exportApi.financeCashflow(
              requestParams as FinanceCashflowExportParams,
            );
            break;
          }
          case "finance-trading": {
            // Reuse standard export endpoint for text generation
            response = await exportApi.financeTrading(
              requestParams as unknown as FinanceTradingExportParams,
            );
            break;
          }
          default:
            throw new Error(`Unsupported export type: ${exportType}`);
        }

        if (response.success && response.export_text) {
          return response.export_text;
        } else {
          throw new Error(response.message || "生成导出文本失败");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "生成导出文本时发生错误";
        logger.error("Generate export text failed:", error);
        throw new Error(errorMessage);
      }
    },
    [],
  );

  return {
    exportData,
    generateExportText,
  };
};

/**
 * Prepare request parameters for API call
 */
function prepareRequestParams(
  exportType: string,
  params: ExtendedExportParams,
):
  | TimelogExportParams
  | NotesExportParams
  | PlanningExportParams
  | VisionExportParams
  | FinanceTradingExportParams
  | FinanceAccountsExportParams
  | FinanceCashflowExportParams
  | Record<string, unknown> {
  const baseParams = {
    locale: params.locale || "zh-CN",
  };

  switch (exportType) {
    case "timelog": {
      const timelogParams = params as ExtendedTimelogExportParams;
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const requestParams: TimelogExportParams = {
        ...baseParams,
        start_date: formatDate(timelogParams.start_date),
        end_date: formatDate(timelogParams.end_date),
        description_keyword: timelogParams.description_keyword || null,
      };

      if ("dimension_id" in timelogParams) {
        requestParams.dimension_id = timelogParams.dimension_id ?? null;
      }

      return requestParams;
    }
    case "notes": {
      const notesParams = params as NotesExportParams;
      return {
        ...baseParams,
        selected_filter_tags: notesParams.selected_filter_tags,
        selected_filter_persons: notesParams.selected_filter_persons,
        search_keyword: notesParams.search_keyword,
        filter_summary: notesParams.filter_summary,
      } as NotesExportParams;
    }
    case "planning": {
      const planningParams = params as ExtendedPlanningExportParams;
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
      return {
        ...baseParams,
        view_type: planningParams.view_type,
        selected_date: formatDate(planningParams.selected_date),
        include_notes: planningParams.include_notes,
        include_task_notes: planningParams.include_task_notes,
        include_cycle_notes: planningParams.include_cycle_notes,
      } as PlanningExportParams;
    }
    case "vision": {
      const visionParams = params as VisionExportParams;
      return {
        ...baseParams,
        vision_id: visionParams.vision_id,
        include_subtasks: visionParams.include_subtasks,
        include_notes: visionParams.include_notes,
        include_time_records: visionParams.include_time_records,
      };
    }
    case "finance-trading": {
      const tradingParams = params as FinanceTradingExportParams;
      return {
        ...baseParams,
        plan_id: tradingParams.plan_id,
        instrument_id: tradingParams.instrument_id,
        start_time: tradingParams.start_time,
        end_time: tradingParams.end_time,
        format: tradingParams.format || "text",
      };
    }
    case "finance-accounts": {
      const accParams = params as FinanceAccountsExportParams;
      return {
        ...baseParams,
        format: accParams.format || "text",
      };
    }
    case "finance-cashflow": {
      const cfParams = params as FinanceCashflowExportParams;
      return {
        ...baseParams,
        start_time: cfParams.start_time,
        end_time: cfParams.end_time,
        format: cfParams.format || "text",
      };
    }
    default:
      return baseParams;
  }
}

/**
 * Open export text in new window for manual copy
 */
function openExportWindow(text: string, filename: string): void {
  const textWindow = window.open("", "_blank");
  if (textWindow) {
    textWindow.document.write(`
      <html>
        <head>
          <title>导出内容 - ${filename}</title>
          <style>
            :root {
              color-scheme: light dark;
              font-family: system-ui, -apple-system, BlinkMacSystemFont,
                "Segoe UI", sans-serif;
              font-size: 16px;
              line-height: 1.6;
            }
            body {
              margin: 0;
              padding: 20px;
              background: #f9fafb;
              color: #111827;
            }
            h2 {
              margin: 0 0 15px;
              font-size: 1.25rem;
              line-height: 1.75rem;
              font-weight: 600;
            }
            .filename {
              color: #4b5563;
              font-size: 0.875rem;
              margin-bottom: 10px;
            }
            .instructions {
              background: #e5e7eb;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 15px;
              font-size: 0.875rem;
            }
            textarea {
              width: 100%;
              height: 400px;
              font-family: "JetBrains Mono", "Fira Code", ui-monospace,
                SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
                "Courier New", monospace;
              margin: 10px 0;
              font-size: 0.875rem;
              line-height: 1.5;
              color: inherit;
              background: #ffffff;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 12px;
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          <h2>导出内容</h2>
          <div class="filename">文件名: ${filename}</div>
          <div class="instructions">
            <p><strong>请复制以下内容：</strong></p>
            <p>1. 按 Ctrl+A 全选 (或 Cmd+A 在 Mac 上)</p>
            <p>2. 按 Ctrl+C 复制 (或 Cmd+C 在 Mac 上)</p>
            <p>3. 粘贴到您需要的地方</p>
          </div>
          <textarea readonly>${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</textarea>
        </body>
      </html>
    `);
    textWindow.document.close();
  }
}

// Export convenience functions for specific data types
export const useTimelogExport = () => {
  const { exportData, generateExportText } = useExportInternal();

  return {
    exportData: (
      params: ExtendedTimelogExportParams,
      options?: ExportOptions,
    ) =>
      exportData("timelog", params, {
        estimateModule: "timelog",
        ...options,
      }),
    generateExportText: (params: ExtendedTimelogExportParams) =>
      generateExportText("timelog", params),
  };
};

export const useNotesExport = () => {
  const { exportData, generateExportText } = useExportInternal();

  return {
    exportData: (params: NotesExportParams, options?: ExportOptions) =>
      exportData("notes", params, { estimateModule: "notes", ...options }),
    generateExportText: (params: NotesExportParams) =>
      generateExportText("notes", params),
  };
};

export const usePlanningExport = () => {
  const { exportData, generateExportText } = useExportInternal();

  return {
    exportData: (
      params: ExtendedPlanningExportParams,
      options?: ExportOptions,
    ) =>
      exportData("planning", params, {
        estimateModule: "planning",
        ...options,
      }),
    generateExportText: (params: ExtendedPlanningExportParams) =>
      generateExportText("planning", params),
  };
};

export const useVisionExport = () => {
  const { exportData, generateExportText } = useExportInternal();

  return {
    exportData: (params: VisionExportParams, options?: ExportOptions) =>
      exportData("vision", params, {
        estimateModule: params.vision_id
          ? `vision:${params.vision_id}`
          : undefined,
        ...options,
      }),
    generateExportText: (params: VisionExportParams) =>
      generateExportText("vision", params),
  };
};

export const useFinanceTradingExport = () => {
  const { exportData, generateExportText } = useExportInternal();

  return {
    exportData: (params: FinanceTradingExportParams, options?: ExportOptions) =>
      exportData("finance-trading", params, {
        estimateModule: "finance-trading",
        ...options,
      }),
    generateExportText: (params: FinanceTradingExportParams) =>
      generateExportText("finance-trading", params),
  };
};

export const useFinanceAccountsExport = () => {
  const { exportData, generateExportText } = useExportInternal();

  return {
    exportData: (
      params: FinanceAccountsExportParams,
      options?: ExportOptions,
    ) =>
      exportData("finance-accounts", params, {
        estimateModule: "finance-accounts",
        ...options,
      }),
    generateExportText: (params: FinanceAccountsExportParams) =>
      generateExportText("finance-accounts", params),
  };
};

export const useFinanceCashflowExport = () => {
  const { exportData, generateExportText } = useExportInternal();

  return {
    exportData: (
      params: FinanceCashflowExportParams,
      options?: ExportOptions,
    ) =>
      exportData("finance-cashflow", params, {
        estimateModule: "finance-cashflow",
        ...options,
      }),
    generateExportText: (params: FinanceCashflowExportParams) =>
      generateExportText("finance-cashflow", params),
  };
};
