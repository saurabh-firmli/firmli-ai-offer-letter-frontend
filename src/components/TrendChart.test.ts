import { describe, expect, it } from "vitest";
import dayjs from "dayjs";
import { trendBuckets, trendRange, trendUnit } from "./TrendChart";

/** n days ending on 2026-10-25, each with value 1. */
const daysEnding = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    date: dayjs("2026-10-25")
      .subtract(n - 1 - i, "day")
      .format("YYYY-MM-DD"),
    value: 1,
  }));

describe("trend chart buckets", () => {
  it("keeps a bar per day for a month, sums weeks for a quarter and months for a year", () => {
    expect(trendUnit(30)).toBe("day");
    expect(trendBuckets(daysEnding(30))).toHaveLength(30);

    const weeks = trendBuckets(daysEnding(90));
    expect(trendUnit(90)).toBe("week");
    expect(weeks).toHaveLength(13);
    expect(weeks[0].value).toBe(7);

    const months = trendBuckets(daysEnding(365));
    expect(trendUnit(365)).toBe("month");
    expect(months).toHaveLength(13); // 26 Oct 2025 to 25 Oct 2026 touches 13 months
    expect(months.reduce((sum, { value }) => sum + value, 0)).toBe(365);
    expect(months[0].label).toBe("October 2025");
  });

  it("names both years only when the range crosses one", () => {
    expect(trendRange(daysEnding(30))).toBe("26 Sep – 25 Oct 2026");
    expect(trendRange(daysEnding(365))).toBe("26 Oct 2025 – 25 Oct 2026");
  });
});
