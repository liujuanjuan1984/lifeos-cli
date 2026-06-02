export function formatCurrencyValue(
  value: string | number | null | undefined,
  currency: string,
  options: Intl.NumberFormatOptions = {},
): string {
  if (value === null || value === undefined || value === "") {
    return "--";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    ...options,
  }).format(numeric);
}

export function formatPercentValue(
  value: string | number | null | undefined,
  fractionDigits = 2,
): string {
  if (value === null || value === undefined || value === "") {
    return "--";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  const percent = numeric * 100;
  return `${percent.toFixed(fractionDigits)}%`;
}

export function formatDecimalValue(
  value: string | number | null | undefined,
  options: Intl.NumberFormatOptions = {},
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(numeric);
}

export function formatSignedDecimalValue(
  value: string | number | null | undefined,
  options: {
    showPlus?: boolean;
    formatOptions?: Intl.NumberFormatOptions;
  } = {},
): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options.formatOptions,
  }).format(numeric);
  if (numeric > 0 && options.showPlus !== false) {
    return `+${formatted}`;
  }
  return formatted;
}
