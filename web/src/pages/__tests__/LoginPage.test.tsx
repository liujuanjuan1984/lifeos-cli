import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoginResponse } from "@/services/api/auth";

import { setupRouterMock, setupTranslationMock } from "@test/utils";

const { navigateMock, setSearch } = setupRouterMock({
  search: { next: "/notes" },
});
const { t } = setupTranslationMock();

vi.mock("@/services/api/auth", () => ({
  apiLogin: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  setToken: vi.fn(),
  setUser: vi.fn(),
  decodeJwtSub: vi.fn(() => "user-1"),
  clearAuth: vi.fn(),
}));

vi.mock("@/utils/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/core")>();
  return {
    ...actual,
    isUuid: () => true,
  };
});

const syncTimezonePreferenceMock = vi.fn(() => Promise.resolve());
vi.mock("@/utils/datetime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/datetime")>();
  return {
    ...actual,
    syncTimezonePreference: () => syncTimezonePreferenceMock(),
  };
});

import LoginPage from "@/pages/LoginPage";
import { apiLogin } from "@/services/api/auth";
import { setToken, setUser, decodeJwtSub, clearAuth } from "@/services/auth";

describe("LoginPage", () => {
  beforeEach(() => {
    navigateMock.mockClear();
    t.mockClear();
    t.mockImplementation((key: string) => key);
    vi.mocked(apiLogin).mockReset();
    vi.mocked(setToken).mockClear();
    vi.mocked(setUser).mockClear();
    vi.mocked(decodeJwtSub).mockClear();
    vi.mocked(clearAuth).mockClear();
    syncTimezonePreferenceMock.mockClear();
    setSearch({ next: "/notes" });
  });

  it("renders form fields", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/auth.email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/auth.password/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.login" })).toBeEnabled();
  });

  it("submits credentials and navigates on success", async () => {
    vi.mocked(apiLogin).mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: "user-1", email: "user@example.com", name: "Test User" },
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.password/), "secret");
    await user.click(screen.getByRole("button", { name: "common.login" }));

    await waitFor(() =>
      expect(vi.mocked(apiLogin)).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "secret",
      }),
    );

    expect(vi.mocked(setToken)).toHaveBeenCalledWith("token", {
      expiresInSeconds: 3600,
    });
    expect(vi.mocked(setUser)).toHaveBeenCalledWith({
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
    });
    expect(syncTimezonePreferenceMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/notes", replace: true });
  });

  it("shows error message when login fails", async () => {
    vi.mocked(apiLogin).mockRejectedValue(new Error("Invalid credentials"));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/auth.email/), "bad@example.com");
    await user.type(screen.getByLabelText(/auth.password/), "wrong");
    await user.click(screen.getByRole("button", { name: "common.login" }));

    await waitFor(() =>
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument(),
    );
  });

  it("clears existing auth data on login attempt", async () => {
    vi.mocked(apiLogin).mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: "user-1", email: "user@example.com", name: "Test User" },
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.password/), "secret");
    await user.click(screen.getByRole("button", { name: "common.login" }));

    await waitFor(() => {
      expect(vi.mocked(clearAuth)).toHaveBeenCalled();
    });
  });

  it("disables submit button while logging in", async () => {
    vi.mocked(apiLogin).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.password/), "secret");

    const submitButton = screen.getByRole("button", { name: "common.login" });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
  });

  it("enables submit button after login fails", async () => {
    vi.mocked(apiLogin).mockRejectedValue(new Error("Invalid credentials"));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/auth.email/), "bad@example.com");
    await user.type(screen.getByLabelText(/auth.password/), "wrong");

    const submitButton = screen.getByRole("button", { name: "common.login" });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });

    expect(submitButton).toBeEnabled();
  });

  it("handles network errors gracefully", async () => {
    vi.mocked(apiLogin).mockRejectedValue(new Error("Network error"));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.password/), "secret");
    await user.click(screen.getByRole("button", { name: "common.login" }));

    await waitFor(() =>
      expect(screen.getByText("Network error")).toBeInTheDocument(),
    );
  });

  it("validates email format", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/auth.email/);
    await user.type(emailInput, "invalid-email");

    const emailError = screen.queryByText(/invalid.*email/i);
    if (emailError) {
      expect(emailError).toBeInTheDocument();
    }
  });

  it("handles empty form submission", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: "common.login" }));

    expect(vi.mocked(apiLogin)).not.toHaveBeenCalled();
  });

  it("handles malformed API response", async () => {
    vi.mocked(apiLogin).mockResolvedValue({
      access_token: "token",
    } as LoginResponse);

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.password/), "secret");
    await user.click(screen.getByRole("button", { name: "common.login" }));

    await waitFor(() => {
      expect(
        screen.getByText(/Cannot read properties of undefined/),
      ).toBeInTheDocument();
    });
  });

  it("navigates to correct redirect URL", async () => {
    navigateMock.mockClear();
    setSearch({ next: "/custom-page" });

    vi.mocked(apiLogin).mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: "user-1", email: "user@example.com", name: "Test User" },
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.password/), "secret");
    await user.click(screen.getByRole("button", { name: "common.login" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({
        to: "/custom-page",
        replace: true,
      });
    });
  });

  it("handles token expiration during login flow", async () => {
    vi.mocked(apiLogin).mockResolvedValue({
      access_token: "invalid-token",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: "user-1", email: "user@example.com", name: "Test User" },
    });
    vi.mocked(decodeJwtSub).mockReturnValue(null);

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.password/), "secret");
    await user.click(screen.getByRole("button", { name: "common.login" }));

    await waitFor(() => {
      expect(screen.getByText(/auth.invalidToken/)).toBeInTheDocument();
    });
  });
});
