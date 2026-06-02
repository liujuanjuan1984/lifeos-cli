import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { usePersonAnniversaries } from "@/hooks/queries/usePersonAnniversaries";
import { ToastContext } from "@/contexts/ToastContext";
import { personsApi } from "@/services/api";
vi.mock("@/services/api", () => ({
  personsApi: {
    getAnniversaries: vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, size: 0, total: 0, pages: 0 },
      meta: { person_id: null },
    }),
    createAnniversary: vi
      .fn()
      .mockResolvedValue({ id: "a", name: "n", date: "2020-01-01" }),
    deleteAnniversary: vi.fn().mockResolvedValue(undefined),
    updateAnniversary: vi
      .fn()
      .mockResolvedValue({ id: "a", name: "n", date: "2020-01-02" }),
  },
}));

const showError = vi.fn();
const showSuccess = vi.fn();

const wrapperFactory = (_personId: string | null) => {
  const queryClient = new QueryClient();
  const toastValue: React.ContextType<typeof ToastContext> = {
    showToast: vi.fn(),
    showSuccess,
    showError,
    showWarning: vi.fn(),
    showInfo: vi.fn(),
  };
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      ToastContext.Provider,
      { value: toastValue },
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        children,
      ),
    );
};

describe("usePersonAnniversaries", () => {
  beforeEach(() => {
    showError.mockClear();
    showSuccess.mockClear();
  });

  it("blocks creation when personId is null", async () => {
    const { result } = renderHook(() => usePersonAnniversaries(null), {
      wrapper: wrapperFactory(null),
    });

    await act(async () => {
      result.current.createAnniversary({ name: "Test", date: "2024-01-01" });
    });

    expect(showError).toHaveBeenCalled();
  });

  it("allows creation when personId is provided", async () => {
    const { result } = renderHook(
      () => usePersonAnniversaries("p1" as unknown as string),
      {
        wrapper: wrapperFactory("p1"),
      },
    );

    await waitFor(() => {
      expect(personsApi.getAnniversaries).toHaveBeenCalled();
      expect(result.current.anniversaries).toEqual([]);
    });

    await act(async () => {
      result.current.createAnniversary({ name: "Test", date: "2024-01-01" });
    });

    await waitFor(
      () => {
        expect(showSuccess).toHaveBeenCalled();
      },
      { timeout: 2000 },
    );
  });
});
