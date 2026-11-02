import { describe, expect, it } from "vitest";
import { parseAppId, parseAppName, parseDeck, parseProton, parseReviews, parseSearch } from "./parse";

describe("parseAppId", () => {
  it("accepts numbers and store URLs only", () => {
    expect(parseAppId(" 1794680 ")).toBe(1794680);
    expect(parseAppId("https://store.steampowered.com/app/1794680/Vampire_Survivors/")).toBe(1794680);
    expect(parseAppId("Hades")).toBeNull();
  });
});

describe("response parsers", () => {
  it("parses search results", () => {
    expect(parseSearch({ items: [{ id: 1, name: "A" }, { id: "x" }] })).toEqual([{ appId: 1, name: "A" }]);
    expect(parseSearch({})).toEqual([]);
  });
  it("parses reviews", () => {
    const item = (reviews?: unknown) => ({ response: { store_items: [{ success: 1, reviews }] } });
    expect(
      parseReviews(
        item({ summary_filtered: { review_count: 200, percent_positive: 95, review_score_label: "Very Positive" } }),
      ),
    ).toEqual({ desc: "Very Positive", positive: 190, negative: 10 });
    expect(parseReviews(item())).toEqual({ desc: "", positive: 0, negative: 0 });
    expect(parseReviews({ response: { store_items: [{ success: 2 }] } })).toBeNull();
    expect(parseReviews({})).toBeNull();
  });
  it("parses the deck category from either shape", () => {
    expect(parseDeck({ success: 1, results: { resolved_category: 3 } })).toBe(3);
    expect(parseDeck({ resolved_category: 2 })).toBe(2);
    expect(parseDeck({ results: { resolved_category: 9 } })).toBeNull();
  });
  it("parses ProtonDB summaries", () => {
    expect(parseProton({ tier: "Platinum", total: 95 })).toEqual({ tier: "platinum", total: 95 });
    expect(parseProton({})).toBeNull();
  });
  it("parses app names", () => {
    expect(parseAppName({ "10": { success: true, data: { name: "X" } } }, 10)).toBe("X");
    expect(parseAppName({ "10": { success: false } }, 10)).toBeNull();
  });
});
