import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePlanningExport, useTimelogExport } from "@/hooks/useExport";
import type {
  ExtendedPlanningExportParams,
  ExtendedTimelogExportParams,
} from "@/services/api/export";

const exportApiMock = vi.hoisted(() => ({
  planningText: vi.fn(),
  timelogText: vi.fn(),
}));

const toastMock = {
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
};

vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => toastMock,
}));

vi.mock("@/services/api", () => ({
  exportApi: exportApiMock,
}));

describe("usePlanningExport parameter formatting", () => {
  beforeEach(() => {
    exportApiMock.planningText.mockReset();
    Object.values(toastMock).forEach((fn) => fn.mockReset());
  });

  it("formats selected date and preserves flags", async () => {
    exportApiMock.planningText.mockResolvedValue({
      success: true,
      export_text: "ok",
    });

    const { result } = renderHook(() => usePlanningExport());

    const params: ExtendedPlanningExportParams = {
      view_type: "day",
      selected_date: new Date(2025, 9, 12, 15, 30),
      include_notes: true,
      include_task_notes: false,
    };

    await act(async () => {
      await result.current.generateExportText(params);
    });

    expect(exportApiMock.planningText).toHaveBeenCalledTimes(1);
    expect(exportApiMock.planningText.mock.calls[0][0]).toMatchObject({
      locale: "zh-CN",
      selected_date: "2025-10-12",
      include_notes: true,
      include_task_notes: false,
    });
  });
});

describe("useTimelogExport parameter formatting", () => {
  beforeEach(() => {
    exportApiMock.timelogText.mockReset();
    Object.values(toastMock).forEach((fn) => fn.mockReset());
  });

  it("normalizes nullable filters when generating text", async () => {
    exportApiMock.timelogText.mockResolvedValue({
      success: true,
      export_text: "ok",
    });

    const { result } = renderHook(() => useTimelogExport());

    const params: ExtendedTimelogExportParams = {
      start_date: new Date(2025, 5, 1),
      end_date: new Date(2025, 5, 2),
    };

    await act(async () => {
      await result.current.generateExportText(params);
    });

    expect(exportApiMock.timelogText).toHaveBeenCalledTimes(1);
    expect(exportApiMock.timelogText.mock.calls[0][0]).toMatchObject({
      start_date: "2025-06-01",
      end_date: "2025-06-02",
      description_keyword: null,
      locale: "zh-CN",
    });
    expect(exportApiMock.timelogText.mock.calls[0][0]).not.toHaveProperty(
      "dimension_id",
    );
  });

  it("preserves an explicit null dimension filter when generating text", async () => {
    exportApiMock.timelogText.mockResolvedValue({
      success: true,
      export_text: "ok",
    });

    const { result } = renderHook(() => useTimelogExport());

    const params: ExtendedTimelogExportParams = {
      start_date: new Date(2025, 5, 1),
      end_date: new Date(2025, 5, 2),
      dimension_id: null,
    };

    await act(async () => {
      await result.current.generateExportText(params);
    });

    expect(exportApiMock.timelogText).toHaveBeenCalledTimes(1);
    expect(exportApiMock.timelogText.mock.calls[0][0]).toMatchObject({
      start_date: "2025-06-01",
      end_date: "2025-06-02",
      dimension_id: null,
      locale: "zh-CN",
    });
  });
});
