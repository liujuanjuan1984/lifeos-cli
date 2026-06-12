import React from "react";
import { act, screen, waitFor } from "@testing-library/react";
import { describe, beforeEach, it, expect, vi } from "vitest";
import type InlineQuickTimeEntryComponent from "@/components/InlineQuickTimeEntry";
import TimeEntriesTable from "@/components/TimeEntriesTable";
import type { ProcessedEntry } from "@/utils/datetime";
import type { UUID } from "@/types/primitive";
import type {
  TaskWithSubtasks,
  ActualEventWithEnergyResponse,
} from "@/services/api";
import { renderWithProviders } from "@test/utils";

type InlineQuickProps = React.ComponentProps<
  typeof InlineQuickTimeEntryComponent
>;

const inlinePropsRef: { current: InlineQuickProps | null } = { current: null };

vi.mock("@/components/InlineQuickTimeEntry", () => {
  const MockInlineQuick: React.FC<InlineQuickProps> = (props) => {
    inlinePropsRef.current = props;
    return <div data-testid="inline-entry" />;
  };
  return { __esModule: true, default: MockInlineQuick };
});

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => `test-session-${Math.random().toString(16).slice(2)}`,
    },
  });
}

const baseDate = new Date("2025-12-25T08:00:00.000Z");

const buildPlaceholderEntry = (): ProcessedEntry => ({
  id: "placeholder" as UUID,
  title: "未记录",
  start_time: baseDate.toISOString(),
  end_time: new Date(baseDate.getTime() + 60 * 60 * 1000).toISOString(),
  dimension_id: null,
  tracking_method: "manual",
  created_at: baseDate.toISOString(),
  updated_at: baseDate.toISOString(),
  persons: [],
  tags: [],
  extra_data: null,
  task: null,
  linked_notes: [],
  linked_notes_count: 0,
  isPlaceholder: true,
});

const renderTable = (
  overrides?: Partial<React.ComponentProps<typeof TimeEntriesTable>>,
) => {
  inlinePropsRef.current = null;
  const defaultProps: React.ComponentProps<typeof TimeEntriesTable> = {
    entries: [buildPlaceholderEntry()],
    isLoading: false,
    isSelectMode: false,
    selectedEntryIds: new Set<UUID>(),
    onSelectChange: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onPlaceholderClick: vi.fn(),
    onEntrySaved: vi.fn(),
    sortOrder: "asc",
    onSortChange: vi.fn(),
    selectedDate: baseDate,
    queryMode: "single",
    dimensionMap: new Map(),
    preloadedTasks: [] as TaskWithSubtasks[],
    disableQuickEntry: false,
    selectedDimensionId: null,
    onDimensionChange: vi.fn(),
    onCreateNoteForEntry: vi.fn(),
    onViewNotesForEntry: vi.fn(),
  };

  const merged = { ...defaultProps, ...overrides };
  renderWithProviders(<TimeEntriesTable {...merged} />);
  return merged;
};

describe("TimeEntriesTable inline entry sessions", () => {
  beforeEach(() => {
    inlinePropsRef.current = null;
  });

  it("仅在 session 匹配时才触发 onEntrySaved", async () => {
    const onEntrySaved = vi.fn();
    renderTable({ onEntrySaved });

    await waitFor(() => {
      expect(inlinePropsRef.current).not.toBeNull();
    });

    const inlineProps = inlinePropsRef.current as InlineQuickProps;
    const sessionId = inlineProps.sessionId;
    const fakeEntry = {
      id: "evt" as UUID,
      title: "entry",
      start_time: baseDate.toISOString(),
      end_time: baseDate.toISOString(),
      dimension_id: null,
      tracking_method: "manual",
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
      persons: [],
    } as unknown as ActualEventWithEnergyResponse;

    await act(async () => {
      inlineProps.onEntryCreated(fakeEntry, { sessionId: "stale-session" });
    });
    expect(onEntrySaved).not.toHaveBeenCalled();

    await act(async () => {
      inlineProps.onEntryCreated(fakeEntry, { sessionId });
    });
    await waitFor(() => {
      expect(onEntrySaved).toHaveBeenCalledTimes(1);
    });
  });

  it("忽略来自旧 session 的取消请求", async () => {
    renderTable();

    await waitFor(() => {
      expect(screen.getByTestId("inline-entry")).toBeInTheDocument();
      expect(inlinePropsRef.current).not.toBeNull();
    });

    const inlineProps = inlinePropsRef.current as InlineQuickProps;
    const sessionId = inlineProps.sessionId;

    act(() => {
      inlineProps.onCancel?.({ sessionId: "other" });
    });
    expect(screen.getByTestId("inline-entry")).toBeInTheDocument();

    act(() => {
      inlineProps.onCancel?.({ sessionId });
    });
    await waitFor(() => {
      expect(screen.queryByTestId("inline-entry")).toBeNull();
    });
  });
});
