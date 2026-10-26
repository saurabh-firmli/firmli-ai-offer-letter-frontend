import { ReactNode } from "react";
import { Avatar, Group, Text, ThemeIcon } from "@mantine/core";
import { IconBuilding } from "@tabler/icons-react";
import dayjs from "dayjs";
import { getInitials } from "../lib/auth";
import { formatDate } from "../lib/utils";

/* Cells every list table shares, so the tables read alike. */

/** The first column of a list: an icon tile, the record's name, and one dimmed line under it. */
export function EntityCell({
  icon: Icon,
  title,
  subtitle,
  color = "primary",
}: {
  icon: typeof IconBuilding;
  title: ReactNode;
  subtitle?: ReactNode;
  color?: string;
}) {
  return (
    <Group gap="sm" wrap="nowrap" miw={0}>
      <ThemeIcon size={36} radius="md" variant="light" color={color} style={{ flexShrink: 0 }}>
        <Icon size={18} stroke={1.8} />
      </ThemeIcon>
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} truncate>
          {title}
        </Text>
        {subtitle && (
          <Text size="xs" c="dimmed" truncate>
            {subtitle}
          </Text>
        )}
      </div>
    </Group>
  );
}

/** Like EntityCell, for a person (student, user): their initials in the tile; `more` adds lines under. */
export function PersonCell({
  name,
  subtitle,
  more,
  color = "primary",
}: {
  name: string;
  subtitle?: ReactNode;
  more?: ReactNode;
  color?: string;
}) {
  return (
    <Group gap="sm" wrap="nowrap" miw={0}>
      <Avatar size={36} radius="md" variant="light" color={color} style={{ flexShrink: 0 }}>
        {getInitials(name)}
      </Avatar>
      <div style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} truncate>
          {name}
        </Text>
        {subtitle && (
          <Text size="xs" c="dimmed" truncate>
            {subtitle}
          </Text>
        )}
        {more}
      </div>
    </Group>
  );
}

/** A date with its time under it, dimmed; `empty` when there is none (e.g. "Never"). */
export function DateCell({ value, empty = "—" }: { value: string | null; empty?: string }) {
  if (!value)
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    );
  return (
    <div style={{ whiteSpace: "nowrap" }}>
      <Text size="sm">{formatDate(value)}</Text>
      <Text size="xs" c="dimmed">
        {dayjs(value).format("h:mm A")}
      </Text>
    </div>
  );
}
