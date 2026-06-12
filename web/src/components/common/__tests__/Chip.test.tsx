import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import Chip from "@/components/common/Chip";

describe("Chip", () => {
  it("fires click interactions", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<Chip onClick={onClick}>Followed Tag</Chip>);

    await user.click(screen.getByRole("button", { name: /followed tag/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("fires remove interactions without bubbling to the chip click", async () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <Chip onClick={onClick} onRemove={onRemove}>
        Removable
      </Chip>,
    );

    await user.click(screen.getByRole("button", { name: /remove/i }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });
});
