import { describe, expect, it } from "vitest";
import { formatModelPrice, formatTokens, formatUsd } from "./aiUsage";

describe("AI usage formatting", () => {
  it("shows dollars, small amounts to 4 decimals and never fewer than 2", () => {
    expect(formatUsd(4.835)).toBe("$4.83");
    expect(formatUsd(0.4)).toBe("$0.40");
    expect(formatUsd(0.0271)).toBe("$0.0271");
    expect(formatUsd(0.021)).toBe("$0.021");
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("shows an unknown cost as a dash, not $0", () => {
    expect(formatUsd(null)).toBe("—");
  });

  it("shortens token counts", () => {
    expect(formatTokens(2050000)).toBe("2.05M");
    expect(formatTokens(12900)).toBe("12.9K");
    expect(formatTokens(900)).toBe("900");
  });

  it("says when a model has no price yet", () => {
    expect(formatModelPrice({ inputPricePer1m: null, outputPricePer1m: null })).toBe("Price not set");
    expect(formatModelPrice({ inputPricePer1m: 0.4, outputPricePer1m: 1.6 })).toBe(
      "$0.40 in · $1.60 out per 1M tokens"
    );
  });
});
