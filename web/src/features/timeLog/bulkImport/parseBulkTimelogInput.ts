const MINUTES_PER_DAY = 24 * 60;
const RANGE_SEPARATOR_REGEX = /[~～\-–—﹣－˗‒﹘﹣⎯]/;

interface BulkImportParseOptions {
  startDate: Date;
  defaultFirstStartTime?: string;
  maxDays?: number;
  maxEntries?: number;
}

type BulkImportSourceType = "range" | "endOnly";

export type BulkImportRowErrorCode =
  | "line_unrecognized"
  | "missing_description"
  | "start_missing"
  | "start_invalid"
  | "end_invalid"
  | "time_parse_failure"
  | "cross_day_limit"
  | "duration_invalid";

export type BulkImportWarningCode =
  | "auto_shift_start"
  | "auto_cross_midnight_end"
  | "auto_cross_midnight_range";

export type BulkImportGlobalErrorCode = "too_many_lines";

export interface BulkImportMessage {
  code:
    | BulkImportRowErrorCode
    | BulkImportWarningCode
    | BulkImportGlobalErrorCode;
  meta?: Record<string, string | number>;
}

export interface BulkImportRow {
  id: string;
  sourceLineNumber: number;
  rawText: string;
  date: string;
  startTime: string;
  endDate: string;
  endTime: string;
  description: string;
  dimensionId: string | null;
  taskId: string | null;
  personIds: string[];
  notes: string;
  energyLevel: number | null;
  sourceType: BulkImportSourceType;
  errors: BulkImportMessage[];
  warnings: BulkImportMessage[];
  autoInferredStart: boolean;
}

interface BulkImportParseResult {
  rows: BulkImportRow[];
  globalErrors: BulkImportMessage[];
}

interface ParsedLine {
  type: BulkImportSourceType;
  startToken?: string;
  endToken: string;
  description: string;
}

const DEFAULT_FIRST_START = "00:00";
export const BULK_IMPORT_MAX_DAYS = 3;
export const BULK_IMPORT_MAX_ENTRIES = 500;

const FULL_WIDTH_SPACE = /[\u3000]/g;
const FULL_WIDTH_COLON = /[：﹕︰﹕﹕]/g;
const FULL_WIDTH_HYPHEN = /[－﹣－﹘–—~～]/g;

const pad = (value: number): string => value.toString().padStart(2, "0");

const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

const normalizeLine = (line: string): string =>
  line
    .replace(FULL_WIDTH_SPACE, " ")
    .replace(FULL_WIDTH_COLON, ":")
    .replace(FULL_WIDTH_HYPHEN, "-")
    .replace(/\s+/g, " ")
    .trim();

const normalizeSeparator = (text: string): string =>
  text.replace(RANGE_SEPARATOR_REGEX, "-");

const sanitizeTimeToken = (token: string): string =>
  token.replace(/[^0-9:]/g, "");

const parseTimeToken = (token: string | undefined): number | null => {
  if (!token) return null;
  const normalized = sanitizeTimeToken(token);
  if (!normalized) return null;

  if (normalized.includes(":")) {
    const [hRaw, mRaw = "0"] = normalized.split(":");
    const hours = Number(hRaw);
    const minutes = Number(mRaw.padEnd(2, "0"));
    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      minutes < 0 ||
      minutes >= 60 ||
      hours < 0
    ) {
      return null;
    }
    return hours * 60 + minutes;
  }

  if (normalized.length <= 2) {
    const hours = Number(normalized);
    if (Number.isNaN(hours) || hours < 0) return null;
    return hours * 60;
  }

  if (normalized.length === 3) {
    const hours = Number(normalized.slice(0, 1));
    const minutes = Number(normalized.slice(1));
    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      minutes < 0 ||
      minutes >= 60 ||
      hours < 0
    ) {
      return null;
    }
    return hours * 60 + minutes;
  }

  if (normalized.length === 4) {
    const hours = Number(normalized.slice(0, 2));
    const minutes = Number(normalized.slice(2));
    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes) ||
      minutes < 0 ||
      minutes >= 60 ||
      hours < 0
    ) {
      return null;
    }
    return hours * 60 + minutes;
  }

  return null;
};

const toHHMM = (minutesTotal: number): string => {
  const minutesInDay =
    ((minutesTotal % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(minutesInDay / 60);
  const minutes = minutesInDay % 60;
  return `${pad(hours)}:${pad(minutes)}`;
};

const TIME_TOKEN_PATTERN = "(?:\\d{3,4}|\\d{1,2}(?::\\d{1,2})?)";

const extractRangeLine = (line: string): ParsedLine | null => {
  const normalized = normalizeSeparator(line);
  const rangeMatch = normalized.match(
    new RegExp(
      `^(${TIME_TOKEN_PATTERN})\\s*-\\s*(${TIME_TOKEN_PATTERN})\\s*(.+)$`,
    ),
  );
  if (!rangeMatch) return null;
  const [, startToken, endToken, description] = rangeMatch;
  return {
    type: "range",
    startToken,
    endToken,
    description: description.trim(),
  };
};

const extractEndOnlyLine = (line: string): ParsedLine | null => {
  const match = line.match(new RegExp(`^(${TIME_TOKEN_PATTERN})(.*)$`));
  if (!match) return null;
  const [, endToken, descriptionRaw] = match;
  const description = descriptionRaw.trim();
  if (!description) return null;
  return {
    type: "endOnly",
    endToken,
    description,
  };
};

const alignForward = (
  value: number,
  baseline: number,
): { value: number; rolledDays: number } => {
  if (value >= baseline) return { value, rolledDays: 0 };
  let adjusted = value;
  let diff = 0;
  while (adjusted < baseline) {
    adjusted += MINUTES_PER_DAY;
    diff += 1;
  }
  return { value: adjusted, rolledDays: diff };
};

const convertMinutesToDate = (
  startDate: Date,
  minutesTotal: number,
): { date: string; time: string; dayOffset: number } => {
  const dayOffset = Math.floor(minutesTotal / MINUTES_PER_DAY);
  const base = new Date(startDate);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() + dayOffset);
  return {
    date: formatDateInput(base),
    time: toHHMM(minutesTotal),
    dayOffset,
  };
};

const createRowId = (lineNumber: number): string =>
  `bulk-${lineNumber}-${Math.random().toString(36).slice(2, 8)}`;

export const parseBulkTimelogInput = (
  rawInput: string,
  options: BulkImportParseOptions,
): BulkImportParseResult => {
  const {
    startDate,
    defaultFirstStartTime = DEFAULT_FIRST_START,
    maxDays = BULK_IMPORT_MAX_DAYS,
    maxEntries = BULK_IMPORT_MAX_ENTRIES,
  } = options;

  const lines = rawInput
    .split(/\r?\n/)
    .map((line, index) => ({
      lineNumber: index + 1,
      raw: normalizeLine(line),
    }))
    .filter((line) => line.raw.length > 0);

  const globalErrors: BulkImportMessage[] = [];
  if (lines.length > maxEntries) {
    globalErrors.push({
      code: "too_many_lines",
      meta: { limit: maxEntries, dropped: lines.length - maxEntries },
    });
  }

  const rows: BulkImportRow[] = [];
  const activeLines = lines.slice(0, maxEntries);

  const defaultStartMinutes = parseTimeToken(defaultFirstStartTime) ?? 0;
  let timelineCursor = defaultStartMinutes;

  for (const { lineNumber, raw } of activeLines) {
    const normalized = normalizeLine(raw);
    if (!normalized) continue;

    const rangeResult = extractRangeLine(normalized);
    let parsed: ParsedLine | null = rangeResult;
    if (!parsed) {
      parsed = extractEndOnlyLine(normalized);
    }

    if (!parsed) {
      rows.push({
        id: createRowId(lineNumber),
        sourceLineNumber: lineNumber,
        rawText: raw,
        date: formatDateInput(startDate),
        startTime: DEFAULT_FIRST_START,
        endDate: formatDateInput(startDate),
        endTime: DEFAULT_FIRST_START,
        description: raw,
        dimensionId: null,
        taskId: null,
        personIds: [],
        notes: "",
        energyLevel: null,
        sourceType: "endOnly",
        errors: [{ code: "line_unrecognized" }],
        warnings: [],
        autoInferredStart: false,
      });
      continue;
    }

    const warnings: BulkImportMessage[] = [];
    const errors: BulkImportMessage[] = [];

    const description = parsed.description.trim();
    if (!description) {
      errors.push({ code: "missing_description" });
    }

    if (parsed.type === "range" && !parsed.startToken) {
      errors.push({ code: "start_missing" });
    }

    const endMinutesRaw = parseTimeToken(parsed.endToken);
    if (endMinutesRaw === null) {
      errors.push({ code: "end_invalid" });
    }

    let startMinutesRaw: number | null = null;
    if (parsed.type === "range" && parsed.startToken) {
      startMinutesRaw = parseTimeToken(parsed.startToken);
      if (startMinutesRaw === null) {
        errors.push({ code: "start_invalid" });
      }
    }

    if (!errors.length && endMinutesRaw !== null) {
      let startMinutes: number;
      let endMinutes: number;
      let autoInferredStart = false;

      if (parsed.type === "range" && startMinutesRaw !== null) {
        const { value: alignedStart, rolledDays } = alignForward(
          startMinutesRaw,
          timelineCursor,
        );
        if (rolledDays > 0) {
          warnings.push({ code: "auto_shift_start" });
        }
        startMinutes = alignedStart;
        const { value: alignedEnd, rolledDays: endRoll } = alignForward(
          endMinutesRaw,
          startMinutes + 1,
        );
        if (endRoll > 0) {
          warnings.push({ code: "auto_cross_midnight_range" });
        }
        endMinutes = alignedEnd;
        timelineCursor = endMinutes;
        autoInferredStart = false;
      } else {
        startMinutes = timelineCursor;
        autoInferredStart = true;
        const { value: alignedEnd, rolledDays } = alignForward(
          endMinutesRaw,
          startMinutes + 1,
        );
        if (rolledDays > 0) {
          warnings.push({ code: "auto_cross_midnight_end" });
        }
        endMinutes = alignedEnd;
        timelineCursor = endMinutes;
      }

      const startDateInfo = convertMinutesToDate(startDate, startMinutes);
      const endDateInfo = convertMinutesToDate(startDate, endMinutes);

      if (
        startDateInfo.dayOffset >= maxDays ||
        endDateInfo.dayOffset >= maxDays
      ) {
        errors.push({ code: "cross_day_limit", meta: { maxDays } });
      }

      rows.push({
        id: createRowId(lineNumber),
        sourceLineNumber: lineNumber,
        rawText: raw,
        date: startDateInfo.date,
        startTime: startDateInfo.time,
        endDate: endDateInfo.date,
        endTime: endDateInfo.time,
        description,
        dimensionId: null,
        taskId: null,
        personIds: [],
        notes: "",
        energyLevel: null,
        sourceType: parsed.type,
        errors: errors.length ? errors : [],
        warnings,
        autoInferredStart,
      });
    } else {
      rows.push({
        id: createRowId(lineNumber),
        sourceLineNumber: lineNumber,
        rawText: raw,
        date: formatDateInput(startDate),
        startTime: DEFAULT_FIRST_START,
        endDate: formatDateInput(startDate),
        endTime: DEFAULT_FIRST_START,
        description,
        dimensionId: null,
        taskId: null,
        personIds: [],
        notes: "",
        energyLevel: null,
        sourceType: parsed.type,
        errors: errors.length ? errors : [{ code: "time_parse_failure" }],
        warnings,
        autoInferredStart: parsed.type === "endOnly",
      });
    }
  }

  return { rows, globalErrors };
};
