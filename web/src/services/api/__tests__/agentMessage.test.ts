import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAccessTokenForPathMock, clearAuthMock, loggerDebugMock } =
  vi.hoisted(() => ({
    resolveAccessTokenForPathMock: vi.fn(),
    clearAuthMock: vi.fn(),
    loggerDebugMock: vi.fn(),
  }));

vi.mock("@/i18n", () => ({
  t: vi.fn((key: string) => key),
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

  return {
    ApiError: MockApiError,
    API_BASE_URL: "http://localhost:8000",
    http: {
      post: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    },
    resolveAccessTokenForPath: resolveAccessTokenForPathMock,
  };
});

vi.mock("@/services/auth", () => ({
  clearAuth: clearAuthMock,
}));

vi.mock("@/utils/core", () => ({
  logger: {
    debug: loggerDebugMock,
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { agentMessageApi } from "@/services/api/agentMessage";
import { ApiError } from "@/services/api/client";

describe("agentMessageApi.streamMessage auth fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login when auth recovery fails before the stream request", async () => {
    resolveAccessTokenForPathMock.mockRejectedValue(
      new ApiError("apiErrors.notLoggedIn", 401),
    );
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const replaceMock = vi.fn();
    const originalLocation = window.location;

    Object.defineProperty(window, "location", {
      configurable: true,
      value: { pathname: "/agent", search: "?tab=chat", replace: replaceMock },
    });

    await expect(
      agentMessageApi.streamMessage(
        { content: "hello" },
        {
          onEvent: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(clearAuthMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      "/login?next=%2Fagent%3Ftab%3Dchat",
    );

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    fetchMock.mockRestore();
  });
});
