const FALLBACK_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

const dtfCache = new Map<string, Intl.DateTimeFormat>();
const PREFERRED_TIMEZONE_STORAGE_KEY = "cc_preferred_timezone";
let preferredTimezoneCache: string | null = null;

function getPreferredTimezone(): string | null {
  if (preferredTimezoneCache) {
    return preferredTimezoneCache;
  }
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(PREFERRED_TIMEZONE_STORAGE_KEY);
    if (stored && isValidTimezone(stored)) {
      preferredTimezoneCache = stored;
      return stored;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function setPreferredTimezone(value?: string | null): void {
  if (!value || !isValidTimezone(value)) return;
  preferredTimezoneCache = value;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERRED_TIMEZONE_STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function resolvePreferredTimezone(preferred?: string | null): string {
  if (preferred && isValidTimezone(preferred)) {
    return preferred;
  }
  const cached = getPreferredTimezone();
  return cached ?? "UTC";
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dtfCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(timeZone, formatter);
  }
  return formatter;
}

function getTimeZoneOffset(date: Date, timeZone: string): number {
  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }
  const asUTC = Date.UTC(
    values.year,
    (values.month || 1) - 1,
    values.day || 1,
    values.hour || 0,
    values.minute || 0,
    values.second || 0,
    date.getUTCMilliseconds(),
  );
  return asUTC - date.getTime();
}

export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string,
): Date {
  const utcReference = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second, millisecond),
  );
  const offset = getTimeZoneOffset(utcReference, timeZone);
  return new Date(utcReference.getTime() - offset);
}

function isValidTimezone(value?: string | null): boolean {
  if (!value || !value.trim()) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeTimezone(preferred?: string | null): string {
  if (preferred && isValidTimezone(preferred)) {
    return preferred;
  }
  if (preferred) {
    const compact = preferred.replace(/\s+/g, "_");
    if (isValidTimezone(compact)) {
      return compact;
    }
  }
  return resolvePreferredTimezone();
}

export function getAvailableTimezones(): string[] {
  try {
    type SupportedValuesOfFn = (key: string) => string[];
    const supportedValuesOf = (
      Intl as { supportedValuesOf?: SupportedValuesOfFn }
    ).supportedValuesOf;
    if (typeof supportedValuesOf === "function") {
      const values = supportedValuesOf("timeZone");
      if (Array.isArray(values) && values.length > 0) {
        return values;
      }
    }
  } catch {
    /* ignore */
  }
  return FALLBACK_TIMEZONES;
}
