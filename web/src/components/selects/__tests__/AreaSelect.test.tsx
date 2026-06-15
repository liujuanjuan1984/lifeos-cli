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
    return <div data-testid="area-select" />;
  }),
}));

vi.mock("@/hooks/queries/useAreas", () => ({
  useAreas: () => ({
    areas: [
      { id: "area-1", name: "Health" },
      { id: "area-2", name: "Career" },
    ],
  }),
}));

setupTranslationMock();

let AreaSelect: typeof import("@/components/selects/AreaSelect").default;

beforeAll(async () => {
  ({ default: AreaSelect } = await import(
    "@/components/selects/AreaSelect"
  ));
});

const getAreaSelect = () => {
  if (!AreaSelect) {
    throw new Error("AreaSelect was not loaded");
  }
  return AreaSelect;
};

describe("AreaSelect", () => {
  beforeEach(() => {
    mockAsyncSelect.mockClear();
  });

  it("maps area data to entity options and passes through props", () => {
    const handleChange = vi.fn();
    const Component = getAreaSelect();

    render(
      <Component
        value={"area-1" as UUID}
        onChange={handleChange}
        className="custom"
      />,
    );

    const props = mockAsyncSelect.mock.calls[0][0] as Record<string, unknown>;
    expect(props.value).toBe("area-1");
    expect(props.className).toBe("custom");
    expect(props.placeholder).toBe("common.please_select");
    expect(props.label).toBe("target.area");

    const options = props.options as Array<{ id: string; label: string }>;
    expect(options).toEqual([
      { id: "area-1", label: "Health" },
      { id: "area-2", label: "Career" },
    ]);

    const onChange = props.onChange as (val: SelectorValue) => void;
    onChange("area-2");
    expect(handleChange).toHaveBeenCalledWith("area-2");
  });

  it("handles special options and clear behavior", () => {
    const handleChange = vi.fn();
    const Component = getAreaSelect();

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

    onChange("area-1");
    expect(handleChange).toHaveBeenLastCalledWith("area-1");

    onChange(undefined);
    expect(handleChange).toHaveBeenLastCalledWith(undefined);
  });

  it("supports custom clear behavior", () => {
    const asNone = vi.fn();
    const preserve = vi.fn();
    const Component = getAreaSelect();

    render(
      <>
        <Component value={null} onChange={asNone} clearBehavior="none" />
        <Component
          value={"area-1" as UUID}
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
