// Pure types and response parsers (no Obsidian imports, so they are unit-testable).

/** Valve's Steam Deck compatibility category (`resolved_category`). */
export type DeckCategory = 0 | 1 | 2 | 3;

export interface SearchResult {
  appId: number;
  name: string;
}

export interface ReviewSummary {
  /** Steam's own label, e.g. "Very Positive", or "" when Steam has none. */
  desc: string;
  positive: number;
  negative: number;
}

export interface ProtonSummary {
  tier: string;
  total: number;
}

/** Extracts an app ID from a Steam store URL or a bare number. Returns null for anything else. */
export function parseAppId(input: string): number | null {
  const text = input.trim();
  if (/^\d+$/.test(text)) return Number(text);
  const match = /store\.steampowered\.com\/app\/(\d+)/i.exec(text);
  return match ? Number(match[1]) : null;
}

export function parseSearch(json: unknown): SearchResult[] {
  const items = (json as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  const results: SearchResult[] = [];
  for (const item of items) {
    const id = (item as { id?: unknown })?.id;
    const name = (item as { name?: unknown })?.name;
    if (typeof id === "number" && typeof name === "string") results.push({ appId: id, name });
  }
  return results;
}

/** Parses `IStoreBrowseService/GetItems` (with `include_reviews`) into a review summary. */
export function parseReviews(json: unknown): ReviewSummary | null {
  const item = (json as { response?: { store_items?: Array<Record<string, unknown>> } })?.response?.store_items?.[0];
  if (!item || item.success !== 1) return null;
  const summary = (item.reviews as { summary_filtered?: Record<string, unknown> } | undefined)?.summary_filtered;
  // Games without reviews come back with no summary at all.
  if (!summary) return { desc: "", positive: 0, negative: 0 };
  const count = Number(summary.review_count);
  const percent = Number(summary.percent_positive);
  if (!Number.isFinite(count) || !Number.isFinite(percent)) return null;
  const positive = Math.round((count * percent) / 100);
  const desc = typeof summary.review_score_label === "string" ? summary.review_score_label : "";
  return { desc, positive, negative: count - positive };
}

export function parseDeck(json: unknown): DeckCategory | null {
  const root = json as { results?: { resolved_category?: unknown }; resolved_category?: unknown };
  const value = root?.results?.resolved_category ?? root?.resolved_category;
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : null;
}

export function parseProton(json: unknown): ProtonSummary | null {
  const root = json as { tier?: unknown; total?: unknown };
  if (typeof root?.tier !== "string") return null;
  return { tier: root.tier.toLowerCase(), total: typeof root.total === "number" ? root.total : 0 };
}

export function parseAppName(json: unknown, appId: number): string | null {
  const entry = (json as Record<string, { success?: boolean; data?: { name?: unknown } }>)?.[String(appId)];
  const name = entry?.success ? entry.data?.name : undefined;
  return typeof name === "string" ? name : null;
}
