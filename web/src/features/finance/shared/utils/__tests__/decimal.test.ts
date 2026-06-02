import { describe, expect, it } from "vitest";

import {
  formatScaledDecimal,
  isNegativeDecimal,
  multiplyDecimalStrings,
  parseDecimalToScaled,
  sumDecimalStrings,
} from "@/features/finance/shared/utils/decimal";

describe("decimal utils", () => {
  it("parses decimal strings into scaled bigints", () => {
    expect(parseDecimalToScaled("1.23")).toBe(123000000n);
    expect(parseDecimalToScaled("-0.5")).toBe(-50000000n);
  });

  it("rejects invalid decimal input", () => {
    expect(parseDecimalToScaled("")).toBeNull();
    expect(parseDecimalToScaled("-")).toBeNull();
    expect(parseDecimalToScaled("abc")).toBeNull();
  });

  it("formats scaled bigints into decimal strings", () => {
    expect(formatScaledDecimal(123000000n)).toBe("1.23");
    expect(formatScaledDecimal(100000000n)).toBe("1");
    expect(formatScaledDecimal(-50000000n)).toBe("-0.5");
  });

  it("multiplies decimal strings with rounding", () => {
    expect(multiplyDecimalStrings("1.5", "2")).toBe("3");
    expect(multiplyDecimalStrings("2", "-0.5")).toBe("-0.99999999");
    expect(multiplyDecimalStrings("", "2")).toBeNull();
  });

  it("sums decimal strings and reports presence", () => {
    expect(sumDecimalStrings(["1.1", "2.2"]).sum).toBe("3.3");
    expect(sumDecimalStrings(["1.1", "2.2"]).hasValue).toBe(true);
    expect(sumDecimalStrings([undefined]).hasValue).toBe(false);
  });

  it("detects negative decimal values", () => {
    expect(isNegativeDecimal("-1")).toBe(true);
    expect(isNegativeDecimal(" -0.1 ")).toBe(true);
    expect(isNegativeDecimal("0")).toBe(false);
    expect(isNegativeDecimal("")).toBe(false);
    expect(isNegativeDecimal(null)).toBe(false);
  });
});
