import React from "react";
import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type InlineQuickTimeEntryComponent from "@/components/InlineQuickTimeEntry";
import type { TaskWithSubtasks } from "@/services/api";
import { tasksApi } from "@/services/api/tasks";
import { renderWithProviders, setupTranslationMock } from "@test/utils";

type InlineQuickProps = React.ComponentProps<
  typeof InlineQuickTimeEntryComponent
>;

const inlinePropsRef: { current: InlineQuickProps | null } = { current: null };

setupTranslationMock();

vi.mock("@/hooks/queries/usePreferenceWithBootstrap", () => ({
  usePreferenceWithBootstrap: vi.fn((opts: { defaultValue: unknown }) => ({
    value:
      typeof opts.defaultValue === "string" ? "Asia/Shanghai" : opts.defaultValue,
    loading: false,
    error: null,
  })),
}));

vi.mock("@/layouts/ModalBase", () => ({
  __esModule: true,
  default: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children?: React.ReactNode;
  }) => (isOpen ? <div data-testid="modal">{children}</div> : null),
}));

vi.mock("@/components/InlineQuickTimeEntry", () => {
  const MockInlineQuick: React.FC<InlineQuickProps> = (props) => {
    inlinePropsRef.current = props;
    return <div data-testid="inline-entry" />;
  };
  return { __esModule: true, default: MockInlineQuick };
});

import TaskTimelogQuickAddModal from "@/components/TaskTimelogQuickAddModal";

const buildTask = (): TaskWithSubtasks =>
  ({
    id: "task-1",
    content: "Review timezone handling",
    subtasks: [],
  }) as unknown as TaskWithSubtasks;

describe("TaskTimelogQuickAddModal", () => {
  beforeEach(() => {
    inlinePropsRef.current = null;
    vi.restoreAllMocks();
  });

  it("prefills the start time from the latest task timelog and leaves the end time blank", async () => {
    vi.spyOn(tasksApi, "getTimelogs").mockResolvedValue({
      items: [
        {
          id: "timelog-1",
          title: "Previous task work",
          start_time: "2026-07-02T08:30:00.000Z",
          end_time: "2026-07-02T09:00:00.000Z",
          area_id: null,
          tracking_method: "manual",
          created_at: "2026-07-02T09:00:00.000Z",
          updated_at: "2026-07-02T09:00:00.000Z",
        },
      ],
      pagination: { page: 1, size: 1, total: 1, pages: 1 },
      meta: {},
    } as Awaited<ReturnType<typeof tasksApi.getTimelogs>>);

    renderWithProviders(
      <TaskTimelogQuickAddModal
        isOpen
        task={buildTask()}
        onClose={vi.fn()}
        onTimelogCreated={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(inlinePropsRef.current).not.toBeNull();
    });

    expect(inlinePropsRef.current?.startTime).toBe("17:00");
    expect(inlinePropsRef.current?.endTime).toBe("");
    expect(inlinePropsRef.current?.blankInitialEndTime).toBe(true);
  });
});
