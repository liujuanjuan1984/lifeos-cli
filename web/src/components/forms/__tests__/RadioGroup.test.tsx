import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import RadioGroup from "@/components/forms/RadioGroup";

describe("RadioGroup", () => {
  const options = [
    { value: "single", label: "Single" },
    { value: "future", label: "Future" },
    { value: "all", label: "All", disabled: true },
  ];

  it("renders controlled options and emits change events", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <RadioGroup
        options={options}
        value="single"
        onChange={onChange}
        label="Edit Scope"
      />,
    );

    await user.click(screen.getByLabelText("Future"));

    expect(onChange).toHaveBeenCalledWith("future");
  });

  it("supports arrow-key navigation and skips disabled options", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <RadioGroup
        options={options}
        value="single"
        onChange={onChange}
        label="Edit Scope"
      />,
    );

    const single = screen.getByLabelText("Single");
    single.focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("future");
  });

  it("renders card options with descriptions", () => {
    render(
      <RadioGroup
        options={[
          {
            value: "single",
            label: "Single event",
            description: "Update only one occurrence.",
          },
        ]}
        value="single"
        variant="card"
      />,
    );

    expect(screen.getByText("Update only one occurrence.")).toBeInTheDocument();
  });
});
