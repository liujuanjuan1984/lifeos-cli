import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { setupTranslationMock } from "@test/utils";

type MockTranslatorOptions = string | Record<string, unknown> | undefined;

setupTranslationMock({
  translator: (key: string, options?: MockTranslatorOptions) => {
    if (options && typeof options !== "string" && options.name) {
      return `${key}:${String(options.name)}`;
    }
    return key;
  },
});

type MockDropdownOptions = {
  isOpen: boolean;
  usePortal?: boolean;
  [key: string]: unknown;
};

vi.mock("@/components/selects/useDropdownSurface", () => ({
  useDropdownSurface: (options: MockDropdownOptions) => ({
    isOpen: options.isOpen,
    menuRef: { current: null },
    menuPos: { top: 0, left: 0, width: 260, maxHeight: 240 },
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

import AsyncEntityMultiSelect from "@/components/selects/AsyncEntityMultiSelect";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AsyncEntityMultiSelect", () => {
  const baseOptions = [
    { id: "alpha", label: "Alpha" },
    { id: "beta", label: "Beta" },
  ];

  it("adds an option in multi-select mode", async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AsyncEntityMultiSelect
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
        options={baseOptions}
        placeholder="Pick option"
        usePortal={false}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.click(await screen.findByRole("button", { name: "Alpha" }));

    expect(onSelectionChange).toHaveBeenCalledWith(["alpha"]);
  });

  it("removes the last selected tag with backspace when the query is empty", async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AsyncEntityMultiSelect
        selectedIds={["alpha"]}
        onSelectionChange={onSelectionChange}
        options={baseOptions}
        placeholder="Pick option"
        usePortal={false}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.keyboard("{Backspace}");

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("creates a new option when creation is enabled and no option matches", async () => {
    const onCreateOption = vi.fn(async (label: string) => ({
      id: `new-${label}`,
      label,
    }));
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();

    render(
      <AsyncEntityMultiSelect
        selectedIds={[]}
        onSelectionChange={onSelectionChange}
        options={baseOptions}
        placeholder="Pick option"
        usePortal={false}
        allowCreation
        onCreateOption={onCreateOption}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "Gamma");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onCreateOption).toHaveBeenCalledWith("Gamma"));
    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenCalledWith(["new-Gamma"]),
    );
  });
});
