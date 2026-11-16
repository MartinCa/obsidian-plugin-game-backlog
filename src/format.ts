import type { DeckCategory, ProtonSummary, ReviewSummary } from "./parse";

export type Verdict = "sd-good" | "sd-skip";

/** Fewer ProtonDB reports than this count as "thin data". */
export const MIN_PROTON_REPORTS = 5;

const DECK_LABELS: Record<number, string> = { 0: "unrated", 1: "unsupported", 2: "playable", 3: "verified" };

export function deckLabel(deck: DeckCategory): string {
  return DECK_LABELS[deck];
}

export function hasEnoughProtonData(proton: ProtonSummary | null): proton is ProtonSummary {
  return !!proton && proton.tier !== "pending" && proton.total >= MIN_PROTON_REPORTS;
}

/**
 * Splits tag input such as "epic, sd", "[epic] [sd]" or "(Epic)(SD)" into unique lowercase tag names.
 * A "|" is a separator too, so it can never end up in a tag and break the line.
 * Store tags keep their order and "sd" always goes last.
 */
export function parseTags(input: string): string[] {
  const tags = [
    ...new Set(
      input
        .toLowerCase()
        .split(/[\s,;|()[\]]+/)
        .filter(Boolean),
    ),
  ];
  return tags.sort((a, b) => Number(a === "sd") - Number(b === "sd"));
}

/** "epic, sd" becomes "[epic] [sd]". */
export function formatTags(input: string): string {
  return parseTags(input)
    .map((tag) => `[${tag}]`)
    .join(" ");
}

/** A tag "sd" marks games the user already plays on the Deck. */
export function hasUserSdTag(tags: string): boolean {
  return parseTags(tags).includes("sd");
}

/** "Metroidvania; Roguelike" becomes "metroidvania, roguelike". */
export function formatGenres(input: string): string {
  return input
    .split(/[,;]+/)
    .map((genre) => genre.trim().toLowerCase())
    .filter(Boolean)
    .join(", ");
}

export interface VerdictInput {
  deck: DeckCategory | null;
  proton: ProtonSummary | null;
  tags: string;
  mouseKeyboard: boolean;
}

/**
 * sd-good: the user's own [sd] tag, or Verified, or Playable with ProtonDB Platinum.
 * sd-skip: everything else, including the mouse/keyboard-centric override.
 * The user's own [sd] tag always wins.
 */
export function suggestVerdict(input: VerdictInput): Verdict {
  if (hasUserSdTag(input.tags)) return "sd-good";
  if (input.mouseKeyboard) return "sd-skip";
  if (input.deck === 3) return "sd-good";
  if (input.deck === 2 && hasEnoughProtonData(input.proton) && input.proton.tier === "platinum") return "sd-good";
  return "sd-skip";
}

/** "95%", or "-" when there are no user reviews. */
export function formatRating(reviews: ReviewSummary): string {
  const total = reviews.positive + reviews.negative;
  if (total === 0) return "-";
  return `${Math.round((100 * reviews.positive) / total)}%`;
}

/** Valve status and ProtonDB tier, e.g. "verified, platinum 95", leaving out sources that failed. */
export function formatDeck(deck: DeckCategory | null, proton: ProtonSummary | null): string {
  const parts: string[] = [];
  if (deck !== null) parts.push(deckLabel(deck));
  if (proton) parts.push(hasEnoughProtonData(proton) ? `${proton.tier} ${proton.total}` : "thin data");
  return parts.join(", ");
}

export interface LineInput {
  name: string;
  /** Raw tag input, normalized to "[store] [sd]" after the name. */
  tags: string;
  /** Steam percent such as "95%", or null when the game has no Steam data. */
  rating: string | null;
  verdict: Verdict;
  deck: string;
  /** Raw genre input, normalized to "genre, genre". */
  genres: string;
  note: string;
}

/** Fields are separated by "|", so a "|" inside a field is replaced and whitespace is collapsed. */
function cleanField(text: string): string {
  return text
    .replace(/\s*\|\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * - Title [store] [sd] | 95% | sd-good | verified, platinum 95 | genre, genre | note
 *
 * Empty fields in the middle are written as "-", trailing empty fields are left out.
 * A game not on Steam is "- Name | - | sd-skip | not on steam".
 */
export function formatLine(input: LineInput): string {
  const title = [cleanField(input.name), formatTags(input.tags)].filter(Boolean).join(" ");
  const fields = [
    title,
    cleanField(input.rating ?? ""),
    input.verdict,
    cleanField(input.deck),
    formatGenres(cleanField(input.genres)),
    cleanField(input.note),
  ];
  while (fields.length > 3 && fields[fields.length - 1] === "") fields.pop();
  return `- ${fields.map((field) => field || "-").join(" | ")}`;
}
