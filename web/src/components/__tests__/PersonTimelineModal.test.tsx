import type React from "react";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PersonTimelineModal from "@/components/PersonTimelineModal";
import type { PersonSummary } from "@/services/api";
import type { PersonActivityItem } from "@/services/api/persons";
import { renderWithProviders, setupTranslationMock } from "@test/utils";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 120,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 120,
        size: 120,
      })),
    measureElement: vi.fn(),
  }),
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
    title,
    children,
  }: {
    isOpen: boolean;
    title?: React.ReactNode;
    children?: React.ReactNode;
  }) =>
    isOpen ? (
      <div>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

setupTranslationMock({
  translator: (key, options) => {
    const translations: Record<string, string> = {
      "persons.timeline.title": `${(options as { name?: string })?.name} 的活动时间线`,
      "persons.timeline.activityCount": `（${(options as { count?: number })?.count} 项活动）`,
      "persons.activityTypes.timelog": "时间日志",
      "taskTimelogs.unknownArea": "未分配领域",
      "common.all": "全部",
      "persons.activityTypes.note": "快速笔记",
      "persons.activityTypes.task": "任务",
      "persons.activityTypes.planned_event": "日程安排",
      "persons.activityTypes.vision": "愿景管理",
    };
    return translations[key] ?? key;
  },
});

const person = {
  id: "person-1",
  name: "Ada",
  display_name: "Ada",
} as unknown as PersonSummary;

const activity: PersonActivityItem = {
  id: "timelog-1",
  type: "timelog",
  title: "Deep work",
  description: null,
  date: "2026-07-02T09:00:00.000Z",
  status: "manual",
  start_time: "2026-07-02T09:00:00.000Z",
  end_time: "2026-07-02T09:30:00.000Z",
  area_id: "area-1",
};

describe("PersonTimelineModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders timelog activity details without the manual tracking method", () => {
    renderWithProviders(
      <PersonTimelineModal
        person={person}
        isOpen
        onClose={vi.fn()}
        activities={[activity]}
        total={1}
        totalPages={1}
        isLoadingActivities={false}
        isFetchingActivities={false}
        page={1}
        onPageChange={vi.fn()}
        activityType="timelog"
        onActivityTypeChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText("时间日志").length).toBeGreaterThan(0);
    expect(screen.getByText("2026-07-02")).toBeInTheDocument();
    expect(screen.getByText("17:00-17:30")).toBeInTheDocument();
    expect(screen.getByText("30m")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Deep work")).toBeInTheDocument();
    expect(screen.queryByText("manual")).not.toBeInTheDocument();
  });

  it("does not render duplicate note content when title and description match", () => {
    renderWithProviders(
      <PersonTimelineModal
        person={person}
        isOpen
        onClose={vi.fn()}
        activities={[
          {
            id: "note-1",
            type: "note",
            title: "Remember the meeting notes",
            description: "Remember the meeting notes",
            date: "2026-07-02T09:00:00.000Z",
            status: null,
          },
        ]}
        total={1}
        totalPages={1}
        isLoadingActivities={false}
        isFetchingActivities={false}
        page={1}
        onPageChange={vi.fn()}
        activityType="note"
        onActivityTypeChange={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Remember the meeting notes")).toHaveLength(1);
  });
});
