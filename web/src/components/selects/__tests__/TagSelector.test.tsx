import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import type { Tag } from "@/services/api/tags";
import type { UUID } from "@/types/primitive";

import { setupTranslationMock } from "@test/utils";

setupTranslationMock({
  translator: (key: string, options?: string | Record<string, unknown>) => {
    if (typeof options === "string") {
      return `${key}:${options}`;
    }
    if (options?.name) {
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

vi.mock("@/utils/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/core")>();
  return {
    ...actual,
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    },
  };
});

vi.mock("@/components/selects/useDropdownSurface", () => ({
  useDropdownSurface: (options: MockDropdownOptions) => ({
    isOpen: options.isOpen,
    menuRef: { current: null },
    menuPos: { top: 0, left: 0, width: 280, maxHeight: 200 },
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

let TagSelector: typeof import("@/components/selects/TagSelector").default;

beforeAll(async () => {
  ({ default: TagSelector } = await import("@/components/selects/TagSelector"));
});

const getTagSelector = () => {
  if (!TagSelector) {
    throw new Error("TagSelector was not loaded");
  }
  return TagSelector;
};

const baseTags: Tag[] = [
  {
    id: "tag-1" as UUID,
    name: "Focus",
    entity_type: "task",
    category: "general",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  },
  {
    id: "tag-2" as UUID,
    name: "Health",
    entity_type: "task",
    category: "general",
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z",
  },
];

describe("TagSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects an existing tag from the dropdown", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const Component = getTagSelector();

    render(
      <Component
        availableTags={baseTags}
        selectedTagIds={[]}
        onTagsChange={handleChange}
        onCreateTag={vi.fn()}
        usePortal={false}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);

    const option = await screen.findByRole("button", { name: "Focus" });
    await user.click(option);

    expect(handleChange).toHaveBeenCalledWith(["tag-1"]);
  });

  it("creates a new tag when Enter is pressed", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleCreate = vi.fn(
      async (name: string): Promise<Tag> => ({
        id: "tag-new" as UUID,
        name,
        entity_type: "task",
        category: "general",
        created_at: "2024-01-03T00:00:00Z",
        updated_at: "2024-01-03T00:00:00Z",
      }),
    );
    const Component = getTagSelector();

    render(
      <Component
        availableTags={baseTags}
        selectedTagIds={[]}
        onTagsChange={handleChange}
        onCreateTag={handleCreate}
        usePortal={false}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "Learning");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(handleCreate).toHaveBeenCalledWith("Learning"));
    await waitFor(() => expect(handleChange).toHaveBeenCalledWith(["tag-new"]));
  });

  it("removes a selected tag when clicking the pill", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const Component = getTagSelector();

    render(
      <Component
        availableTags={baseTags}
        selectedTagIds={["tag-1"]}
        onTagsChange={handleChange}
        onCreateTag={vi.fn()}
        usePortal={false}
      />,
    );

    const removeButton = screen.getByRole("button", { name: "×" });
    await user.click(removeButton);

    expect(handleChange).toHaveBeenCalledWith([]);
  });
});
