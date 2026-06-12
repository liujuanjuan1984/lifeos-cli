import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Size = "xs" | "sm" | "md" | "lg";

type TestButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: Size;
};

const TestButton: React.FC<TestButtonProps> = ({ label, size, ...rest }) => (
  <button data-size={size} {...rest}>
    {label}
  </button>
);

let ResponsiveActionButtonGroup: typeof import("@/components/ResponsiveActionButtonGroup").default;

const setWindowWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
};

beforeAll(async () => {
  ({ default: ResponsiveActionButtonGroup } = await import(
    "@/components/ResponsiveActionButtonGroup"
  ));
});

beforeEach(() => {
  setWindowWidth(1280);
});

describe("ResponsiveActionButtonGroup", () => {
  it("renders all buttons without menu on large screens", () => {
    render(
      <ResponsiveActionButtonGroup>
        <TestButton label="First" />
        <TestButton label="Second" />
        <TestButton label="Third" />
      </ResponsiveActionButtonGroup>,
    );

    expect(
      screen.queryByRole("button", { name: "更多" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("Third")).toBeInTheDocument();
  });

  it("collapses extra buttons on mobile and restores them via the menu", async () => {
    const thirdClick = vi.fn();
    act(() => setWindowWidth(480));

    render(
      <ResponsiveActionButtonGroup mobileVisibleCount={1}>
        <TestButton label="Primary" />
        <TestButton label="Secondary" />
        <TestButton label="Tertiary" onClick={thirdClick} />
      </ResponsiveActionButtonGroup>,
    );

    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.queryByText("Secondary")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "更多" }));

    const tertiaryButton = await screen.findByRole("button", {
      name: "Tertiary",
    });
    expect(
      screen.getByRole("button", { name: "Secondary" }),
    ).toBeInTheDocument();

    fireEvent.click(tertiaryButton);

    expect(thirdClick).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "Secondary" }),
      ).not.toBeInTheDocument();
    });
  });

  it("applies responsive size map when the viewport changes", async () => {
    act(() => setWindowWidth(900));

    render(
      <ResponsiveActionButtonGroup
        buttonSize={{ mobile: "sm", medium: "md", large: "lg" }}
        mobileVisibleCount={2}
      >
        <TestButton label="First" data-testid="btn-1" />
        <TestButton label="Second" data-testid="btn-2" />
      </ResponsiveActionButtonGroup>,
    );

    expect(screen.getByTestId("btn-1")).toHaveAttribute("data-size", "md");

    await act(async () => {
      setWindowWidth(500);
    });

    await waitFor(() => {
      expect(screen.getByTestId("btn-1")).toHaveAttribute("data-size", "sm");
    });
  });

  it("respects splitOpposite layout with overflow menu", () => {
    act(() => setWindowWidth(480));

    render(
      <ResponsiveActionButtonGroup splitOpposite mobileVisibleCount={2}>
        <TestButton label="Cancel" data-testid="left-btn" />
        <TestButton label="Apply" data-testid="apply-btn" />
        <TestButton label="Archive" data-testid="archive-btn" />
      </ResponsiveActionButtonGroup>,
    );

    expect(screen.getByTestId("left-btn")).toBeInTheDocument();
    expect(screen.getByTestId("apply-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("archive-btn")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "更多" }));
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("applies top border styling when requested", () => {
    act(() => setWindowWidth(480));

    const { container } = render(
      <ResponsiveActionButtonGroup withTopBorder mobileVisibleCount={1}>
        <TestButton label="Primary" />
        <TestButton label="Secondary" />
      </ResponsiveActionButtonGroup>,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("border-t");
  });
});
