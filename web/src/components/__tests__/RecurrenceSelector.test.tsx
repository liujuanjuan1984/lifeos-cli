import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { setupTranslationMock } from "@test/utils";
import RecurrenceSelector from "@/components/RecurrenceSelector";

setupTranslationMock();

describe("RecurrenceSelector", () => {
  it("parses monthly ordinal weekday rules for edit forms", () => {
    render(
      <RecurrenceSelector
        value="FREQ=MONTHLY;BYDAY=2MO"
        onChange={vi.fn()}
        startDate={new Date("2026-04-13T09:00:00Z")}
      />,
    );

    expect(screen.getByText("预览：每月第二个周一")).toBeInTheDocument();
  });

  it("parses month-day and yearly month rules for edit forms", () => {
    render(
      <RecurrenceSelector
        value="FREQ=YEARLY;BYMONTH=6"
        onChange={vi.fn()}
        startDate={new Date("2026-06-15T09:00:00Z")}
      />,
    );

    expect(screen.getByText("预览：每年")).toBeInTheDocument();
  });
});
