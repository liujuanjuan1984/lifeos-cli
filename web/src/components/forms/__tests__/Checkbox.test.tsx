import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Checkbox from "@/components/forms/Checkbox";

describe("Checkbox", () => {
  it("renders label, description, and error messaging", () => {
    render(
      <Checkbox
        label="Accept terms"
        description="You must accept to proceed"
        required
        error="Selection required"
        checked
      />,
    );

    expect(screen.getByText("Accept terms")).toBeInTheDocument();
    expect(screen.getByText("You must accept to proceed")).toBeInTheDocument();
    expect(screen.getByText("Selection required")).toBeInTheDocument();
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAttribute("aria-invalid", "true");
    expect(checkbox).toHaveAttribute("aria-required", "true");
  });

  it("calls native onChange and onCheckedChange when clicked", async () => {
    const onChange = vi.fn();
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Checkbox
        label="Receive updates"
        onChange={onChange}
        onCheckedChange={onCheckedChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledTimes(1);
    const event = onChange.mock.calls[0]?.[0];
    expect(event).toBeDefined();
    expect(event.target.checked).toBe(true);
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.any(Object));
  });

  it("does not emit changes when readOnly", async () => {
    const onCheckedChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Checkbox
        label="Read only"
        checked={false}
        readOnly
        onCheckedChange={onCheckedChange}
      />,
    );
    const checkbox = screen.getByRole("checkbox");

    await user.click(checkbox);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("supports uncontrolled usage via defaultChecked", async () => {
    const user = userEvent.setup();

    render(<Checkbox label="Default selection" defaultChecked />);
    const checkbox = screen.getByRole("checkbox");

    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it("sets indeterminate state on the input element", async () => {
    render(<Checkbox label="Partial" indeterminate />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    await waitFor(() => expect(checkbox.indeterminate).toBe(true));
    expect(checkbox).toHaveAttribute("aria-checked", "mixed");
  });
});
