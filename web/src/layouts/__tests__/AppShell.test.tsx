import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AppShell from "@/layouts/AppShell";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          "common.user": "User",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: "/notes" }),
}));

vi.mock("@/contexts/PageHeaderProvider", () => ({
  PageHeaderProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/PageHeader", () => ({
  AutoPageHeader: () => null,
}));

vi.mock("@/hooks/useModuleConfig", () => ({
  useModuleConfig: () => ({
    navModules: [],
    getModuleByKey: () => null,
  }),
}));

vi.mock("@/hooks/queries/useVisibleModules", () => ({
  useVisibleModules: () => ({ visibleKeys: [] }),
}));

vi.mock("@/contexts/PageHeaderContext", () => ({
  usePageHeader: () => ({
    title: null,
    subtitle: null,
    actions: null,
  }),
}));

vi.mock("@/components/ActionButton", () => ({
  default: () => null,
}));

vi.mock("@/components/icons", () => ({
  Icon: () => null,
}));

describe("AppShell local identity", () => {
  it("renders local web identity without auth logout controls", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    expect(screen.getAllByText("Web UI")).toHaveLength(2);
    expect(screen.getAllByText("User")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Logout" })).toBeNull();
  });
});
