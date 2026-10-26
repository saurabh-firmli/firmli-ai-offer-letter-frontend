import { ReactNode } from "react";
import { Card, Group, Stack, TextInput, UnstyledButton } from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import classes from "./SidePanel.module.css";
import { NO_AUTOFILL } from "../lib/forms";

/*
 * The left list of a list + detail page (eligibility sets, roles): a search box over a list of
 * items, the open one marked. On desktop it stays in view while the detail scrolls.
 */

interface ISidePanelProps {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  children: ReactNode; // a DataState around a SidePanelList
}

export function SidePanel({ search, onSearch, searchPlaceholder, children }: ISidePanelProps) {
  return (
    <Card withBorder radius="lg" shadow="xs" padding={0} className={classes.panel}>
      <Group p="md">
        <TextInput
          placeholder={searchPlaceholder}
          {...NO_AUTOFILL}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(event) => onSearch(event.currentTarget.value)}
          style={{ flex: 1 }}
        />
      </Group>
      {children}
    </Card>
  );
}

export function SidePanelList({ children }: { children: ReactNode }) {
  return (
    <Stack gap={0} pb="xs" className={classes.list}>
      {children}
    </Stack>
  );
}

interface ISidePanelItemProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export function SidePanelItem({ active, onClick, children }: ISidePanelItemProps) {
  return (
    <UnstyledButton className={classes.item} data-active={active || undefined} onClick={onClick}>
      {children}
    </UnstyledButton>
  );
}
