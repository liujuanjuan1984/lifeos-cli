const pad = (value: number): string => value.toString().padStart(2, "0");

export const toDateInputValue = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatDateToken = (iso: string, timezone: string): string => {
  if (!iso) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date(iso));
};

export const formatTimeToken = (iso: string, timezone: string): string => {
  if (!iso) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return formatter.format(new Date(iso));
};

export const resolveBulkImportDefaultStart = (
  selectedDate: Date,
  timezone: string,
  latestTimelogEndTime?: string | null,
): { date: string; time: string } => {
  if (latestTimelogEndTime) {
    const latestEnd = new Date(latestTimelogEndTime);
    if (!Number.isNaN(latestEnd.getTime())) {
      return {
        date: formatDateToken(latestTimelogEndTime, timezone),
        time: formatTimeToken(latestTimelogEndTime, timezone),
      };
    }
  }

  return {
    date: toDateInputValue(selectedDate),
    time: "00:00",
  };
};
