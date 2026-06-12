import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { setupTranslationMock } from "@test/utils";

setupTranslationMock();

let ActionButton: typeof import("@/components/ActionButton").default;

beforeAll(async () => {
  ({ default: ActionButton } = await import("@/components/ActionButton"));
});

const getActionButton = () => {
  if (!ActionButton) {
    throw new Error("ActionButton was not loaded");
  }
  return ActionButton;
};

describe("ActionButton", () => {
  it("renders label and optional icon", () => {
    const Component = getActionButton();

    render(
      <Component
        label="Create"
        color="primary"
        variant="solid"
        icon={<span data-testid="icon">*</span>}
      />,
    );

    const button = screen.getByRole("button", { name: "Create" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("btn", "btn-primary");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("invokes onClick when enabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const Component = getActionButton();

    render(<Component label="Save" onClick={onClick} />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("supports xs size and iconOnly presentation", () => {
    const Component = getActionButton();

    render(
      <Component
        label="Edit"
        icon={<span data-testid="icon">*</span>}
        size="xs"
        iconOnly
        ariaLabel="Edit action"
      />,
    );

    const button = screen.getByRole("button", { name: "Edit action" });
    expect(button).toHaveClass("btn-xs");
    expect(button).toHaveClass("btn-square");
    const srOnlyLabel = button.querySelector(".sr-only");
    expect(srOnlyLabel).not.toBeNull();
    expect(srOnlyLabel).toHaveTextContent("Edit");
  });

  it("allows overriding shape to circle", () => {
    const Component = getActionButton();

    render(
      <Component
        label=""
        icon={<span data-testid="icon">*</span>}
        size="sm"
        iconOnly
        shape="circle"
        ariaLabel="Close menu"
      />,
    );

    const button = screen.getByRole("button", { name: "Close menu" });
    expect(button).toHaveClass("btn-circle");
  });

  it("does not invoke onClick when disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const Component = getActionButton();

    render(<Component label="Disabled" onClick={onClick} disabled />);

    await user.click(screen.getByRole("button", { name: "Disabled" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
