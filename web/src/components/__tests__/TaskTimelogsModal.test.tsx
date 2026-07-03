import type React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import TaskTimelogsModal from "@/components/TaskTimelogsModal";
import type { TaskWithSubtasks } from "@/services/api";
import { renderWithProviders, setupTranslationMock } from "@test/utils";

const { useTaskTimelogsMock } = vi.hoisted(() => ({
  useTaskTimelogsMock: vi.fn(),
}));

vi.mock("@/hooks/queries/useTaskTimelogs", () => ({
  useTaskTimelogs: useTaskTimelogsMock,
}));

vi.mock("@/hooks/queries/useAreas", () => ({
  useAreas: () => ({
    areaMap: new Map([["area-1", { name: "Work", color: "#3B82F6" }]]),
  }),
}));

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
    header,
    children,
  }: {
    isOpen: boolean;
    header?: React.ReactNode;
    children?: React.ReactNode;
  }) =>
    isOpen ? (
      <div>
        <h2>{header}</h2>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/components/TimeRangeText", () => ({
  __esModule: true,
  default: () => <span data-testid="time-range">17:00-17:30</span>,
}));

vi.mock("@/components/icons", () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

setupTranslationMock({
  translator: (key, options) => {
    const translations: Record<string, string> = {
      "taskTimelogs.title": "时间日志",
      "taskTimelogs.taskLabel": "任务：",
      "taskTimelogs.totalTime": "总计",
      "taskTimelogs.minutes": "分钟",
      "taskTimelogs.hours": "小时",
      "taskTimelogs.recordsCount": `${(options as { count?: number })?.count} 条记录`,
      "taskTimelogs.previousPage": "上一页",
      "taskTimelogs.nextPage": "下一页",
      "taskTimelogs.pageIndicator": `第 ${(options as { page?: number })?.page} / ${(options as { total?: number })?.total} 页`,
      "taskTimelogs.unknownArea": "未分配领域",
      "taskTimelogs.columns.date": "日期",
      "taskTimelogs.columns.timeRange": "时间段",
      "taskTimelogs.columns.duration": "时长",
      "taskTimelogs.columns.area": "领域",
      "taskTimelogs.columns.description": "行为描述",
    };
    return translations[key] ?? key;
  },
});

const buildTask = (): TaskWithSubtasks =>
  ({
    id: "task-1",
    content: "Review task logs",
    actual_effort_self: 30,
    subtasks: [],
  }) as unknown as TaskWithSubtasks;

describe("TaskTimelogsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTaskTimelogsMock.mockReturnValue({
      data: {
        items: [
          {
            id: "timelog-1",
            title: "Deep work",
            start_time: "2026-07-02T09:00:00.000Z",
            end_time: "2026-07-02T09:30:00.000Z",
            area_id: "area-1",
            area_summary: { id: "area-1", name: null, color: null },
            tracking_method: "manual",
            created_at: "2026-07-02T09:30:00.000Z",
            updated_at: "2026-07-02T09:30:00.000Z",
          },
        ],
        pagination: { page: 1, size: 50, total: 101, pages: 3 },
        meta: {},
      },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("renders paginated task time logs with resolved area names and no time icon", () => {
    renderWithProviders(
      <TaskTimelogsModal
        isOpen
        onClose={vi.fn()}
        task={buildTask()}
      />,
    );

    expect(useTaskTimelogsMock).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ page: 1, size: 15 }),
    );
    expect(screen.getAllByText("时间日志").length).toBeGreaterThan(0);
    expect(screen.getByText("101 条记录")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Deep work")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-timer")).not.toBeInTheDocument();
    expect(screen.getByTestId("task-timelogs-scroll-area")).not.toContainElement(
      screen.getByRole("button", { name: "下一页" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));

    expect(useTaskTimelogsMock).toHaveBeenLastCalledWith(
      "task-1",
      expect.objectContaining({ page: 2, size: 15 }),
    );
  });
});
