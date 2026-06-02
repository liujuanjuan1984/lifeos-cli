import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";

describe("MarkdownRenderer", () => {
  it("renders basic markdown content", () => {
    render(<MarkdownRenderer content="**Hello** _world_" />);

    expect(
      screen.getByText("Hello", { selector: "strong" }),
    ).toBeInTheDocument();
    expect(screen.getByText("world", { selector: "em" })).toBeInTheDocument();
  });

  it("renders fenced code blocks", () => {
    const codeSample = "```ts\nconst answer = 42;\n```";
    const { container } = render(<MarkdownRenderer content={codeSample} />);

    const codeElement = container.querySelector("pre code");
    expect(codeElement).not.toBeNull();
    expect(codeElement?.textContent).toContain("const answer = 42;");
  });

  it("sanitizes disallowed html", () => {
    const { container } = render(
      <MarkdownRenderer content={'Click<script>alert("xss")</script>'} />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(
      screen.getByText((text) => text.startsWith("Click")),
    ).toBeInTheDocument();
  });
});
