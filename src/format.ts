import type { DeckCategory, ProtonSummary, ReviewSummary } from "./parse";

export type Verdict = "SD-good" | "SD-skip";

/** Fewer ProtonDB reports than this count as "too little data". */
export const MIN_PROTON_REPORTS = 5;

const DECK_LABELS: Record<number, string> = { 0: "unrated", 1: "Unsupported", 2: "Playable", 3: "Verified" };

export function deckLabel(deck: DeckCategory): string {
  return DECK_LABELS[deck];
}

export function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function hasEnoughProtonData(proton: ProtonSummary | null): proton is ProtonSummary {
  return !!proton && proton.tier !== "pending" && proton.total >= MIN_PROTON_REPORTS;
}

/** Notes such as "(SD)" or "(Epic)(SD)" mark games the user already plays on the Deck. */
export function hasUserSdTag(notes: string): boolean {
  return /\(\s*SD\b/i.test(notes);
}

export interface VerdictInput {
  deck: DeckCategory | null;
  proton: ProtonSummary | null;
  notes: string;
  mouseKeyboard: boolean;
}

/**
 * SD-good: the user's own (SD) tag, or Verified, or Playable with ProtonDB Platinum.
 * SD-skip: everything else, including the mouse/keyboard-centric override.
 * The user's own (SD) tag always wins.
 */
export function suggestVerdict(input: VerdictInput): Verdict {
  if (hasUserSdTag(input.notes)) return "SD-good";
  if (input.mouseKeyboard) return "SD-skip";
  if (input.deck === 3) return "SD-good";
  if (input.deck === 2 && hasEnoughProtonData(input.proton) && input.proton.tier === "platinum") return "SD-good";
  return "SD-skip";
}

/** "Very Positive (95%)", or "no user reviews" when there are none. */
export function formatRating(reviews: ReviewSummary): string {
  const total = reviews.positive + reviews.negative;
  if (total === 0) return "no user reviews";
  const percent = Math.round((100 * reviews.positive) / total);
  const label = reviews.desc && !/\d/.test(reviews.desc) ? reviews.desc : "Few reviews";
  return `${label} (${percent}%)`;
}

/** Default reason text: Valve status and ProtonDB tier, leaving out sources that failed. */
export function formatEvidence(deck: DeckCategory | null, proton: ProtonSummary | null, extra = ""): string {
  const parts: string[] = [];
  if (deck !== null) parts.push(deckLabel(deck));
  if (proton) {
    parts.push(
      hasEnoughProtonData(proton)
        ? `ProtonDB ${titleCase(proton.tier)} (${proton.total})`
        : "too little data on ProtonDB",
    );
  }
  let text = parts.join(", ");
  if (extra.trim()) text = text ? `${text}; ${extra.trim()}` : extra.trim();
  return text;
}

export interface LineInput {
  name: string;
  notes: string;
  rating: string | null;
  verdict: Verdict;
  evidence: string;
}

/**
 * - Name (notes) — Rating (xx%) · SD-good · evidence
 * - Name — no Steam rating · SD-skip — not found on Steam
 */
export function formatLine(input: LineInput): string {
  const head = [input.name.trim(), input.notes.trim()].filter((part) => part).join(" ");
  if (input.rating === null) {
    return `- ${head} — no Steam rating · ${input.verdict}${input.evidence ? ` — ${input.evidence}` : ""}`;
  }
  return `- ${head} — ${input.rating} · ${input.verdict}${input.evidence ? ` · ${input.evidence}` : ""}`;
}
