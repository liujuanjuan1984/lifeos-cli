import { render } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

import { setupTranslationMock } from "@test/utils";
import { SelectorSpecialValue } from "@/components/selects/selectorTypes";

setupTranslationMock();

const mockAsyncSelect = vi.fn();

vi.mock("@/components/selects/AsyncEntitySelect", () => ({
  __esModule: true,
  default: React.forwardRef((props: unknown, _ref) => {
    mockAsyncSelect(props);
    return <div data-testid="task-selector" />;
  }),
}));

vi.mock("@/hooks/queries/useTasks", () => ({
  useAllTasks: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/queries/useVisions", () => ({
  useVisions: () => ({
    visions: [{ id: "vision-1", name: "Vision 1" }],
  }),
}));

vi.mock("@/services/api/tasks", () => ({
  tasksApi: {
    getById: vi.fn(),
  },
}));

let TaskSelector: typeof import("@/components/selects/TaskSelector").default;

beforeAll(async () => {
  ({ default: TaskSelector } = await import(
    "@/components/selects/TaskSelector"
  ));
});

const getTaskSelector = () => {
  if (!TaskSelector) {
    throw new Error("TaskSelector was not loaded");
  }
  return TaskSelector;
};

const preloadedTasks = [
  {
    id: "task-1",
    content: "Parent task",
    status: "todo",
    parent_id: null,
    vision_id: "vision-1",
    sort_order: 1,
  },
  {
    id: "task-2",
    content: "Child task",
    status: "todo",
    parent_id: "task-1",
    vision_id: "vision-1",
    sort_order: 2,
  },
] as never[];

describe("TaskSelector", () => {
  beforeEach(() => {
    mockAsyncSelect.mockClear();
  });

  it("builds special options and task options from preloaded tasks", () => {
    const handleChange = vi.fn();
    const Component = getTaskSelector();

    render(
      <Component
        value={null}
        onChange={handleChange}
        preloadedTasks={preloadedTasks}
        filterStatus={["todo"]}
        showSpecialOptions
        showNoTaskOption
      />,
    );

    const props = mockAsyncSelect.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    const options = props.options as Array<{ id: string; label: string }>;

    expect(options.map((option) => option.id)).toEqual([
      SelectorSpecialValue.None,
      SelectorSpecialValue.All,
      "task-1",
      "task-2",
    ]);
  });

  it("maps selection back to task ids and special values", () => {
    const handleChange = vi.fn();
    const handleTaskSelect = vi.fn();
    const Component = getTaskSelector();

    render(
      <Component
        value={null}
        onChange={handleChange}
        onTaskSelect={handleTaskSelect}
        preloadedTasks={preloadedTasks}
        filterStatus={["todo"]}
        showSpecialOptions
        showNoTaskOption
      />,
    );

    const props = mockAsyncSelect.mock.calls.at(-1)?.[0] as Record<
      string,
      unknown
    >;
    const onChange = props.onChange as (value: string) => void;

    onChange("task-1");
    expect(handleChange).toHaveBeenLastCalledWith("task-1");
    expect(handleTaskSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "task-1" }),
      expect.objectContaining({ id: "vision-1" }),
    );

    onChange(SelectorSpecialValue.None);
    expect(handleChange).toHaveBeenLastCalledWith(null);
    expect(handleTaskSelect).toHaveBeenLastCalledWith(null, undefined);
  });
});
