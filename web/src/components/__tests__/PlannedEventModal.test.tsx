import { fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlannedEvent } from "@/services/api/plannedEvents";
import PlannedEventModal from "@/components/PlannedEventModal";
import { renderWithProviders, setupTranslationMock } from "@test/utils";

const { updateMock, toastMock, setErrorMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  toastMock: {
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
  },
  setErrorMock: vi.fn(),
}));

vi.mock("@/services/api/plannedEvents", () => ({
  plannedEventsApi: {
    update: updateMock,
    create: vi.fn(),
  },
}));

vi.mock("@/layouts/ModalBase", () => ({
  __esModule: true,
  default: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children?: React.ReactNode;
  }) => (isOpen ? <div>{children}</div> : null),
}));

vi.mock("@/components/RecurrenceSelector", () => ({
  __esModule: true,
  default: () => <div data-testid="recurrence-selector" />,
}));

vi.mock("@/components/forms/DateTimeSelector", () => ({
  __esModule: true,
  default: () => <div data-testid="datetime-selector" />,
}));

vi.mock("@/components/selects/TaskSelector", () => ({
  __esModule: true,
  default: () => <div data-testid="task-selector" />,
}));

vi.mock("@/components/selects/AreaSelect", () => ({
  __esModule: true,
  default: () => <div data-testid="area-select" />,
}));

vi.mock("@/hooks/queries/useAreas", () => ({
  useAreas: () => ({ areas: [] }),
}));

vi.mock("@/hooks/useModalState", () => ({
  useModalState: () => ({
    loading: false,
    error: null,
    setError: setErrorMock,
    withLoading: async (work: () => Promise<void>) => {
      await work();
    },
  }),
}));

vi.mock("@/contexts/ToastContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/contexts/ToastContext")>();
  return {
    ...actual,
    useToast: () => toastMock,
  };
});

setupTranslationMock();

const recurringInstance: PlannedEvent = {
  id: "event-1",
  title: "Recurring Review",
  start_time: "2025-08-11T08:00:00Z",
  end_time: "2025-08-11T08:30:00Z",
  priority: 0,
  area_id: "area-1",
  task_id: "task-1",
  is_all_day: false,
  is_recurring: true,
  recurrence_pattern: null,
  rrule_string: "FREQ=DAILY",
  status: "planned",
  tags: ["focus"],
  extra_data: null,
  created_at: "2025-08-10T00:00:00Z",
  updated_at: "2025-08-10T00:00:00Z",
  is_instance: true,
  master_event_id: "event-1",
  instance_id: "instance-1",
  people: [
    {
      id: "person-1",
      display_name: "Alice",
      primary_nickname: "Alice",
      tags: [],
    },
  ],
};

describe("PlannedEventModal", () => {
  beforeEach(() => {
    updateMock.mockReset();
    updateMock.mockResolvedValue({
      ...recurringInstance,
      title: "Recurring Review Updated",
    });
    setErrorMock.mockReset();
    Object.values(toastMock).forEach((fn) => fn.mockReset());
  });

  it("sends only dirty fields for recurring instance updates", async () => {
    const onSave = vi.fn();
    const { container } = renderWithProviders(
      <PlannedEventModal
        isOpen
        onClose={vi.fn()}
        onSave={onSave}
        plannedEvent={recurringInstance}
      />,
    );

    const titleInput = container.querySelector<HTMLInputElement>("#title");
    expect(titleInput).not.toBeNull();

    fireEvent.change(titleInput!, {
      target: { value: "Recurring Review Updated" },
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith(
        recurringInstance.id,
        { title: "Recurring Review Updated" },
        {
          updateType: "single",
          instanceId: recurringInstance.instance_id,
          instanceStart: recurringInstance.start_time,
        },
      );
    });
    expect(onSave).toHaveBeenCalled();
    expect(toastMock.showSuccess).toHaveBeenCalled();
  });
});
