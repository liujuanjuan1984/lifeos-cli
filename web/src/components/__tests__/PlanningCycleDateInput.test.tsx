import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PlanningCycleDateInput } from "@/components/PlanningCycleDateInput";
import { setupTranslationMock } from "@test/utils";

setupTranslationMock({
  translator: (key) => {
    if (key.startsWith("months.")) {
      return `Month ${key.split(".")[1]}`;
    }
    return key;
  },
});

type MockDropdownOptions = {
  isOpen: boolean;
  usePortal?: boolean;
  [key: string]: unknown;
};

vi.mock("@/hooks/useCalendarAdapter", async () => {
  const { GregorianCalendarAdapter } = await import(
    "@/utils/calendar/GregorianCalendarAdapter"
  );
  return {
    usePlanningCycle: () => ({
      adapter: new GregorianCalendarAdapter(),
    }),
  };
});

vi.mock("@/components/selects/useDropdownSurface", () => ({
  useDropdownSurface: (options: MockDropdownOptions) => ({
    isOpen: options.isOpen,
    menuRef: { current: null },
    menuPos: { top: 0, left: 0, width: 240, maxHeight: 320 },
    dataTheme: undefined,
    usePortal: options.usePortal ?? true,
    portalTarget: null,
    getSurfaceStyle: (style: Record<string, unknown> = {}) => ({
      position: options.usePortal ? "fixed" : "absolute",
      ...style,
    }),
    renderSurface: (element: React.ReactElement) =>
      options.isOpen ? element : null,
    recomputePosition: vi.fn(),
  }),
}));

describe("PlanningCycleDateInput", () => {
  it("keeps the selected year when changing a monthly planning month", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <PlanningCycleDateInput
        cycleType="month"
        startDate="2025-05-01"
        onStartDateChange={handleChange}
        id="planning-month"
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("button", { name: "Month 6" }));

    await waitFor(() => expect(handleChange).toHaveBeenCalledWith("2025-06-01"));
  });
});
