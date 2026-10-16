export type InsertMode = "section" | "end";

/** Lowercases and strips parenthetical notes and punctuation so "Hades (Epic)" matches "Hades". */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Extracts the game name from a list line: text between "- " and the first " — ". */
function lineName(line: string): string | null {
  const match = /^\s*[-*]\s+(.+?)\s+—\s/.exec(line);
  return match ? match[1] : null;
}

/** Returns the first existing list line whose game name matches, or null. */
export function findDuplicate(content: string, name: string): string | null {
  const wanted = normalizeName(name);
  if (!wanted) return null;
  for (const line of content.split("\n")) {
    const existing = lineName(line);
    if (existing && normalizeName(existing) === wanted) return line;
  }
  return null;
}

/** Appends a line to the end of the file, ensuring exactly one trailing newline. */
export function appendToEnd(content: string, line: string): string {
  const base = content.replace(/\s+$/, "");
  return base ? `${base}\n${line}\n` : `${line}\n`;
}

/**
 * Appends a line at the end of the named section, after its last non-blank line.
 * The section runs to the next heading of the same or higher level.
 * Returns null when the heading is not found.
 */
export function appendToSection(content: string, heading: string, line: string): string | null {
  const lines = content.split("\n");
  const wanted = heading
    .trim()
    .replace(/^#+\s*/, "")
    .toLowerCase();
  let start = -1;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const match = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(lines[i]);
    if (match && match[2].trim().toLowerCase() === wanted) {
      start = i;
      level = match[1].length;
      break;
    }
  }
  if (start === -1) return null;

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const match = /^(#{1,6})\s/.exec(lines[i]);
    if (match && match[1].length <= level) {
      end = i;
      break;
    }
  }

  let insertAt = end;
  while (insertAt > start + 1 && lines[insertAt - 1].trim() === "") insertAt--;
  lines.splice(insertAt, 0, line);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Cursor-based insertion
// ---------------------------------------------------------------------------

export interface ListItem {
  indent: string;
  /** "-", "*" or "+" for bullets; the delimiter ("." or ")") for numbered items. */
  marker: string;
  /** Number for ordered items, null for bullets. */
  num: number | null;
  /** Whitespace between the marker and the text. */
  spacing: string;
  body: string;
}

const LIST_ITEM = /^(\s*)(?:([-*+])|(\d{1,9})([.)]))(\s+|$)(.*)$/;

export function parseListItem(line: string): ListItem | null {
  const match = LIST_ITEM.exec(line);
  if (!match) return null;
  const [, indent, bullet, num, delim, spacing, body] = match;
  return {
    indent,
    marker: bullet ?? delim,
    num: num === undefined ? null : Number(num),
    spacing: spacing || " ",
    body,
  };
}

function indentWidth(indent: string): number {
  let width = 0;
  for (const char of indent) width += char === "\t" ? 4 : 1;
  return width;
}

function renderItem(item: ListItem, num: number | null, text: string): string {
  const marker = item.num === null ? item.marker : `${num ?? item.num}${item.marker}`;
  return `${item.indent}${marker}${item.spacing}${text}`;
}

/** Strips a leading list marker from a formatted entry line. */
export function entryBody(entry: string): string {
  return entry.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").trim();
}

export interface Placement {
  lines: string[];
  /** Line index of the new entry. */
  cursorLine: number;
}

/**
 * Places an entry relative to the cursor, following the surrounding list style:
 * - on an empty list item: fills that item;
 * - on an item with content: adds a new sibling after it (and its nested lines), numbered items continue the
 *   numbering and following numbers are shifted when the list was numbered sequentially;
 * - on a blank line directly below an item: continues that item's list on the blank line;
 * - on a blank line elsewhere: uses the entry there as a bullet;
 * - on any other text line: adds a bullet on the line after.
 */
export function placeEntry(lines: string[], cursorLine: number, entry: string): Placement {
  const text = entryBody(entry);
  const out = lines.slice();
  const index = Math.min(Math.max(cursorLine, 0), Math.max(out.length - 1, 0));
  const current = out[index] ?? "";
  const item = parseListItem(current);

  if (item && item.body.trim() === "") {
    out[index] = renderItem(item, item.num, text);
    return { lines: out, cursorLine: index };
  }

  if (item) {
    // Skip nested lines and continuation text that belong to this item.
    const width = indentWidth(item.indent);
    let at = index + 1;
    while (at < out.length && out[at].trim() !== "" && indentWidth(/^\s*/.exec(out[at])![0]) > width) at++;

    // Following siblings of the same list, used to continue numbering.
    const siblings: number[] = [];
    if (item.num !== null) {
      for (let i = at; i < out.length; i++) {
        if (out[i].trim() === "") continue;
        const next = parseListItem(out[i]);
        const nextWidth = indentWidth(/^\s*/.exec(out[i])![0]);
        if (next && nextWidth === width && next.num !== null) siblings.push(i);
        else if (nextWidth > width) continue;
        else break;
      }
    }

    let newNum = item.num;
    if (item.num !== null) {
      const sibNums = siblings.map((i) => parseListItem(out[i])!.num as number);
      if (sibNums.length > 0 && sibNums[0] === item.num) {
        newNum = item.num; // lazy numbering (1. 1. 1.): keep the same number
      } else {
        newNum = item.num + 1;
        const sequential = sibNums.every((n, k) => n === item.num! + 1 + k);
        if (sequential) {
          for (const i of siblings) {
            const sibling = parseListItem(out[i])!;
            out[i] = renderItem(sibling, (sibling.num as number) + 1, sibling.body);
          }
        }
      }
    }

    out.splice(at, 0, renderItem(item, newNum, text));
    return { lines: out, cursorLine: at };
  }

  if (current.trim() === "") {
    const above = index > 0 ? parseListItem(out[index - 1]) : null;
    if (above) {
      out[index] = renderItem(above, above.num === null ? null : above.num + 1, text);
    } else {
      out[index] = `- ${text}`;
    }
    return { lines: out, cursorLine: index };
  }

  out.splice(index + 1, 0, `- ${text}`);
  return { lines: out, cursorLine: index + 1 };
}

export interface LineChange {
  /** First changed line in the old text. */
  start: number;
  /** One past the last changed line in the old text. */
  oldEnd: number;
  /** Replacement lines. */
  lines: string[];
}

/** Smallest line range that turns `before` into `after`, so the editor keeps undo history and cursor. */
export function diffLines(before: string[], after: string[]): LineChange | null {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  if (start === before.length && start === after.length) return null;
  let oldEnd = before.length;
  let newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, oldEnd, lines: after.slice(start, newEnd) };
}
