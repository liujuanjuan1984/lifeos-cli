import { describe, expect, it, vi } from "vitest";

import ApiErrorToaster from "@/components/ApiErrorToaster";
import { renderWithProviders } from "@test/utils";
import { emitApiError } from "@/services/api/errorBus";

describe("ApiErrorToaster", () => {
  it("listens for api:error events and triggers toast", () => {
    const showError = vi.fn();

    const { unmount } = renderWithProviders(<ApiErrorToaster />, {
      toast: { showError },
    });

    emitApiError({ message: "Boom" });

    expect(showError).toHaveBeenCalledWith("网络或服务错误", "Boom");

    unmount();
    emitApiError({ message: "Ignored" });

    expect(showError).toHaveBeenCalledTimes(1);
  });

  it("uses a custom title when provided", () => {
    const showError = vi.fn();

    renderWithProviders(<ApiErrorToaster />, {
      toast: { showError },
    });

    emitApiError({ title: "代理层异常", message: "请稍后重试" });

    expect(showError).toHaveBeenCalledWith("代理层异常", "请稍后重试");
  });
});
