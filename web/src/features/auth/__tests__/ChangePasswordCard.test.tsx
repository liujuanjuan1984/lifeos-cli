import { describe, beforeEach, it, expect, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";

import {
  renderWithProviders,
  setupRouterMock,
  setupTranslationMock,
} from "@test/utils";
import ChangePasswordCard from "@/features/auth/ChangePasswordCard";

vi.mock("@/services/api/auth", () => ({
  apiChangePassword: vi.fn(),
}));

vi.mock("@/services/auth", () => ({
  clearAuth: vi.fn(),
}));

import { apiChangePassword } from "@/services/api/auth";
import { clearAuth } from "@/services/auth";

describe("ChangePasswordCard", () => {
  const { navigateMock } = setupRouterMock();
  setupTranslationMock();

  beforeEach(() => {
    vi.mocked(apiChangePassword).mockReset();
    vi.mocked(clearAuth).mockReset();
    navigateMock.mockReset();
  });

  const renderComponent = () => renderWithProviders(<ChangePasswordCard />);

  it("blocks submission when confirmation mismatches", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.type(screen.getByLabelText(/auth.currentPassword/), "OldPass!1");
    await user.type(screen.getByLabelText(/auth.newPassword/), "NewPass!2");
    await user.type(screen.getByLabelText(/auth.confirmPassword/), "Mismatch!");
    await user.click(
      screen.getByRole("button", { name: /auth.changePassword/ }),
    );

    expect(apiChangePassword).not.toHaveBeenCalled();
    expect(screen.getByText(/auth.passwordMismatch/)).toBeInTheDocument();
  });

  it("submits successfully and logs the user out", async () => {
    vi.mocked(apiChangePassword).mockResolvedValue({
      message: "Password updated successfully",
    });

    const user = userEvent.setup();
    renderComponent();

    await user.type(screen.getByLabelText(/auth.currentPassword/), "OldPass!1");
    await user.type(screen.getByLabelText(/auth.newPassword/), "NewPass!2");
    await user.type(screen.getByLabelText(/auth.confirmPassword/), "NewPass!2");
    await user.click(
      screen.getByRole("button", { name: /auth.changePassword/ }),
    );

    await waitFor(() => expect(apiChangePassword).toHaveBeenCalledTimes(1));
    expect(apiChangePassword).toHaveBeenCalledWith({
      current_password: "OldPass!1",
      new_password: "NewPass!2",
      new_password_confirm: "NewPass!2",
    });
    expect(clearAuth).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/login", replace: true });
  });

  it("surfaces API errors", async () => {
    vi.mocked(apiChangePassword).mockRejectedValue(
      new Error("Network failure"),
    );

    const user = userEvent.setup();
    renderComponent();

    await user.type(screen.getByLabelText(/auth.currentPassword/), "OldPass!1");
    await user.type(screen.getByLabelText(/auth.newPassword/), "NewPass!2");
    await user.type(screen.getByLabelText(/auth.confirmPassword/), "NewPass!2");
    await user.click(
      screen.getByRole("button", { name: /auth.changePassword/ }),
    );

    await waitFor(() =>
      expect(screen.getByText("Network failure")).toBeInTheDocument(),
    );
  });
});
