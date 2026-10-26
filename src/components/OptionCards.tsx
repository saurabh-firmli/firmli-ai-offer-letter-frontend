import { ReactNode } from "react";
import { Group, Radio, SimpleGrid, Text } from "@mantine/core";
import classes from "./OptionCards.module.css";

export interface IOptionCard {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string; // a line under the label; the cards then read left to right, one per row on phones
}

interface IOptionCardsProps {
  label: string;
  data: IOptionCard[];
  value: string;
  onChange: (value: string) => void;
  description?: ReactNode;
  error?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  cols?: number; // cards per row on wider screens; default: all in one row
}

/** One choice out of a few, shown as a row of selectable cards (study mode, status, role, email server...). */
export default function OptionCards({
  label,
  data,
  value,
  onChange,
  description,
  error,
  disabled,
  required,
  cols,
}: IOptionCardsProps) {
  const described = data.some((option) => option.description);
  return (
    <Radio.Group
      label={label}
      withAsterisk={required}
      description={description}
      inputWrapperOrder={["label", "input", "description", "error"]}
      value={value}
      onChange={onChange}
      error={error}
    >
      <SimpleGrid cols={{ base: described ? 1 : 2, xs: cols ?? data.length }} spacing="xs" my={6}>
        {data.map((option) => (
          <Radio.Card
            key={option.value}
            value={option.value}
            disabled={disabled}
            withBorder={false}
            className={classes.card}
          >
            {option.description ? (
              <Group gap={10} wrap="nowrap" align="flex-start">
                {option.icon && <span className={classes.icon}>{option.icon}</span>}
                <div>
                  <Text className={classes.label}>{option.label}</Text>
                  <Text size="xs" c="dimmed">
                    {option.description}
                  </Text>
                </div>
              </Group>
            ) : (
              <Group gap={8} justify="center" wrap="nowrap">
                {option.icon && <span className={classes.icon}>{option.icon}</span>}
                <Text className={classes.label}>{option.label}</Text>
              </Group>
            )}
          </Radio.Card>
        ))}
      </SimpleGrid>
    </Radio.Group>
  );
}
