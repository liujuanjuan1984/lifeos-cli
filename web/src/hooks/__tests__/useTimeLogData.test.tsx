import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { useTimeLogData } from "@/features/timeLog/controller/useTimeLogData";

const fetchRangeMock = vi.fn();
const deleteMock = vi.fn();
const batchDeleteMock = vi.fn();

vi.mock("@/services/api/timelogs", () => ({
  timelogsApi: {
    fetchRange: (...args: unknown[]) => fetchRangeMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    batchDelete: (...args: unknown[]) => batchDeleteMock(...args),
  },
}));

const processTimeEntriesMock = vi.fn();
const sortTimeEntriesByTimeMock = vi.fn();
vi.mock("@/utils/datetime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/datetime")>();
  return {
    ...actual,
    processTimeEntries: (...args: unknown[]) => processTimeEntriesMock(...args),
    sortTimeEntriesByTime: (...args: unknown[]) =>
      sortTimeEntriesByTimeMock(...args),
    createDateBoundaries: (date: Date) => ({
      startOfDay: new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0),
      ),
      endOfDay: new Date(
        Date.UTC(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          23,
          59,
          59,
        ),
      ),
    }),
  };
});

const toastMock = {
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
};
vi.mock("@/contexts/ToastContext", () => ({
  useToast: () => toastMock,
}));

vi.mock("@/utils/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/core")>();
  return {
    ...actual,
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  };
});

describe("useTimeLogData", () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const setup = () =>
    renderHook(
      () =>
        useTimeLogData({
          selectedDate: new Date("2025-01-01T00:00:00Z"),
          sortOrder: "asc",
          queryMode: "single",
          saveScrollPosition: vi.fn(),
          timezone: "UTC",
        }),
      { wrapper },
    );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    fetchRangeMock.mockReset();
    deleteMock.mockReset();
    batchDeleteMock.mockReset();
    processTimeEntriesMock.mockReset();
    sortTimeEntriesByTimeMock.mockReset();
    toastMock.showSuccess.mockReset();
    toastMock.showError.mockReset();
    toastMock.showInfo.mockReset();
    (globalThis as unknown as { scrollTo?: () => void }).scrollTo = vi.fn();
  });

  it("loads and processes entries on mount", async () => {
    fetchRangeMock.mockResolvedValue({
      items: [
        {
          id: "event-1",
          start_time: "2025-01-01T02:00:00Z",
          end_time: "2025-01-01T03:00:00Z",
        },
      ],
      pagination: { page: 1, size: 1, total: 1, pages: 1 },
      meta: {},
    });
    processTimeEntriesMock.mockReturnValue([
      { id: "processed-1", isPlaceholder: false },
    ]);

    const { result } = setup();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchRangeMock).toHaveBeenCalled();
    expect(sortTimeEntriesByTimeMock).toHaveBeenCalled();
    expect(processTimeEntriesMock).toHaveBeenCalled();
    expect(result.current.processedEntries).toHaveLength(1);
  });

  it("deletes a single entry and shows success toast", async () => {
    fetchRangeMock.mockResolvedValue({
      items: [],
      pagination: { page: 1, size: 0, total: 0, pages: 0 },
      meta: {},
    });
    processTimeEntriesMock.mockReturnValue([]);
    deleteMock.mockResolvedValue(undefined);

    const invalidateSpy = vi.spyOn(QueryClient.prototype, "invalidateQueries");

    const { result } = setup();

    await waitFor(() => expect(fetchRangeMock).toHaveBeenCalled());

    act(() => result.current.requestDeleteEntry("event-1"));
    await act(async () => {
      await result.current.confirmDeleteEntry();
    });

    expect(deleteMock).toHaveBeenCalledWith("event-1");
    expect(toastMock.showSuccess).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();

    invalidateSpy.mockRestore();
  });

  it("batch deletes selected entries and clears selection", async () => {
    fetchRangeMock.mockResolvedValue({
      items: [],
      pagination: { page: 1, size: 0, total: 0, pages: 0 },
      meta: {},
    });
    processTimeEntriesMock.mockReturnValue([]);
    batchDeleteMock.mockResolvedValue({
      failed_ids: [],
      deleted_count: 2,
      errors: [],
    });

    const { result } = setup();

    await waitFor(() => expect(fetchRangeMock).toHaveBeenCalled());

    act(() => {
      result.current.selectionHandlers.handleSelectEntry(
        "event-1" as never,
        true,
      );
      result.current.selectionHandlers.handleSelectEntry(
        "event-2" as never,
        true,
      );
    });

    act(() => result.current.requestBatchDelete());

    await act(async () => {
      await result.current.confirmBatchDelete();
    });

    expect(batchDeleteMock).toHaveBeenCalledWith(["event-1", "event-2"]);
    expect(toastMock.showSuccess).toHaveBeenCalled();
    expect(result.current.selectedEntryIds.size).toBe(0);
    expect(result.current.isSelectMode).toBe(false);
  });
});
