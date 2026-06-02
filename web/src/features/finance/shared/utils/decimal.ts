const DECIMAL_SCALE = 8n;
const DECIMAL_SCALE_BASE = 10n ** DECIMAL_SCALE;
const HALF_SCALE_BASE = DECIMAL_SCALE_BASE / 2n;
const DECIMAL_INPUT_REGEX = /^-?\d*(?:[.,]\d*)?$/;

export function parseDecimalToScaled(
  value: string | undefined | null,
): bigint | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(",", ".");
  if (!DECIMAL_INPUT_REGEX.test(normalized)) {
    return null;
  }
  if (normalized === "-" || normalized === "." || normalized === "-.") {
    return null;
  }

  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [integerPartRaw, fractionalRaw = ""] = unsigned.split(".");
  const integerPart = integerPartRaw || "0";
  const fractional = (fractionalRaw + "00000000").slice(0, 8);

  const scaledInteger = BigInt(integerPart);
  const scaledFraction = BigInt(fractional || "0");
  const scaled = scaledInteger * DECIMAL_SCALE_BASE + scaledFraction;

  return negative ? -scaled : scaled;
}

export function formatScaledDecimal(value: bigint): string {
  const negative = value < 0;
  const absolute = negative ? -value : value;
  const integerPart = absolute / DECIMAL_SCALE_BASE;
  let fractionalPart = (absolute % DECIMAL_SCALE_BASE)
    .toString()
    .padStart(Number(DECIMAL_SCALE), "0");

  while (fractionalPart.length > 0 && fractionalPart.endsWith("0")) {
    fractionalPart = fractionalPart.slice(0, -1);
  }

  const formatted = fractionalPart
    ? `${integerPart.toString()}.${fractionalPart}`
    : integerPart.toString();
  return negative ? `-${formatted}` : formatted;
}

export function multiplyDecimalStrings(
  a: string | undefined | null,
  b: string | undefined | null,
): string | null {
  const aScaled = parseDecimalToScaled(a);
  const bScaled = parseDecimalToScaled(b);
  if (aScaled === null || bScaled === null) {
    return null;
  }

  const product = aScaled * bScaled;
  const scaled = (product + HALF_SCALE_BASE) / DECIMAL_SCALE_BASE;
  return formatScaledDecimal(scaled);
}

export function sumDecimalStrings(values: Array<string | undefined>): {
  sum: string;
  hasValue: boolean;
} {
  let total = 0n;
  let hasValue = false;
  values.forEach((value) => {
    const scaled = parseDecimalToScaled(value);
    if (scaled !== null) {
      total += scaled;
      hasValue = true;
    }
  });

  if (!hasValue) {
    return { sum: "", hasValue: false };
  }

  return { sum: formatScaledDecimal(total), hasValue: true };
}

export function isNegativeDecimal(value?: string | null): boolean {
  if (!value) {
    return false;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return trimmed.startsWith("-");
}
