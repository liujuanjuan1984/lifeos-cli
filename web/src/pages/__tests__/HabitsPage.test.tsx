import { screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { type ReactNode } from "react";

import { renderWithProviders, setupTranslationMock } from "@test/utils";
import type { Habit } from "@/services/api/habits";

const setHeaderMock = vi.fn();

type HabitActionMock = ReturnType<typeof vi.fn>;

interface HabitsHookResult {
  habits: Habit[];
  isLoading: boolean;
  error: Error | null;
  updateActionStatus: HabitActionMock;
  updateActionNotes: HabitActionMock;
  createHabit: HabitActionMock;
  updateHabit: HabitActionMock;
  expandedHabits: Set<Habit["id"]>;
  toggleHabitExpansion: HabitActionMock;
  deletingHabit: Habit | null;
  requestDeleteHabit: HabitActionMock;
  confirmDeleteHabit: HabitActionMock;
  cancelDeleteHabit: HabitActionMock;
}

function createHabitsResult(
  overrides: Partial<HabitsHookResult> = {},
): HabitsHookResult {
  const base: HabitsHookResult = {
    habits: [],
    isLoading: false,
    error: null,
    updateActionStatus: vi.fn(),
    updateActionNotes: vi.fn(),
    createHabit: vi.fn(),
    updateHabit: vi.fn(),
    expandedHabits: new Set(),
    toggleHabitExpansion: vi.fn(),
    deletingHabit: null,
    requestDeleteHabit: vi.fn(),
    confirmDeleteHabit: vi.fn(),
    cancelDeleteHabit: vi.fn(),
  };

  return { ...base, ...overrides };
}

const habitsState: {
  value: HabitsHookResult;
} = {
  value: createHabitsResult(),
};

const useHabitsMock = vi.fn(() => habitsState.value);

vi.mock("@/contexts/PageHeaderContext", () => ({
  usePageHeader: () => ({
    setHeader: setHeaderMock,
  }),
}));

vi.mock("@/features/habits/controller/useHabitManager", () => ({
  useHabitManager: () => useHabitsMock(),
}));

vi.mock("@/components/ActionButton", () => ({
  __esModule: true,
  default: ({
    onClick,
    children,
  }: {
    onClick?: () => void;
    children?: ReactNode;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  CreateNewButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/habits/HabitFormModal", () => ({
  HabitFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="habit-form-modal" /> : null,
}));

vi.mock("@/components/habits/HabitActionList", () => ({
  HabitActionList: () => <div data-testid="habit-action-list" />,
}));

vi.mock("@/components/ExpandableCard", () => ({
  __esModule: true,
  default: ({
    title,
    subtitle,
    children,
  }: {
    title: ReactNode;
    subtitle?: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      <div>{title}</div>
      {subtitle ? <div>{subtitle}</div> : null}
      <div>{children}</div>
    </div>
  ),
}));

import HabitsPage from "@/pages/HabitsPage";

describe("HabitsPage", () => {
  beforeEach(() => {
    setupTranslationMock();
    setHeaderMock.mockClear();
    useHabitsMock.mockImplementation(() => habitsState.value);
    habitsState.value = createHabitsResult();
  });

  it("renders empty state when there are no habits", () => {
    habitsState.value = createHabitsResult({ habits: [] });

    renderWithProviders(<HabitsPage />);

    expect(screen.getByText("habits.emptyState.title")).toBeInTheDocument();
    expect(
      screen.getByText("habits.emptyState.description"),
    ).toBeInTheDocument();
    expect(setHeaderMock).toHaveBeenCalled();
  });

  it("renders habit cards when data exists", () => {
    const habit: Habit = {
      id: "habit-1" as Habit["id"],
      title: "Morning Planning",
      description: "Plan the day",
      status: "active",
      start_date: "2025-01-01",
      duration_days: 30,
      stats: {
        habit_id: "habit-1",
        total_actions: 10,
        completed_actions: 6,
        missed_actions: 2,
        skipped_actions: 2,
        progress_percentage: 50,
        current_streak: 3,
        longest_streak: 5,
      },
      created_at: "2025-01-01T00:00:00",
      updated_at: "2025-01-02T00:00:00",
      deleted_at: null,
    };

    habitsState.value = createHabitsResult({ habits: [habit] });

    renderWithProviders(<HabitsPage />);

    expect(
      screen.queryByText("habits.emptyState.title"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Morning Planning/ }),
    ).toBeInTheDocument();
  });
});
