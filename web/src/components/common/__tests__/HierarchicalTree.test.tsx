import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  TreeDisclosure,
  TreeNodeControl,
  TreeRowSurface,
} from "@/components/common/HierarchicalTree";

describe("TreeDisclosure", () => {
  it("renders an accessible expand button for expandable rows", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <TreeDisclosure
        hasChildren
        isExpanded={false}
        expandedLabel="Collapse node"
        collapsedLabel="Expand node"
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole("button", { name: "Expand node" });

    expect(button).toHaveAttribute("aria-expanded", "false");

    await user.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders a stable non-interactive leaf placeholder", () => {
    render(
      <TreeDisclosure
        hasChildren={false}
        isExpanded={false}
        expandedLabel="Collapse node"
        collapsedLabel="Expand node"
        leafIndicator="bullet"
      />,
    );

    expect(screen.getByText("•")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("TreeRowSurface", () => {
  it("applies shared hover and aggregate styles to table rows", () => {
    render(
      <table>
        <tbody>
          <TreeRowSurface as="tr" layout="table" tone="aggregate">
            <td>Net worth</td>
          </TreeRowSurface>
        </tbody>
      </table>,
    );

    const row = screen.getByRole("row", { name: "Net worth" });

    expect(row).toHaveClass("group/tree-row");
    expect(row).toHaveClass("hover:bg-primary/10");
    expect(row).toHaveClass("bg-base-300/70");
  });
});

describe("TreeNodeControl", () => {
  it("renders one guide line for each visible depth level", () => {
    render(
      <TreeNodeControl
        depth={3}
        hasChildren={false}
        isExpanded={false}
        expandedLabel="Collapse node"
        collapsedLabel="Expand node"
      >
        <span>Cash</span>
      </TreeNodeControl>,
    );

    const container = screen.getByText("Cash").parentElement;

    expect(container?.parentElement?.querySelectorAll(".border-l")).toHaveLength(3);
  });

  it("can defer guide lines to the surrounding tree layout", () => {
    render(
      <TreeNodeControl
        depth={3}
        hasChildren={false}
        isExpanded={false}
        expandedLabel="Collapse node"
        collapsedLabel="Expand node"
        showGuideLines={false}
      >
        <span>Cash</span>
      </TreeNodeControl>,
    );

    const container = screen.getByText("Cash").parentElement;

    expect(container?.parentElement?.querySelectorAll(".border-l")).toHaveLength(0);
  });
});
