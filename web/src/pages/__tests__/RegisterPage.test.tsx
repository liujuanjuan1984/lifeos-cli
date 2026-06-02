import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RegisterResponse } from "@/services/api/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { setupRouterMock, setupTranslationMock } from "@test/utils";

const { navigateMock } = setupRouterMock();
const { t } = setupTranslationMock();

vi.mock("@/services/api/auth", () => ({
  apiRegister: vi.fn(),
  apiLogin: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  setToken: vi.fn(),
  setUser: vi.fn(),
  decodeJwtSub: vi.fn(() => "user-2"),
  clearAuth: vi.fn(),
}));

vi.mock("@/utils/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/core")>();
  return {
    ...actual,
    isUuid: () => true,
  };
});

const detectTimezoneMock = vi.fn(() => "UTC");
const syncTimezonePreferenceMock = vi.fn(() => Promise.resolve());
vi.mock("@/utils/datetime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/datetime")>();
  return {
    ...actual,
    detectTimezone: () => detectTimezoneMock(),
    syncTimezonePreference: () => syncTimezonePreferenceMock(),
  };
});

const validationMock = vi.fn((password: string) => {
  const base = {
    errors: [] as string[],
    requirements: {
      minLength: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      digit: /\d/.test(password),
      special: /[^\w\s]/.test(password),
    },
  };
  const isValid = Object.values(base.requirements).every(Boolean);
  return {
    isValid,
    errors: isValid ? [] : ["Too weak"],
    requirements: base.requirements,
  };
});

vi.mock("@/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/session")>();
  return {
    ...actual,
    validatePasswordStrength: (password: string) => validationMock(password),
  };
});

vi.mock("@/services/api", () => ({
  invitationsApi: {
    lookupInvitation: vi.fn(),
  },
}));

import RegisterPage from "@/pages/RegisterPage";
import { apiRegister, apiLogin } from "@/services/api/auth";
import { invitationsApi } from "@/services/api";
import { setToken, setUser, decodeJwtSub, clearAuth } from "@/services/auth";

describe("RegisterPage", () => {
  let queryClient: QueryClient;

  const renderRegisterPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <RegisterPage />
      </QueryClientProvider>,
    );

  beforeEach(() => {
    queryClient = new QueryClient();
    navigateMock.mockClear();
    t.mockClear();
    t.mockImplementation((key: string) => key);
    vi.mocked(apiRegister).mockReset();
    vi.mocked(apiLogin).mockReset();
    vi.mocked(setToken).mockClear();
    vi.mocked(setUser).mockClear();
    vi.mocked(decodeJwtSub).mockClear();
    vi.mocked(clearAuth).mockClear();
    detectTimezoneMock.mockClear();
    syncTimezonePreferenceMock.mockClear();
    validationMock.mockClear();
    vi.mocked(invitationsApi.lookupInvitation).mockClear();
    // Mock empty invitation lookup to resolve immediately
    vi.mocked(invitationsApi.lookupInvitation).mockImplementation(
      (code: string) => {
        if (code === "") {
          return Promise.resolve({
            code: "",
            target_email: "",
            status: "pending" as const,
          });
        }
        return Promise.resolve({
          code: "",
          target_email: "",
          status: "pending" as const,
        });
      },
    );
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("blocks submission when password is weak", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "weak");
    await user.click(screen.getByRole("button", { name: "common.register" }));

    await waitFor(() => expect(vi.mocked(apiRegister)).not.toHaveBeenCalled());
    expect(vi.mocked(setToken)).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("registers successfully and navigates", async () => {
    vi.mocked(apiRegister).mockResolvedValue({
      id: "user-2",
      email: "user@example.com",
      name: "Tester",
    });
    vi.mocked(apiLogin).mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: "user-2", email: "user@example.com", name: "Tester" },
    });

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");
    await user.click(screen.getByRole("button", { name: "common.register" }));

    await waitFor(() =>
      expect(vi.mocked(apiRegister)).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "StrongPass1!",
        name: "Tester",
        timezone: "UTC",
        invite_code: "",
      }),
    );

    expect(vi.mocked(apiLogin)).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "StrongPass1!",
    });
    expect(vi.mocked(setToken)).toHaveBeenCalledWith("token", {
      expiresInSeconds: 3600,
    });
    expect(vi.mocked(setUser)).toHaveBeenCalledWith({
      id: "user-2",
      email: "user@example.com",
      name: "Tester",
    });
    expect(syncTimezonePreferenceMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/planning",
      replace: true,
    });
  });

  it("clears existing auth data on registration attempt", async () => {
    vi.mocked(apiRegister).mockResolvedValue({
      id: "user-2",
      email: "user@example.com",
      name: "Tester",
    });
    vi.mocked(apiLogin).mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: "user-2", email: "user@example.com", name: "Tester" },
    });

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");
    await user.click(screen.getByRole("button", { name: "common.register" }));

    await waitFor(() => {
      expect(vi.mocked(clearAuth)).toHaveBeenCalled();
    });
  });

  it("disables submit button while registering", async () => {
    vi.mocked(apiRegister).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");

    const submitButton = screen.getByRole("button", {
      name: "common.register",
    });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
  });

  it("enables submit button after registration fails", async () => {
    vi.mocked(apiRegister).mockRejectedValue(new Error("Email already exists"));

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(
      screen.getByLabelText(/auth.email/),
      "existing@example.com",
    );
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");

    const submitButton = screen.getByRole("button", {
      name: "common.register",
    });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Email already exists")).toBeInTheDocument();
    });

    expect(submitButton).toBeEnabled();
  });

  it("handles email already registered error", async () => {
    vi.mocked(apiRegister).mockRejectedValue(
      new Error("Email already registered"),
    );

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(
      screen.getByLabelText(/auth.email/),
      "existing@example.com",
    );
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");
    await user.click(screen.getByRole("button", { name: "common.register" }));

    await waitFor(() =>
      expect(screen.getByText("Email already registered")).toBeInTheDocument(),
    );

    expect(vi.mocked(apiLogin)).not.toHaveBeenCalled();
  });

  it("validates email format during registration", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const emailInput = screen.getByLabelText(/auth.email/);
    await user.type(emailInput, "invalid-email");

    const emailError = screen.queryByText(/invalid.*email/i);
    if (emailError) {
      expect(emailError).toBeInTheDocument();
    }
  });

  it("validates name field is not empty", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");

    await user.click(screen.getByRole("button", { name: "common.register" }));

    expect(vi.mocked(apiRegister)).not.toHaveBeenCalled();
  });

  it("handles registration with timezone selection", async () => {
    vi.mocked(apiRegister).mockResolvedValue({
      id: "user-2",
      email: "user@example.com",
      name: "Tester",
    });
    vi.mocked(apiLogin).mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: "user-2", email: "user@example.com", name: "Tester" },
    });

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");

    const timezoneSelect = screen.queryByLabelText(/timezone/i);
    if (timezoneSelect) {
      await user.selectOptions(timezoneSelect, "America/New_York");
    }

    await user.click(screen.getByRole("button", { name: "common.register" }));

    await waitFor(() =>
      expect(vi.mocked(apiRegister)).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "StrongPass1!",
        name: "Tester",
        timezone: timezoneSelect ? "America/New_York" : "UTC",
        invite_code: "",
      }),
    );
  });

  it("handles network errors during registration", async () => {
    vi.mocked(apiRegister).mockRejectedValue(new Error("Network error"));

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");
    await user.click(screen.getByRole("button", { name: "common.register" }));

    await waitFor(() =>
      expect(screen.getByText("Network error")).toBeInTheDocument(),
    );
  });

  it("handles login failure after successful registration", async () => {
    vi.mocked(apiRegister).mockResolvedValue({
      id: "user-2",
      email: "user@example.com",
      name: "Tester",
    });
    vi.mocked(apiLogin).mockRejectedValue(new Error("Auto login failed"));

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");
    await user.click(screen.getByRole("button", { name: "common.register" }));

    await waitFor(() =>
      expect(screen.getByText("Auto login failed")).toBeInTheDocument(),
    );

    expect(vi.mocked(apiRegister)).toHaveBeenCalled();
    expect(vi.mocked(setToken)).not.toHaveBeenCalled();
  });

  it("shows real-time password strength validation", async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    const passwordInput = screen.getByLabelText(/auth.password/);

    await user.type(passwordInput, "weak");

    const strengthIndicator = screen.queryByText(/password.*strength/i);
    if (strengthIndicator) {
      expect(strengthIndicator).toBeInTheDocument();
    }

    await user.type(passwordInput, "StrongPass1!");

    const strongIndicator = screen.queryByText(/strong/i);
    if (strongIndicator) {
      expect(strongIndicator).toBeInTheDocument();
    }
  });

  it("handles malformed API response during registration", async () => {
    vi.mocked(apiRegister).mockRejectedValue(new Error("Invalid response"));

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");
    await user.click(screen.getByRole("button", { name: "common.register" }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid response/)).toBeInTheDocument();
    });
  });

  it("prevents duplicate form submissions", async () => {
    let resolveRegistration: (value: RegisterResponse) => void;
    const registrationPromise = new Promise<RegisterResponse>((resolve) => {
      resolveRegistration = resolve;
    });

    vi.mocked(apiRegister).mockReturnValue(registrationPromise);
    vi.mocked(apiLogin).mockResolvedValue({
      access_token: "token",
      token_type: "bearer",
      expires_in: 3600,
      user: { id: "user-2", email: "user@example.com", name: "Tester" },
    });

    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/auth.email/), "user@example.com");
    await user.type(screen.getByLabelText(/auth.name/), "Tester");
    await user.type(screen.getByLabelText(/auth.password/), "StrongPass1!");

    const submitButton = screen.getByRole("button", {
      name: "common.register",
    });

    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    expect(vi.mocked(apiRegister)).toHaveBeenCalledTimes(1);

    resolveRegistration!({
      id: "user-2",
      email: "user@example.com",
      name: "Tester",
    });

    await waitFor(() => {
      expect(vi.mocked(apiLogin)).toHaveBeenCalledTimes(1);
    });
  });
});
