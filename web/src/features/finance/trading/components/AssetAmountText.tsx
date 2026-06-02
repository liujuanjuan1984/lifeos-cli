import type { ReactNode } from "react";

interface AssetAmountTextProps {
  value: string | number | null | undefined;
  symbol?: string | null;
  fallback?: string;
  amountClassName?: string;
  symbolClassName?: string;
  wrapperClassName?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

function joinClassNames(
  ...classes: Array<string | undefined | null | false>
): string {
  return classes.filter(Boolean).join(" ");
}

function normalizeValue(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value.toString();
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function AssetAmountText({
  value,
  symbol,
  fallback = "--",
  amountClassName,
  symbolClassName,
  wrapperClassName,
  prefix,
  suffix,
}: AssetAmountTextProps) {
  const normalizedValue = normalizeValue(value);
  const normalizedSymbol = symbol?.trim() ?? "";
  const content = normalizedValue ?? fallback;
  const showSymbol = Boolean(normalizedSymbol) && normalizedValue !== null;

  return (
    <span
      className={joinClassNames(
        "inline-flex items-baseline gap-1 whitespace-nowrap",
        wrapperClassName,
      )}
    >
      {prefix}
      <span className={joinClassNames("font-mono", amountClassName)}>
        {content}
      </span>
      {showSymbol ? (
        <span
          className={joinClassNames(
            "text-xs text-base-content/60 font-normal tracking-wide",
            symbolClassName,
          )}
        >
          {normalizedSymbol}
        </span>
      ) : null}
      {suffix}
    </span>
  );
}
