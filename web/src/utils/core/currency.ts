const CURRENCY_CODE_PATTERN = /^[A-Z0-9._-]{1,16}$/;

export function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isCurrencyCode(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const normalized = normalizeCurrencyCode(value);
  return CURRENCY_CODE_PATTERN.test(normalized);
}

export function coerceCurrencyCode(value: unknown, fallback: string): string {
  if (!isCurrencyCode(value)) {
    return normalizeCurrencyCode(fallback);
  }
  return normalizeCurrencyCode(value);
}
