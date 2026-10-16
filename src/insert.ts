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
