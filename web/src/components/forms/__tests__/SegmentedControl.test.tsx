import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import SegmentedControl from "@/components/forms/SegmentedControl";

describe("SegmentedControl", () => {
  const options = [
    { value: "week", label: "Week" },
    { value: "day", label: "Day" },
    { value: "month", label: "Month", disabled: true },
  ];

  it("renders selected state and emits click changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SegmentedControl options={options} value="week" onChange={onChange} />,
    );

    await user.click(screen.getByLabelText("Day"));

    expect(onChange).toHaveBeenCalledWith("day");
  });

  it("supports arrow-key navigation and skips disabled options", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SegmentedControl options={options} value="day" onChange={onChange} />,
    );

    const day = screen.getByLabelText("Day");
    day.focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("week");
  });
});
