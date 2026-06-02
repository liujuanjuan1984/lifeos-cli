import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { setupTranslationMock } from "@test/utils";

setupTranslationMock();

type MockDropdownOptions = {
  isOpen: boolean;
  usePortal?: boolean;
  [key: string]: unknown;
};

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

import AsyncEntitySelect from "@/components/selects/AsyncEntitySelect";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AsyncEntitySelect", () => {
  const baseOptions = [
    { id: "alpha", label: "Alpha" },
    { id: "beta", label: "Beta" },
  ];

  it("opens dropdown on click and allows selecting an option", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AsyncEntitySelect
        options={baseOptions}
        onChange={onChange}
        placeholder="Pick option"
        usePortal={false}
        fullWidth
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);

    const option = await screen.findByRole("button", { name: "Alpha" });
    expect(option).toBeInTheDocument();

    await user.click(option);

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("alpha"));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Alpha" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("filters options based on user input", async () => {
    const user = userEvent.setup();

    render(
      <AsyncEntitySelect
        options={baseOptions}
        onChange={vi.fn()}
        placeholder="Pick option"
        usePortal={false}
        fullWidth
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "bet");

    expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Alpha" }),
    ).not.toBeInTheDocument();
  });

  it("shows empty state message when no options match", async () => {
    const user = userEvent.setup();

    render(
      <AsyncEntitySelect
        options={baseOptions}
        onChange={vi.fn()}
        placeholder="Pick option"
        usePortal={false}
        fullWidth
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "zzz");

    expect(await screen.findByText("common.no_options")).toBeInTheDocument();
  });

  it("does not reopen dropdown on programmatic focus but remains keyboard accessible", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AsyncEntitySelect
        options={baseOptions}
        onChange={onChange}
        placeholder="Pick option"
        usePortal={false}
        fullWidth
      />,
    );

    const input = screen.getByRole("combobox");

    input.focus();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Alpha" }),
      ).not.toBeInTheDocument(),
    );

    await user.keyboard("{ArrowDown}");
    expect(await screen.findByRole("button", { name: "Alpha" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Alpha" }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("alpha"));
  });
});
