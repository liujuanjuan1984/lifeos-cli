const normalizeNewlines = (input: string): string => {
  return input.replace(/\r\n?/g, "\n");
};

const SEPARATOR_LENGTH = 3;

/**
 * Split raw textarea input into separate notes.
 * Only blank lines (no spaces/tabs) count toward the separator.
 */
export function splitBulkNoteInput(rawInput: string): string[] {
  const normalized = normalizeNewlines(rawInput).split("\n");
  const notes: string[] = [];
  let currentLines: string[] = [];
  let pendingBlankLines: string[] = [];

  const pushCurrent = () => {
    const noteText = currentLines.join("\n").trim();
    if (noteText.length > 0) {
      notes.push(noteText);
    }
    currentLines = [];
  };

  for (const line of normalized) {
    if (line === "") {
      pendingBlankLines.push("");
      continue;
    }

    if (pendingBlankLines.length >= SEPARATOR_LENGTH) {
      pushCurrent();
      pendingBlankLines = [];
    } else if (pendingBlankLines.length > 0) {
      currentLines.push(...pendingBlankLines);
      pendingBlankLines = [];
    }

    currentLines.push(line);
  }

  if (pendingBlankLines.length >= SEPARATOR_LENGTH) {
    pushCurrent();
    pendingBlankLines = [];
  } else if (pendingBlankLines.length > 0) {
    currentLines.push(...pendingBlankLines);
  }

  pushCurrent();
  return notes;
}

/**
 * Join note contents back into the textarea format.
 */
export function joinBulkNotes(notes: string[]): string {
  const trimmed = notes
    .map((note) => note.trim())
    .filter((note) => note.length);
  return trimmed.join("\n\n\n");
}

export function createPreviewNoteId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
