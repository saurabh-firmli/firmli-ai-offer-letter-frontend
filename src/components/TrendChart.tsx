import { Tooltip } from "@mantine/core";
import dayjs from "dayjs";
import classes from "./TrendChart.module.css";

/*
 * A bar chart over time (Dashboard: applications per day; AI Usage: tokens per day). The API sends one
 * entry per day; long ranges are summed into weeks or months so the bars stay readable.
 */

interface ITrendDay {
  date: string; // YYYY-MM-DD
  value: number;
}

export type TTrendUnit = "day" | "week" | "month";

export interface ITrendBucket<T extends ITrendDay> {
  label: string; // for the tooltip: "Mon, 24 Oct 2026", "7 – 13 Oct 2026", "October 2026"
  axisLabel: string; // under the bar: "24 Oct", "7 Oct", "Oct"
  year: number; // a month label gets it where the year turns: "Jan '26"
  value: number;
  days: T[];
}

/** Up to ~6 weeks a bar per day, up to ~6 months a bar per week, else a bar per month. */
export const trendUnit = (dayCount: number): TTrendUnit =>
  dayCount <= 45 ? "day" : dayCount <= 200 ? "week" : "month";

/** "26 Sep – 25 Oct 2026", or with both years when they differ: "26 Oct 2025 – 25 Oct 2026". */
export const trendRange = (days: { date: string }[]) => {
  if (!days.length) return "";
  const first = dayjs(days[0].date);
  const last = dayjs(days[days.length - 1].date);
  return `${first.format(first.year() === last.year() ? "D MMM" : "D MMM YYYY")} – ${last.format("D MMM YYYY")}`;
};

const sum = <T extends ITrendDay>(days: T[]) => days.reduce((total, { value }) => total + value, 0);

export function trendBuckets<T extends ITrendDay>(days: T[]): ITrendBucket<T>[] {
  const unit = trendUnit(days.length);
  if (unit === "day")
    return days.map((day) => ({
      label: dayjs(day.date).format("ddd, D MMM YYYY"),
      axisLabel: dayjs(day.date).format("D MMM"),
      year: dayjs(day.date).year(),
      value: day.value,
      days: [day],
    }));

  if (unit === "week") {
    const weeks: ITrendBucket<T>[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      const from = dayjs(chunk[0].date);
      const to = dayjs(chunk[chunk.length - 1].date);
      weeks.push({
        label: `${from.format(from.month() === to.month() ? "D" : "D MMM")} – ${to.format("D MMM YYYY")}`,
        axisLabel: from.format("D MMM"),
        year: from.year(),
        value: sum(chunk),
        days: chunk,
      });
    }
    return weeks;
  }

  const months = new Map<string, T[]>();
  days.forEach((day) => {
    const key = day.date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), day]);
  });
  return [...months.entries()].map(([key, monthDays]) => {
    const month = dayjs(`${key}-01`);
    return {
      label: month.format("MMMM YYYY"),
      axisLabel: month.format("MMM"),
      year: month.year(),
      value: sum(monthDays),
      days: monthDays,
    };
  });
}

/** A round top for the y-axis; counts keep a whole middle line (max 3 -> 0, 2, 4). */
const niceMax = (max: number, integer: boolean) => {
  if (max <= 0) return integer ? 2 : 1;
  if (integer && max <= 10) return max % 2 ? max + 1 : max;
  const exp = 10 ** Math.floor(Math.log10(max));
  const step = max / exp;
  return (step <= 1 ? 1 : step <= 2 ? 2 : step <= 5 ? 5 : 10) * exp;
};

const MAX_AXIS_LABELS = 8;

interface ITrendChartProps<T extends ITrendDay> {
  days: T[];
  tooltip: (bucket: ITrendBucket<T>) => string;
  label: string; // what the chart shows, for screen readers
  formatValue?: (value: number) => string; // axis and peak labels, e.g. "190K"
}

export default function TrendChart<T extends ITrendDay>({
  days,
  tooltip,
  label,
  formatValue = String,
}: ITrendChartProps<T>) {
  const buckets = trendBuckets(days);
  const integer = days.every(({ value }) => Number.isInteger(value));
  const peak = buckets.reduce(
    (best, bucket, index) => (bucket.value > buckets[best].value ? index : best),
    0
  );
  const top = niceMax(buckets[peak]?.value ?? 0, integer);
  const ticks = [0, top / 2, top];
  const every = Math.ceil(buckets.length / MAX_AXIS_LABELS);
  const height = (value: number) => `${(value / top) * 100}%`;

  // Every few buckets gets a date; month labels add the year where it starts or turns, even when the
  // January bar itself has no label: "Oct '25", "Dec", "Feb '26".
  let lastYear: number | null = null;
  const axisLabels = buckets.map((bucket, index) => {
    if (index % every !== 0) return null;
    const withYear = trendUnit(days.length) === "month" && bucket.year !== lastYear;
    lastYear = bucket.year;
    return withYear ? `${bucket.axisLabel} '${String(bucket.year).slice(2)}` : bucket.axisLabel;
  });

  return (
    <div className={classes.chart} role="img" aria-label={label}>
      <div className={classes.yAxis}>
        {ticks.map((tick) => (
          <span key={tick} style={{ bottom: height(tick) }}>
            {formatValue(tick)}
          </span>
        ))}
      </div>

      <div className={classes.plot}>
        {ticks.map((tick) => (
          <div
            key={tick}
            className={classes.grid}
            data-baseline={tick === 0 || undefined}
            style={{ bottom: height(tick) }}
          />
        ))}
        <div className={classes.bars}>
          {buckets.map((bucket, index) => (
            <Tooltip key={bucket.label} label={tooltip(bucket)}>
              <div className={classes.slot}>
                {index === peak && bucket.value > 0 && (
                  <span className={classes.peak}>{formatValue(bucket.value)}</span>
                )}
                {bucket.value > 0 && <div className={classes.bar} style={{ height: height(bucket.value) }} />}
              </div>
            </Tooltip>
          ))}
        </div>
      </div>

      <div />
      <div className={classes.xAxis}>
        {buckets.map((bucket, index) => (
          <div key={bucket.label} className={classes.xCell}>
            {axisLabels[index] && <span>{axisLabels[index]}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
