import { describe, expect, it } from "vitest";
import { splitBulkNoteInput, joinBulkNotes } from "@/utils/notes";

describe("noteBulkParsing", () => {
  it("splits content by three consecutive blank lines", () => {
    const raw = [
      "First note line 1",
      "",
      "",
      "",
      "Second note",
      "",
      "",
      "",
      "Third",
    ].join("\n");

    expect(splitBulkNoteInput(raw)).toEqual([
      "First note line 1",
      "Second note",
      "Third",
    ]);
  });

  it("treats blank lines containing spaces as content", () => {
    const raw = "Alpha\n \n \n \nBeta";
    expect(splitBulkNoteInput(raw)).toEqual(["Alpha\n \n \n \nBeta"]);
  });

  it("ignores leading and trailing separators", () => {
    const raw = "\n\n\nFirst\n\n\n\n\nSecond\n\n\n";
    expect(splitBulkNoteInput(raw)).toEqual(["First", "Second"]);
  });

  it("joins notes using triple blank lines", () => {
    const joined = joinBulkNotes(["One", "Two"]);
    expect(joined).toBe("One\n\n\nTwo");
  });

  it("normalizes windows newlines", () => {
    const raw = ["First", "", "", "", "Second"].join("\r\n");
    expect(splitBulkNoteInput(raw)).toEqual(["First", "Second"]);
  });
});
