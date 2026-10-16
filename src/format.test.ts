import { describe, expect, it } from "vitest";
import { formatEvidence, formatLine, formatRating, hasUserSdTag, suggestVerdict } from "./format";

const platinum = { tier: "platinum", total: 95 };

describe("formatRating", () => {
  it("rounds the positive share to a percent", () => {
    expect(formatRating({ desc: "Overwhelmingly Positive", positive: 26283, negative: 1318 })).toBe(
      "Overwhelmingly Positive (95%)",
    );
  });
  it("handles games without reviews", () => {
    expect(formatRating({ desc: "", positive: 0, negative: 0 })).toBe("no user reviews");
  });
  it("replaces Steam's count-style label for games with few reviews", () => {
    expect(formatRating({ desc: "3 user reviews", positive: 3, negative: 0 })).toBe("Few reviews (100%)");
  });
});

describe("suggestVerdict", () => {
  const base = { deck: null, proton: null, notes: "", mouseKeyboard: false } as const;
  it("is good for Verified", () => expect(suggestVerdict({ ...base, deck: 3 })).toBe("SD-good"));
  it("is good for Playable with enough Platinum reports", () =>
    expect(suggestVerdict({ ...base, deck: 2, proton: platinum })).toBe("SD-good"));
  it("skips Playable with Gold", () =>
    expect(suggestVerdict({ ...base, deck: 2, proton: { tier: "gold", total: 400 } })).toBe("SD-skip"));
  it("skips Playable with Platinum but too few reports", () =>
    expect(suggestVerdict({ ...base, deck: 2, proton: { tier: "platinum", total: 3 } })).toBe("SD-skip"));
  it("skips Unsupported and unknown", () => {
    expect(suggestVerdict({ ...base, deck: 1, proton: platinum })).toBe("SD-skip");
    expect(suggestVerdict({ ...base })).toBe("SD-skip");
  });
  it("mouse/keyboard override forces skip", () =>
    expect(suggestVerdict({ ...base, deck: 3, mouseKeyboard: true })).toBe("SD-skip"));
  it("the user's own (SD) tag always wins", () => {
    expect(suggestVerdict({ ...base, deck: 1, notes: "(Epic)(SD)", mouseKeyboard: true })).toBe("SD-good");
    expect(hasUserSdTag("Wait for patch")).toBe(false);
  });
});

describe("formatLine", () => {
  it("builds the documented line", () => {
    const evidence = formatEvidence(3, platinum);
    expect(
      formatLine({
        name: "Ball X Pit",
        notes: "",
        rating: "Overwhelmingly Positive (95%)",
        verdict: "SD-good",
        evidence,
      }),
    ).toBe("- Ball X Pit — Overwhelmingly Positive (95%) · SD-good · Verified, ProtonDB Platinum (95)");
  });
  it("keeps notes and extra reason", () => {
    const evidence = formatEvidence(3, { tier: "gold", total: 2105 }, "locked 30 fps");
    expect(
      formatLine({ name: "Elden Ring", notes: "(Epic)", rating: "Very Positive (93%)", verdict: "SD-skip", evidence }),
    ).toBe("- Elden Ring (Epic) — Very Positive (93%) · SD-skip · Verified, ProtonDB Gold (2105); locked 30 fps");
  });
  it("leaves out sources that failed and flags thin ProtonDB data", () => {
    expect(formatEvidence(null, null)).toBe("");
    expect(formatEvidence(3, { tier: "pending", total: 1 })).toBe("Verified, too little data on ProtonDB");
  });
  it("formats games not on Steam", () => {
    expect(
      formatLine({ name: "Gundegon", notes: "", rating: null, verdict: "SD-skip", evidence: "not found on Steam" }),
    ).toBe("- Gundegon — no Steam rating · SD-skip — not found on Steam");
  });
});
