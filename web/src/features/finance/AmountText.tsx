type FinanceAmountTextProps = {
  amount: string;
  currencyCode?: string | null;
  value?: number | null;
  showCurrency?: boolean;
  className?: string;
};

type FinanceAmountListTextProps = {
  value: string;
  className?: string;
};

type FinanceAssetSymbolProps = {
  symbol: string;
  className?: string;
  inheritTone?: boolean;
};

const subduedTextClass = "font-normal opacity-65";

export function FinanceAmountText({
  amount,
  currencyCode,
  value,
  showCurrency = true,
  className = "",
}: FinanceAmountTextProps) {
  const text = amount.trim();
  if (!text) {
    return (
      <span className={["text-base-content/40", className].filter(Boolean).join(" ")}>-</span>
    );
  }

  const parts = splitAmountText(text);
  const numericValue = typeof value === "number" ? value : parseNumericAmount(text);
  const toneClass =
    Number.isFinite(numericValue) && numericValue < 0 ? "text-warning" : "text-base-content";
  const symbol = currencyCode?.trim().toUpperCase();

  return (
    <span
      className={[
        "inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums",
        toneClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="font-medium">
        {parts.sign}
        {parts.integer}
      </span>
      {parts.fraction ? <span className={subduedTextClass}>{parts.fraction}</span> : null}
      {showCurrency && symbol ? <FinanceAssetSymbol symbol={symbol} inheritTone /> : null}
    </span>
  );
}

export function FinanceAmountListText({ value, className = "" }: FinanceAmountListTextProps) {
  const items = parseAmountList(value);
  if (!items.length) {
    return (
      <span className={["text-base-content/40", className].filter(Boolean).join(" ")}>-</span>
    );
  }

  return (
    <span
      className={[
        "inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 tabular-nums",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {items.map((item, index) => (
        <span
          key={`${item.amount}:${item.currencyCode}:${index}`}
          className="inline-flex items-baseline gap-1"
        >
          {index > 0 ? <span className="text-base-content/40">,</span> : null}
          <FinanceAmountText amount={item.amount} currencyCode={item.currencyCode} />
        </span>
      ))}
    </span>
  );
}

export function FinanceAssetSymbol({
  symbol,
  className = "",
  inheritTone = false,
}: FinanceAssetSymbolProps) {
  return (
    <span
      className={[
        "whitespace-nowrap",
        inheritTone ? "" : "text-base-content",
        subduedTextClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {symbol.trim().toUpperCase()}
    </span>
  );
}

function splitAmountText(value: string): { sign: string; integer: string; fraction: string } {
  const normalized = value.trim();
  const sign = normalized.startsWith("-") || normalized.startsWith("+") ? normalized[0] : "";
  const unsigned = sign ? normalized.slice(1) : normalized;
  const decimalIndex = findDecimalSeparatorIndex(unsigned);
  if (decimalIndex === -1) {
    return { sign, integer: unsigned || "0", fraction: "" };
  }
  return {
    sign,
    integer: unsigned.slice(0, decimalIndex) || "0",
    fraction: unsigned.slice(decimalIndex),
  };
}

function findDecimalSeparatorIndex(value: string): number {
  const dotIndex = value.lastIndexOf(".");
  const commaIndex = value.lastIndexOf(",");
  return Math.max(dotIndex, commaIndex);
}

function parseNumericAmount(value: string): number {
  return Number(value.trim().replace(",", "."));
}

function parseAmountList(value: string): Array<{ amount: string; currencyCode: string }> {
  return value
    .split(/,\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.+?)\s+([A-Za-z][A-Za-z0-9._-]*)$/);
      if (!match) {
        return null;
      }
      return {
        amount: match[1].trim(),
        currencyCode: match[2].trim().toUpperCase(),
      };
    })
    .filter((item): item is { amount: string; currencyCode: string } => Boolean(item));
}
