import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React, { useState } from "react";
import type { PersonSummary } from "@/services/api";
import type { UUID } from "@/types/primitive";

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
    menuPos: { top: 0, left: 0, width: 260, maxHeight: 200 },
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

const createPersons = (): PersonSummary[] => [
  {
    id: "person-1" as UUID,
    display_name: "Ada Lovelace",
    primary_nickname: "Ada",
    tags: [
      {
        id: "tag-1" as UUID,
        name: "Pioneer",
        entity_type: "person",
        category: "general",
        color: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      {
        id: "tag-2" as UUID,
        name: "Engineering",
        entity_type: "person",
        category: "general",
        color: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    ],
  },
  {
    id: "person-2" as UUID,
    display_name: "Grace Hopper",
    primary_nickname: "Grace",
    tags: [],
  },
];

vi.mock("@/hooks/queries/usePersonsList", () => {
  const persons = createPersons();
  return {
    usePersonsList: () => ({ persons }),
  };
});

vi.mock("@/services/api/persons", () => ({
  personsApi: {
    getAll: vi.fn().mockResolvedValue({ items: createPersons() }),
  },
}));

let PersonSelector: typeof import("@/components/selects/PersonSelector").default;

beforeAll(async () => {
  ({ default: PersonSelector } = await import(
    "@/components/selects/PersonSelector"
  ));
});

const getPersonSelector = () => {
  if (!PersonSelector) {
    throw new Error("PersonSelector was not loaded");
  }
  return PersonSelector;
};

describe("PersonSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const Controlled = ({ multiple = true }: { multiple?: boolean }) => {
    const [selected, setSelected] = useState<UUID[]>([]);
    const Component = getPersonSelector();
    return (
      <Component
        selectedPersonIds={selected}
        onSelectionChange={setSelected}
        placeholder="pick"
        usePortal={false}
        multiple={multiple}
      />
    );
  };

  it("allows selecting and toggling persons in multi-select mode", async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    const input = screen.getByRole("combobox");
    await user.click(input);

    const firstOption = await screen.findByRole("button", {
      name: /Ada Lovelace/,
    });
    await user.click(firstOption);

    await waitFor(() =>
      expect(
        screen.getByText(/Ada Lovelace/, { selector: "span" }),
      ).toBeInTheDocument(),
    );

    const secondOption = await screen.findByRole("button", {
      name: /Grace Hopper/,
    });
    await user.click(secondOption);

    await waitFor(() =>
      expect(
        screen.getByText(/Grace Hopper/, { selector: "span" }),
      ).toBeInTheDocument(),
    );

    const removeButtons = screen.getAllByRole("button", { name: "×" });
    await user.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() =>
      expect(
        screen.queryByText(/Grace Hopper/, { selector: "span" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("supports clearing via the None option", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const Component = getPersonSelector();

    render(
      <Component
        selectedPersonIds={["person-1" as UUID]}
        onSelectionChange={onSelectionChange}
        placeholder="pick"
        usePortal={false}
        showNoPersonOption
      />,
    );

    await user.click(screen.getByRole("combobox"));
    const noneButton = await screen.findByRole("button", {
      name: /common.none/,
    });
    await user.click(noneButton);

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("filters results as the user types and selects first match on Enter", async () => {
    const user = userEvent.setup();
    render(<Controlled />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    await user.type(input, "Grace");

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Ada Lovelace/ }),
      ).not.toBeInTheDocument(),
    );

    const filtered = await screen.findByRole("button", {
      name: /Grace Hopper/,
    });
    expect(filtered).toBeInTheDocument();

    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(
        screen.getByText(/Grace Hopper/, { selector: "span" }),
      ).toBeInTheDocument(),
    );
  });

  it("behaves as single-select when multiple is false", async () => {
    const user = userEvent.setup();
    render(<Controlled multiple={false} />);

    const input = screen.getByRole("combobox");
    await user.click(input);
    const option = await screen.findByRole("button", { name: /Ada Lovelace/ });
    await user.click(option);

    await waitFor(() =>
      expect(screen.getByRole("combobox")).toHaveValue("Ada Lovelace"),
    );
  });
});
