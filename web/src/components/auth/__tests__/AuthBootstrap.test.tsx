import { act } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AuthBootstrap from "@/components/auth/AuthBootstrap";
import { resetAuthBootstrapForTests } from "@/components/auth/authBootstrapState";
import { ApiError } from "@/services/api/client";
import {
  __resetAuthStateForTests,
  getAuthState,
  setAuthHydrated,
  setAuthStatus,
  setToken,
} from "@/services/auth";

const {
  computeProactiveRefreshLeadMsMock,
  ensureFreshAccessTokenMock,
  handleAuthExpiredOnceMock,
  hasExceededAuthRecoveryLimitsMock,
  loggerErrorMock,
  loggerWarnMock,
  refreshAccessTokenOnStartupMock,
} = vi.hoisted(() => ({
  computeProactiveRefreshLeadMsMock: vi.fn(
    (_ttlSeconds: number | null) => 5_000,
  ),
  ensureFreshAccessTokenMock: vi.fn(async () => null),
  handleAuthExpiredOnceMock: vi.fn(),
  hasExceededAuthRecoveryLimitsMock: vi.fn(() => false),
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  refreshAccessTokenOnStartupMock: vi.fn(async () => undefined),
}));

vi.mock("@/services/api/client", () => {
  class MockApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  class MockAuthRecoverableError extends Error {
    constructor(message = "recovering") {
      super(message);
      this.name = "AuthRecoverableError";
    }
  }

  return {
    ApiError: MockApiError,
    AuthRecoverableError: MockAuthRecoverableError,
    computeProactiveRefreshLeadMs: (ttlSeconds: number | null) =>
      computeProactiveRefreshLeadMsMock(ttlSeconds),
    ensureFreshAccessToken: () => ensureFreshAccessTokenMock(),
    handleAuthExpiredOnce: () => handleAuthExpiredOnceMock(),
    hasExceededAuthRecoveryLimits: () => hasExceededAuthRecoveryLimitsMock(),
    refreshAccessTokenOnStartup: () => refreshAccessTokenOnStartupMock(),
  };
});

vi.mock("@/utils/core", () => ({
  logger: {
    error: loggerErrorMock,
    warn: loggerWarnMock,
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("AuthBootstrap", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T12:00:00.000Z"));
    vi.clearAllMocks();
    resetAuthBootstrapForTests();
    __resetAuthStateForTests();
  });

  it("runs startup refresh once and marks auth as hydrated", async () => {
    render(<AuthBootstrap />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(refreshAccessTokenOnStartupMock).toHaveBeenCalledTimes(1);
    expect(getAuthState().hydrated).toBe(true);
  });

  it("retries startup refresh on focus after an earlier bootstrap failure without a token", async () => {
    refreshAccessTokenOnStartupMock
      .mockRejectedValueOnce(new Error("bootstrap failed"))
      .mockResolvedValueOnce(undefined);

    render(<AuthBootstrap />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(refreshAccessTokenOnStartupMock).toHaveBeenCalledTimes(1);
    expect(getAuthState().token).toBeNull();
    expect(getAuthState().hydrated).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(refreshAccessTokenOnStartupMock).toHaveBeenCalledTimes(2);
  });

  it("does not keep retrying startup refresh on focus after a forbidden bootstrap failure", async () => {
    refreshAccessTokenOnStartupMock.mockRejectedValueOnce(
      new ApiError("forbidden", 403),
    );

    render(<AuthBootstrap />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(refreshAccessTokenOnStartupMock).toHaveBeenCalledTimes(1);
    expect(getAuthState().token).toBeNull();
    expect(getAuthState().hydrated).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(refreshAccessTokenOnStartupMock).toHaveBeenCalledTimes(1);
  });

  it("schedules proactive refresh before token expiry", () => {
    setAuthHydrated(true);
    setToken("token-1", { expiresInSeconds: 30 });

    render(<AuthBootstrap />);

    act(() => {
      vi.advanceTimersByTime(24_999);
    });
    expect(ensureFreshAccessTokenMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(computeProactiveRefreshLeadMsMock).toHaveBeenCalledWith(30);
    expect(ensureFreshAccessTokenMock).toHaveBeenCalledTimes(1);
  });

  it("retries on a short timer while auth is recovering", () => {
    setAuthHydrated(true);
    setToken("token-1", { expiresInSeconds: 30 });
    setAuthStatus("recovering");

    render(<AuthBootstrap />);

    act(() => {
      vi.advanceTimersByTime(4_999);
    });
    expect(ensureFreshAccessTokenMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(ensureFreshAccessTokenMock).toHaveBeenCalledTimes(1);
  });

  it("expires auth instead of scheduling another retry when recovery budget is exhausted", () => {
    hasExceededAuthRecoveryLimitsMock.mockReturnValueOnce(true);
    setAuthHydrated(true);
    setToken("token-1", { expiresInSeconds: 30 });
    setAuthStatus("recovering");

    render(<AuthBootstrap />);

    expect(handleAuthExpiredOnceMock).toHaveBeenCalledTimes(1);
    expect(ensureFreshAccessTokenMock).not.toHaveBeenCalled();
  });
});
