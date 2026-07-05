import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@test/utils";
import type { Note } from "@/types/newNotes";
import type { UUID } from "@/types/primitive";
import NoteItem from "@/components/notes/NoteItem";

const baseNote: Note = {
  id: "note-1" as UUID,
  content: "Completed after lunch",
  createdAt: new Date("2026-07-05T12:00:00.000Z"),
  people: [],
  tags: [],
  task: null,
  timelogs: [],
  habit_actions: [
    {
      id: "action-1" as UUID,
      habit_id: "habit-1" as UUID,
      habit_title: "Morning Walk",
      action_date: "2026-07-05",
      status: "done",
    },
  ],
};

describe("NoteItem", () => {
  it("renders linked habit action context on note cards", () => {
    renderWithProviders(
      <NoteItem
        note={baseNote}
        selectedFilterTag={null}
        selectedFilterPerson={null}
        selectedFilterTaskId={null}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onTagClick={vi.fn()}
        onPersonClick={vi.fn()}
        onTaskClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: /Morning Walk · 2026-07-05 \(done\)/,
      }),
    ).toBeInTheDocument();
  });
});
