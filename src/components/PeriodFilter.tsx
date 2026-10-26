import { useState } from "react";
import { Select } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import dayjs from "dayjs";
import { toApiDate } from "../lib/utils";

/* The period filter of the Dashboard and AI Usage: a preset or a custom range, never in the future. */

// "all" sends no dates: the API's default (all-time counts, a 30-day chart).
const PERIODS = [
  { value: "all", label: "All time" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];

// The APIs take a period of at most 366 days, both ends included.
const MAX_DAYS = 366;

type TRange = [Date | null, Date | null];

/** What the APIs take: YYYY-MM-DD, both days included; none = all time. */
export interface IPeriod {
  from?: string;
  to?: string;
}

/** The latest end for a range starting on `start`: today, or the 366th day, whichever is first. */
const lastAllowedDay = (start: Date) => {
  const limit = dayjs(start).add(MAX_DAYS - 1, "day");
  return (limit.isBefore(dayjs()) ? limit : dayjs()).toDate();
};

/** The last n days, ending today (also where a custom range starts). */
const lastDays = (days: number): TRange => [
  dayjs()
    .subtract(days - 1, "day")
    .toDate(),
  dayjs().toDate(),
];

const toPeriod = ([from, to]: TRange): IPeriod =>
  from && to ? { from: toApiDate(from), to: toApiDate(to) } : {};

/** Calls onChange with the dates to send; a custom range only once both ends are picked. */
export default function PeriodFilter({ onChange }: { onChange: (period: IPeriod) => void }) {
  const [preset, setPreset] = useState("all");
  const [picking, setPicking] = useState<TRange>(lastDays(30));

  const choosePreset = (value: string) => {
    setPreset(value);
    if (value === "all") onChange({});
    else onChange(toPeriod(value === "custom" ? picking : lastDays(Number(value))));
  };

  return (
    <>
      <Select
        data={PERIODS}
        value={preset}
        onChange={(value) => value && choosePreset(value)}
        allowDeselect={false}
        leftSection={<IconCalendar size={16} />}
        w={{ base: "100%", sm: 190 }}
        aria-label="Period"
      />
      {preset === "custom" && (
        <DatePickerInput
          type="range"
          allowSingleDateInRange
          placeholder="Pick dates"
          valueFormat="DD MMM YYYY"
          leftSection={<IconCalendar size={16} />}
          value={picking}
          onChange={(range) => {
            setPicking(range);
            if (range[0] && range[1]) onChange(toPeriod(range));
          }}
          // No future dates, and no more than 366 days from the first date picked.
          maxDate={picking[0] && !picking[1] ? lastAllowedDay(picking[0]) : new Date()}
          minDate={
            picking[0] && !picking[1]
              ? dayjs(picking[0])
                  .subtract(MAX_DAYS - 1, "day")
                  .toDate()
              : undefined
          }
          w={{ base: "100%", sm: 260 }}
          aria-label="Custom range"
        />
      )}
    </>
  );
}
