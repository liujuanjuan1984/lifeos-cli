import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@test/utils";
import type { HabitAction } from "@/services/api/habits";
import type { UUID } from "@/types/primitive";
import { HabitActionList } from "@/components/habits/HabitActionList";

const action: HabitAction = {
  id: "action-1" as UUID,
  habit_id: "habit-1" as UUID,
  action_date: "2026-07-04",
  status: "done",
  notes: "Completed after lunch",
  linked_notes_count: 1,
};
const actionWithoutNotes: HabitAction = {
  id: "action-0" as UUID,
  habit_id: "habit-1" as UUID,
  action_date: "2026-07-03",
  status: "pending",
  notes: null,
  linked_notes_count: 0,
};

describe("HabitActionList", () => {
  it("does not render note details in the five day view", () => {
    renderWithProviders(
      <HabitActionList
        actions={[actionWithoutNotes, action]}
        habitId={"habit-1" as UUID}
        habitTitle="Morning Walk"
        durationDays={5}
        startDate="2026-07-02"
        centerDate={new Date("2026-07-04T00:00:00")}
        onCenterDateChange={vi.fn()}
        onStatusUpdate={vi.fn()}
      />,
    );

    expect(screen.queryByText("Completed after lunch")).not.toBeInTheDocument();
    const viewButtons = screen.getAllByRole("button", {
      name: "notes.actions.viewNotes",
    });
    expect(viewButtons).toHaveLength(2);
    expect(viewButtons[0]).toBeDisabled();
    expect(viewButtons[1]).toBeEnabled();
  });
});
