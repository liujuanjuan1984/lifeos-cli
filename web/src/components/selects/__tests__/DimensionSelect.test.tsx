import { render } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import type { UUID } from "@/types/primitive";
import {
  SelectorSpecialValue,
  type SelectorValue,
} from "@/components/selects/selectorTypes";

import { setupTranslationMock } from "@test/utils";

const mockAsyncSelect = vi.fn();

vi.mock("@/components/selects/AsyncEntitySelect", () => ({
  __esModule: true,
  default: React.forwardRef((props: unknown, _ref) => {
    mockAsyncSelect(props);
    return <div data-testid="dimension-select" />;
  }),
}));

vi.mock("@/hooks/queries/useDimensions", () => ({
  useDimensions: () => ({
    dimensions: [
      { id: "dim-1", name: "Health" },
      { id: "dim-2", name: "Career" },
    ],
  }),
}));

setupTranslationMock();

let DimensionSelect: typeof import("@/components/selects/DimensionSelect").default;

beforeAll(async () => {
  ({ default: DimensionSelect } = await import(
    "@/components/selects/DimensionSelect"
  ));
});

const getDimensionSelect = () => {
  if (!DimensionSelect) {
    throw new Error("DimensionSelect was not loaded");
  }
  return DimensionSelect;
};

describe("DimensionSelect", () => {
  beforeEach(() => {
    mockAsyncSelect.mockClear();
  });

  it("maps dimension data to entity options and passes through props", () => {
    const handleChange = vi.fn();
    const Component = getDimensionSelect();

    render(
      <Component
        value={"dim-1" as UUID}
        onChange={handleChange}
        className="custom"
      />,
    );

    const props = mockAsyncSelect.mock.calls[0][0] as Record<string, unknown>;
    expect(props.value).toBe("dim-1");
    expect(props.className).toBe("custom");
    expect(props.placeholder).toBe("common.please_select");
    expect(props.label).toBe("target.dimension");

    const options = props.options as Array<{ id: string; label: string }>;
    expect(options).toEqual([
      { id: "dim-1", label: "Health" },
      { id: "dim-2", label: "Career" },
    ]);

    const onChange = props.onChange as (val: SelectorValue) => void;
    onChange("dim-2");
    expect(handleChange).toHaveBeenCalledWith("dim-2");
  });

  it("handles special options and clear behavior", () => {
    const handleChange = vi.fn();
    const Component = getDimensionSelect();

    render(
      <Component
        value={null}
        onChange={handleChange}
        showAllOption
        showNoneOption
      />,
    );

    const props = mockAsyncSelect.mock.calls[0][0] as Record<string, unknown>;
    expect(props.value).toBe(SelectorSpecialValue.None);
    const onChange = props.onChange as (val: SelectorValue) => void;

    onChange(SelectorSpecialValue.All);
    expect(handleChange).toHaveBeenLastCalledWith(undefined);

    onChange(SelectorSpecialValue.None);
    expect(handleChange).toHaveBeenLastCalledWith(null);

    onChange("dim-1");
    expect(handleChange).toHaveBeenLastCalledWith("dim-1");

    onChange(undefined);
    expect(handleChange).toHaveBeenLastCalledWith(undefined);
  });

  it("supports custom clear behavior", () => {
    const asNone = vi.fn();
    const preserve = vi.fn();
    const Component = getDimensionSelect();

    render(
      <>
        <Component value={null} onChange={asNone} clearBehavior="none" />
        <Component
          value={"dim-1" as UUID}
          onChange={preserve}
          clearBehavior="preserve"
        />
      </>,
    );

    const firstProps = mockAsyncSelect.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    const secondProps = mockAsyncSelect.mock.calls[1][0] as Record<
      string,
      unknown
    >;

    (firstProps.onChange as (val: SelectorValue) => void)(undefined);
    expect(asNone).toHaveBeenCalledWith(null);

    (secondProps.onChange as (val: SelectorValue) => void)(undefined);
    expect(preserve).not.toHaveBeenCalled();
  });
});
