import { requestUrl } from "obsidian";
import {
  DeckCategory,
  ProtonSummary,
  ReviewSummary,
  SearchResult,
  parseAppName,
  parseDeck,
  parseProton,
  parseReviews,
  parseSearch,
} from "./parse";

export type { DeckCategory, ProtonSummary, ReviewSummary, SearchResult };
export { parseAppId } from "./parse";

async function getJson(url: string): Promise<unknown> {
  const response = await requestUrl({ url, throw: false });
  if (response.status !== 200) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json;
}

export async function searchSteam(term: string): Promise<SearchResult[]> {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&cc=us&l=english`;
  return parseSearch(await getJson(url));
}

export async function fetchAppName(appId: number): Promise<string | null> {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`;
  return parseAppName(await getJson(url), appId);
}

export async function fetchReviews(appId: number): Promise<ReviewSummary | null> {
  const url = `https://store.steampowered.com/appreviews/${appId}?json=1&num_per_page=0&language=all&purchase_type=all`;
  return parseReviews(await getJson(url));
}

export async function fetchDeck(appId: number): Promise<DeckCategory | null> {
  const url = `https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport?nAppID=${appId}`;
  return parseDeck(await getJson(url));
}

export async function fetchProton(appId: number): Promise<ProtonSummary | null> {
  return parseProton(await getJson(`https://www.protondb.com/api/v1/reports/summaries/${appId}.json`));
}

export interface GameData {
  reviews: ReviewSummary | null;
  deck: DeckCategory | null;
  proton: ProtonSummary | null;
  /** Names of sources that failed or returned nothing, for the preview. */
  missing: string[];
}

/** Fetches all three sources in parallel; one failing source never blocks the others. */
export async function fetchGameData(appId: number): Promise<GameData> {
  const settle = <T>(promise: Promise<T | null>): Promise<T | null> => promise.catch(() => null);
  const [reviews, deck, proton] = await Promise.all([
    settle(fetchReviews(appId)),
    settle(fetchDeck(appId)),
    settle(fetchProton(appId)),
  ]);
  const missing: string[] = [];
  if (!reviews) missing.push("Steam reviews");
  if (deck === null) missing.push("Steam Deck status");
  if (!proton) missing.push("ProtonDB");
  return { reviews, deck, proton, missing };
}
