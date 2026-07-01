import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FinanceAmountListText, FinanceAmountText } from "@/features/finance/AmountText";

describe("FinanceAmountText", () => {
  it("keeps the full numeric text visually continuous and subdues only symbols", () => {
    render(<FinanceAmountText amount="123.4500" currencyCode="USD" />);

    expect(screen.getByText("123.4500").className).toContain("font-medium");
    expect(screen.queryByText(".4500")).toBeNull();
    expect(screen.getByText("USD").className).toContain("opacity-65");
    expect(screen.getByText("123.4500").parentElement?.className).toContain(
      "text-base-content",
    );
    expect(screen.getByText("123.4500").parentElement?.className).not.toContain("text-warning");
  });

  it("uses warning text color for negative values", () => {
    render(<FinanceAmountText amount="-42.50" currencyCode="CNY" />);

    expect(screen.getByText("-42.50").parentElement?.className).toContain("text-warning");
    expect(screen.getByText("CNY").className).not.toContain("text-base-content");
  });
});

describe("FinanceAmountListText", () => {
  it("renders comma-separated finance amount pairs with the shared amount style", () => {
    render(<FinanceAmountListText value="10.00 USD, -2.50 BTC" />);

    const usd = screen.getByText("USD");
    const btc = screen.getByText("BTC");

    expect(within(usd.parentElement as HTMLElement).getByText("10.00").className).toContain(
      "font-medium",
    );
    expect(
      within(btc.parentElement as HTMLElement).getByText("-2.50").parentElement?.className,
    ).toContain("text-warning");
  });
});
