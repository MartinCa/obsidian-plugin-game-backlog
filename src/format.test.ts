import { describe, expect, it } from "vitest";
import {
  formatDeck,
  formatGenres,
  formatLine,
  formatRating,
  formatTags,
  hasUserSdTag,
  parseTags,
  suggestVerdict,
} from "./format";

const platinum = { tier: "platinum", total: 95 };

describe("formatRating", () => {
  it("rounds the positive share to a percent", () => {
    expect(formatRating({ desc: "Overwhelmingly Positive", positive: 26283, negative: 1318 })).toBe("95%");
  });
  it("uses a dash for games without reviews", () => {
    expect(formatRating({ desc: "", positive: 0, negative: 0 })).toBe("-");
  });
  it("ignores Steam's label for games with few reviews", () => {
    expect(formatRating({ desc: "3 user reviews", positive: 3, negative: 0 })).toBe("100%");
  });
});

describe("tags and genres", () => {
  it("normalizes tag input, stores first and sd last", () => {
    expect(formatTags("epic, sd")).toBe("[epic] [sd]");
    expect(formatTags("[SD] [Epic]")).toBe("[epic] [sd]");
    expect(formatTags("(Epic)(SD)")).toBe("[epic] [sd]");
    expect(formatTags("Battle.net")).toBe("[battle.net]");
    expect(formatTags("epic epic")).toBe("[epic]");
    expect(formatTags("")).toBe("");
    expect(parseTags("gog sd")).toEqual(["gog", "sd"]);
  });
  it("normalizes genre input", () => {
    expect(formatGenres("Metroidvania; Roguelike")).toBe("metroidvania, roguelike");
    expect(formatGenres(" puzzle ,, ")).toBe("puzzle");
    expect(formatGenres("")).toBe("");
  });
});

describe("suggestVerdict", () => {
  const base = { deck: null, proton: null, tags: "", mouseKeyboard: false } as const;
  it("is good for Verified", () => expect(suggestVerdict({ ...base, deck: 3 })).toBe("sd-good"));
  it("is good for Playable with enough Platinum reports", () =>
    expect(suggestVerdict({ ...base, deck: 2, proton: platinum })).toBe("sd-good"));
  it("skips Playable with Gold", () =>
    expect(suggestVerdict({ ...base, deck: 2, proton: { tier: "gold", total: 400 } })).toBe("sd-skip"));
  it("skips Playable with Platinum but too few reports", () =>
    expect(suggestVerdict({ ...base, deck: 2, proton: { tier: "platinum", total: 3 } })).toBe("sd-skip"));
  it("skips Unsupported and unknown", () => {
    expect(suggestVerdict({ ...base, deck: 1, proton: platinum })).toBe("sd-skip");
    expect(suggestVerdict({ ...base })).toBe("sd-skip");
  });
  it("mouse/keyboard override forces skip", () =>
    expect(suggestVerdict({ ...base, deck: 3, mouseKeyboard: true })).toBe("sd-skip"));
  it("the user's own sd tag always wins", () => {
    expect(suggestVerdict({ ...base, deck: 1, tags: "epic sd", mouseKeyboard: true })).toBe("sd-good");
    expect(hasUserSdTag("[epic] [SD]")).toBe(true);
    expect(hasUserSdTag("epic")).toBe(false);
  });
});

describe("formatDeck", () => {
  it("combines Valve status and the ProtonDB tier with its report count", () => {
    expect(formatDeck(3, platinum)).toBe("verified, platinum 95");
  });
  it("leaves out sources that failed and flags thin ProtonDB data", () => {
    expect(formatDeck(null, null)).toBe("");
    expect(formatDeck(3, { tier: "pending", total: 1 })).toBe("verified, thin data");
    expect(formatDeck(0, { tier: "platinum", total: 3 })).toBe("unrated, thin data");
  });
});

describe("formatLine", () => {
  const base = { tags: "", genres: "", note: "" } as const;
  it("builds the documented line", () => {
    expect(
      formatLine({
        ...base,
        name: "Ball X Pit",
        rating: "95%",
        verdict: "sd-good",
        deck: formatDeck(3, platinum),
      }),
    ).toBe("- Ball X Pit | 95% | sd-good | verified, platinum 95");
  });
  it("puts tags after the name and the note last", () => {
    expect(
      formatLine({
        ...base,
        name: "Elden Ring",
        tags: "epic",
        rating: "93%",
        verdict: "sd-skip",
        deck: formatDeck(3, { tier: "gold", total: 2105 }),
        note: "locked 30 fps",
      }),
    ).toBe("- Elden Ring [epic] | 93% | sd-skip | verified, gold 2105 | - | locked 30 fps");
  });
  it("includes genres, and a dash fills an empty field before the note", () => {
    expect(
      formatLine({
        name: "Dead Cells",
        tags: "sd",
        rating: "97%",
        verdict: "sd-good",
        deck: "verified, platinum 157",
        genres: "Metroidvania, Roguelike",
        note: "",
      }),
    ).toBe("- Dead Cells [sd] | 97% | sd-good | verified, platinum 157 | metroidvania, roguelike");
    expect(
      formatLine({ ...base, name: "A", rating: "90%", verdict: "sd-good", deck: "", note: "wait for patch" }),
    ).toBe("- A | 90% | sd-good | - | - | wait for patch");
  });
  it("leaves out trailing empty fields", () => {
    expect(formatLine({ ...base, name: "A", rating: "90%", verdict: "sd-skip", deck: "" })).toBe("- A | 90% | sd-skip");
  });
  it("replaces a pipe inside a field", () => {
    expect(formatLine({ ...base, name: "A | B", rating: "90%", verdict: "sd-skip", deck: "" })).toBe(
      "- A / B | 90% | sd-skip",
    );
  });
  it("formats games not on Steam", () => {
    expect(formatLine({ ...base, name: "Gundegon", rating: null, verdict: "sd-skip", deck: "not on steam" })).toBe(
      "- Gundegon | - | sd-skip | not on steam",
    );
  });
});
