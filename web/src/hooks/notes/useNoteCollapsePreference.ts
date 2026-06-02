import { usePreferenceWithBootstrap } from "@/hooks/queries/usePreferenceWithBootstrap";

export const NOTE_COLLAPSE_ALLOWED_LINES = [3, 5, 7, 9, 11, 13, 15] as const;
type NoteCollapseLineOption = (typeof NOTE_COLLAPSE_ALLOWED_LINES)[number];

const DEFAULT_COLLAPSE_LINES: NoteCollapseLineOption = 5;

export function isValidNoteCollapseValue(
  value: number,
): value is NoteCollapseLineOption {
  return NOTE_COLLAPSE_ALLOWED_LINES.includes(value as NoteCollapseLineOption);
}

export function useNoteCollapsePreference(
  defaultValue: NoteCollapseLineOption = DEFAULT_COLLAPSE_LINES,
) {
  return usePreferenceWithBootstrap<NoteCollapseLineOption>({
    key: "notes.card_min_collapsed_lines",
    defaultValue,
    module: "notes",
    validator: (value) =>
      typeof value === "number" && isValidNoteCollapseValue(value),
  });
}

export function coerceNoteCollapseValue(
  value: unknown,
): NoteCollapseLineOption {
  if (typeof value === "number" && isValidNoteCollapseValue(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && isValidNoteCollapseValue(parsed)) {
      return parsed;
    }
  }
  return DEFAULT_COLLAPSE_LINES;
}

export const defaultNoteCollapseLines = DEFAULT_COLLAPSE_LINES;
