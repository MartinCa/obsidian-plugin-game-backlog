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

import { diffLines, entryBody, parseListItem, placeEntry } from "./insert";

const entry = "- New — Good (90%) · SD-good · Verified";
const body = "New — Good (90%) · SD-good · Verified";

describe("entryBody / parseListItem", () => {
  it("strips markers", () => {
    expect(entryBody(entry)).toBe(body);
    expect(entryBody("1. x")).toBe("x");
  });
  it("parses bullets and numbers", () => {
    expect(parseListItem("  * a")).toMatchObject({ indent: "  ", marker: "*", num: null, body: "a" });
    expect(parseListItem("12) b")).toMatchObject({ marker: ")", num: 12, body: "b" });
    expect(parseListItem("- ")).toMatchObject({ body: "" });
    expect(parseListItem("plain")).toBeNull();
    expect(parseListItem("-dash")).toBeNull();
  });
});

describe("placeEntry", () => {
  it("fills an empty bullet at the cursor", () => {
    const result = placeEntry(["- A", "- ", "- C"], 1, entry);
    expect(result.lines).toEqual(["- A", `- ${body}`, "- C"]);
    expect(result.cursorLine).toBe(1);
  });
  it("fills an empty numbered item and keeps its number", () => {
    expect(placeEntry(["1. A", "2. "], 1, entry).lines).toEqual(["1. A", `2. ${body}`]);
  });
  it("adds after an existing bullet using its marker and indent", () => {
    const result = placeEntry(["* A", "* B"], 0, entry);
    expect(result.lines).toEqual(["* A", `* ${body}`, "* B"]);
    expect(result.cursorLine).toBe(1);
    expect(placeEntry(["  - A"], 0, entry).lines).toEqual(["  - A", `  - ${body}`]);
  });
  it("adds after the item's nested lines", () => {
    const lines = ["- A", "  - child", "  more text", "- B"];
    expect(placeEntry(lines, 0, entry).lines).toEqual(["- A", "  - child", "  more text", `- ${body}`, "- B"]);
  });
  it("continues numbering and shifts sequential followers", () => {
    const result = placeEntry(["1. A", "2. B", "3. C"], 0, entry);
    expect(result.lines).toEqual(["1. A", `2. ${body}`, "3. B", "4. C"]);
    expect(result.cursorLine).toBe(1);
  });
  it("shifts followers past nested lines, keeps the delimiter", () => {
    const result = placeEntry(["1) A", "   - x", "2) B"], 0, entry);
    expect(result.lines).toEqual(["1) A", "   - x", `2) ${body}`, "3) B"]);
  });
  it("keeps lazy numbering (all 1.)", () => {
    expect(placeEntry(["1. A", "1. B"], 0, entry).lines).toEqual(["1. A", `1. ${body}`, "1. B"]);
  });
  it("appends the next number at the end of a numbered list", () => {
    expect(placeEntry(["1. A", "2. B"], 1, entry).lines).toEqual(["1. A", "2. B", `3. ${body}`]);
  });
  it("does not renumber non-sequential followers", () => {
    expect(placeEntry(["1. A", "5. B"], 0, entry).lines).toEqual(["1. A", `2. ${body}`, "5. B"]);
  });
  it("uses a blank line directly below an item, continuing its list", () => {
    expect(placeEntry(["1. A", ""], 1, entry).lines).toEqual(["1. A", `2. ${body}`]);
    expect(placeEntry(["- A", ""], 1, entry).lines).toEqual(["- A", `- ${body}`]);
  });
  it("uses a blank line elsewhere as a bullet", () => {
    expect(placeEntry(["# Title", "", "text"], 1, entry).lines).toEqual(["# Title", `- ${body}`, "text"]);
  });
  it("adds a bullet after a plain text line", () => {
    const result = placeEntry(["intro", "outro"], 0, entry);
    expect(result.lines).toEqual(["intro", `- ${body}`, "outro"]);
    expect(result.cursorLine).toBe(1);
  });
  it("works on an empty document and clamps an out-of-range cursor", () => {
    expect(placeEntry([""], 0, entry).lines).toEqual([`- ${body}`]);
    expect(placeEntry(["- A"], 99, entry).lines).toEqual(["- A", `- ${body}`]);
  });
});

describe("diffLines", () => {
  it("returns the smallest changed range", () => {
    expect(diffLines(["a", "b", "c"], ["a", "x", "b", "c"])).toEqual({ start: 1, oldEnd: 1, lines: ["x"] });
    expect(diffLines(["1", "2", "3"], ["1", "2", "3", "4"])).toEqual({ start: 3, oldEnd: 3, lines: ["4"] });
    expect(diffLines(["a", "b"], ["a", "c"])).toEqual({ start: 1, oldEnd: 2, lines: ["c"] });
    expect(diffLines(["a"], ["a"])).toBeNull();
  });
});
