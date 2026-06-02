import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTimelogExport } from "@/hooks/useExport";
import type { ExtendedTimelogExportParams } from "@/services/api/export";

const loggerErrorMock = vi.fn();
const copyToClipboardMock = vi.fn();
vi.mock("@/utils/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/core")>();
  return {
    ...actual,
    copyToClipboard: (...args: unknown[]) => copyToClipboardMock(...args),
    logger: {
      error: (...args: unknown[]) => loggerErrorMock(...args),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  };
});

const toastMock = {
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
};

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => toastMock,
}));

const exportApiMock = vi.hoisted(() => ({
  timelog: vi.fn(),
  timelogText: vi.fn(),
  notes: vi.fn(),
  notesText: vi.fn(),
  planning: vi.fn(),
  planningText: vi.fn(),
  vision: vi.fn(),
  visionText: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  exportApi: exportApiMock,
}));

describe("useTimelogExport", () => {
  const originalOpen = window.open;

  beforeEach(() => {
    copyToClipboardMock.mockReset();
    Object.values(toastMock).forEach((fn) => fn.mockReset());
    Object.values(exportApiMock).forEach((fn) => fn.mockReset());
    window.open = vi.fn(
      () =>
        ({ document: { write: vi.fn(), close: vi.fn() } }) as unknown as Window,
    );
    loggerErrorMock.mockReset();
  });

  afterEach(() => {
    window.open = originalOpen;
  });

  it("copies export text to clipboard and shows success toast", async () => {
    exportApiMock.timelog.mockResolvedValue({
      success: true,
      export_text: "data",
      filename: "export.txt",
    });
    copyToClipboardMock.mockResolvedValue({
      success: true,
      requiresManualCopy: false,
    });

    const { result } = renderHook(() => useTimelogExport());

    const params: ExtendedTimelogExportParams = {
      start_date: new Date("2025-01-01T00:00:00Z"),
      end_date: new Date("2025-01-02T00:00:00Z"),
    };

    await act(async () => {
      await result.current.exportData(params);
    });

    expect(exportApiMock.timelog).toHaveBeenCalled();
    expect(copyToClipboardMock).toHaveBeenCalledWith("data");
    expect(toastMock.showInfo).toHaveBeenCalledWith(
      "导出中",
      "正在准备导出数据...",
    );
    expect(toastMock.showSuccess).toHaveBeenCalledWith(
      "导出成功",
      "已复制到剪贴板",
    );
  });

  it("handles export errors and shows error toast", async () => {
    exportApiMock.timelog.mockResolvedValue({
      success: false,
      message: "failed",
    });

    const { result } = renderHook(() => useTimelogExport());

    const params: ExtendedTimelogExportParams = {
      start_date: new Date("2025-01-01T00:00:00Z"),
      end_date: new Date("2025-01-02T00:00:00Z"),
    };

    await act(async () => {
      await result.current.exportData(params);
    });

    expect(copyToClipboardMock).not.toHaveBeenCalled();
    expect(toastMock.showError).toHaveBeenCalledWith("导出失败", "failed");
  });
});
