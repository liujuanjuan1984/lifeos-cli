import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import { setupTranslationMock } from "@test/utils";

setupTranslationMock();

let CheckboxGroup: typeof import("@/components/forms/CheckboxGroup").default;

beforeAll(async () => {
  ({ default: CheckboxGroup } = await import(
    "@/components/forms/CheckboxGroup"
  ));
});

const getCheckboxGroup = () => {
  if (!CheckboxGroup) {
    throw new Error("CheckboxGroup was not loaded");
  }
  return CheckboxGroup;
};

describe("CheckboxGroup", () => {
  const baseOptions = [
    { value: "alpha", label: "Alpha" },
    { value: "beta", label: "Beta" },
    { value: "gamma", label: "Gamma" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders legend, description and error state", () => {
    const Component = getCheckboxGroup();

    render(
      <Component
        label="Notification channels"
        description="Choose at least one"
        error="Select an option"
        required
        value={["beta"]}
        options={baseOptions}
      />,
    );

    expect(screen.getByText("Notification channels")).toBeInTheDocument();
    expect(screen.getByText("Choose at least one")).toBeInTheDocument();
    expect(screen.getByText("Select an option")).toBeInTheDocument();
    const fieldset = screen.getByRole("group", {
      name: /notification channels/i,
    });
    expect(fieldset).toHaveAttribute("aria-invalid", "true");
  });

  it("calls onChange when toggling options", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const Component = getCheckboxGroup();

    const Controlled = () => {
      const [selected, setSelected] = useState<string[]>([]);
      return (
        <Component
          value={selected}
          options={baseOptions}
          onChange={(values) => {
            setSelected(values);
            onChange(values);
          }}
          label="Options"
        />
      );
    };

    render(<Controlled />);

    const alpha = screen.getByLabelText("Alpha");
    await user.click(alpha);
    expect(onChange).toHaveBeenCalledWith(["alpha"]);

    const beta = screen.getByLabelText("Beta");
    await user.click(beta);
    expect(onChange).toHaveBeenLastCalledWith(["alpha", "beta"]);
  });

  it("supports select-all controls", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const Component = getCheckboxGroup();

    const Controlled = () => {
      const [selected, setSelected] = useState<string[]>(["alpha"]);
      return (
        <Component
          value={selected}
          options={baseOptions}
          onChange={(values) => {
            setSelected(values);
            onChange(values);
          }}
          showSelectAll
          label="Options"
        />
      );
    };

    render(<Controlled />);

    const selectAllCheckbox = screen.getByRole("checkbox", {
      name: /checkboxGroup\.selectAll/i,
    });
    await user.click(selectAllCheckbox);
    expect(onChange).toHaveBeenCalledWith(["alpha", "beta", "gamma"]);

    await user.click(selectAllCheckbox);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("excludes disabled options from select-all mutations", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const Component = getCheckboxGroup();
    const options = [
      { value: "alpha", label: "Alpha" },
      { value: "beta", label: "Beta", disabled: true },
      { value: "gamma", label: "Gamma" },
    ];

    const Controlled = () => {
      const [selected, setSelected] = useState<string[]>(["beta"]);
      return (
        <Component
          value={selected}
          options={options}
          onChange={(values) => {
            setSelected(values);
            onChange(values);
          }}
          showSelectAll
          label="Options"
        />
      );
    };

    render(<Controlled />);

    const selectAllCheckbox = screen.getByRole("checkbox", {
      name: /checkboxGroup\.selectAll/i,
    });
    await user.click(selectAllCheckbox);
    expect(onChange).toHaveBeenCalledWith(["beta", "alpha", "gamma"]);

    await user.click(selectAllCheckbox);
    expect(onChange).toHaveBeenLastCalledWith(["beta"]);
  });

  it("respects readOnly mode", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const Component = getCheckboxGroup();

    render(
      <Component
        value={["alpha"]}
        options={baseOptions}
        onChange={onChange}
        readOnly
        showSelectAll
        label="Options"
      />,
    );

    const alpha = screen.getByLabelText("Alpha");
    await user.click(alpha);
    expect(onChange).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/checkboxGroup\.selectAll/i),
    ).not.toBeInTheDocument();
  });
});
