import { describe, expect, it } from "vitest";
import { appendToEnd, appendToSection, findDuplicate, normalizeName } from "./insert";

const note = [
  "# Games",
  "",
  "## Main",
  "",
  "- A — Good (90%) · SD-good",
  "- B (Epic) — Good (91%) · SD-skip",
  "",
  "## VR",
  "",
  "- Alyx — OP (98%)",
  "",
].join("\n");

describe("appendToSection", () => {
  it("adds after the last entry of the section, before the next heading", () => {
    const result = appendToSection(note, "Main", "- C — new")!;
    const lines = result.split("\n");
    expect(lines[lines.indexOf("- C — new") - 1]).toBe("- B (Epic) — Good (91%) · SD-skip");
    expect(lines[lines.indexOf("- C — new") + 1]).toBe("");
    expect(lines[lines.indexOf("- C — new") + 2]).toBe("## VR");
  });
  it("handles the last section and keeps the trailing newline", () => {
    const result = appendToSection(note, "VR", "- Moss — new")!;
    expect(result.endsWith("- Alyx — OP (98%)\n- Moss — new\n")).toBe(true);
  });
  it("matches headings case-insensitively and returns null when missing", () => {
    expect(appendToSection(note, "main", "- C")).not.toBeNull();
    expect(appendToSection(note, "Steam Deck", "- C")).toBeNull();
  });
});

describe("appendToEnd", () => {
  it("ensures exactly one trailing newline", () => {
    expect(appendToEnd("- A\n\n\n", "- B")).toBe("- A\n- B\n");
    expect(appendToEnd("", "- B")).toBe("- B\n");
  });
});

describe("findDuplicate", () => {
  it("matches ignoring notes, case and punctuation", () => {
    expect(findDuplicate(note, "b")).toBe("- B (Epic) — Good (91%) · SD-skip");
    expect(findDuplicate(note, "Half-Life: Alyx")).toBeNull();
  });
  it("normalizes names", () => expect(normalizeName("Dead Cells (SD)")).toBe("dead cells"));
});
