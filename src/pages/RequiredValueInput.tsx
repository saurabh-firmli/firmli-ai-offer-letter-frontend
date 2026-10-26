import { ReactNode } from "react";
import { Input, NumberInput, SimpleGrid, TagsInput, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { IconCalendar } from "@tabler/icons-react";
import dayjs from "dayjs";
import OptionCards from "../components/OptionCards";
import { TDataType, TOperator } from "../lib/eligibility";
import { toApiDate } from "../lib/utils";

interface IRequiredValueInputProps {
  dataType: TDataType;
  operator: TOperator | null;
  value: string; // the API format: "3.0", "6.0,9.0" (between), "UK,Ireland" (one of)
  onChange: (value: string) => void;
  error?: ReactNode;
}

const LABEL = "Required Value";

const toDate = (value: string | undefined) => (value ? dayjs(value).toDate() : null);

/**
 * The right control for a criterion's required value, so nobody has to type "min,max" by hand:
 * numbers, a min / max pair, a list of values, a date or date range, or Yes / No.
 */
export default function RequiredValueInput({
  dataType,
  operator,
  value,
  onChange,
  error,
}: IRequiredValueInputProps) {
  const parts = value ? value.split(",") : [];

  if (!operator) {
    return (
      <TextInput label={LABEL} withAsterisk placeholder="Select an operator first" disabled error={error} />
    );
  }

  if (dataType === "boolean") {
    return (
      <OptionCards
        label={LABEL}
        required
        data={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
        value={value}
        onChange={onChange}
        error={error}
      />
    );
  }

  if (operator === "one_of") {
    return (
      <TagsInput
        label={LABEL}
        withAsterisk
        description="Type a value and press Enter; any of them passes."
        placeholder={dataType === "number" ? "e.g. 6.5" : "e.g. UK"}
        value={parts}
        onChange={(values) =>
          onChange(
            values
              .map((item) => item.trim())
              .filter(Boolean)
              .join(",")
          )
        }
        error={error}
      />
    );
  }

  if (dataType === "date") {
    return operator === "between" ? (
      <DatePickerInput
        type="range"
        label={LABEL}
        withAsterisk
        placeholder="Select from and to dates"
        valueFormat="DD MMM YYYY"
        leftSection={<IconCalendar size={16} />}
        value={[toDate(parts[0]), toDate(parts[1])]}
        onChange={([from, to]) =>
          onChange(from || to ? `${toApiDate(from) ?? ""},${toApiDate(to) ?? ""}` : "")
        }
        error={error}
      />
    ) : (
      <DatePickerInput
        label={LABEL}
        withAsterisk
        placeholder="Select date"
        valueFormat="DD MMM YYYY"
        leftSection={<IconCalendar size={16} />}
        value={toDate(value)}
        onChange={(date) => onChange(toApiDate(date) ?? "")}
        error={error}
      />
    );
  }

  if (dataType === "number") {
    if (operator === "between") {
      // Kept as "min,max"; an empty side stays empty so the form can ask for it.
      const setPart = (index: 0 | 1, next: string | number) => {
        const pair = [parts[0] ?? "", parts[1] ?? ""];
        pair[index] = String(next);
        onChange(pair.some(Boolean) ? pair.join(",") : "");
      };
      return (
        <Input.Wrapper label={LABEL} withAsterisk error={error}>
          <SimpleGrid cols={2} spacing="xs" mt={4}>
            <NumberInput
              placeholder="Min, e.g. 6.0"
              value={parts[0] ?? ""}
              onChange={(next) => setPart(0, next)}
            />
            <NumberInput
              placeholder="Max, e.g. 9.0"
              value={parts[1] ?? ""}
              onChange={(next) => setPart(1, next)}
            />
          </SimpleGrid>
        </Input.Wrapper>
      );
    }
    return (
      <NumberInput
        label={LABEL}
        withAsterisk
        placeholder="e.g. 3.0"
        value={value}
        onChange={(next) => onChange(String(next))}
        error={error}
      />
    );
  }

  return (
    <TextInput
      label={LABEL}
      withAsterisk
      placeholder="e.g. Bachelor's degree"
      maxLength={255}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      error={error}
    />
  );
}
