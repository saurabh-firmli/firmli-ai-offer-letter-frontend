import {
  ActionIcon,
  Badge,
  Group,
  Indicator,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconBell, IconChecks, IconChevronRight } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { notificationLinks, useNotifications } from "../lib/notifications";

/**
 * The topbar bell: what needs the user's attention, as counts (checked every 45 seconds and after
 * actions). The total shows on the bell; each item with a count opens its list, already filtered.
 */
export default function NotificationBell() {
  const navigate = useNavigate();
  const { data } = useNotifications();
  const total = data?.total ?? 0;
  const items = (data?.items ?? []).filter(({ count }) => count > 0);

  return (
    <Menu position="bottom-end" width={320} shadow="md" radius="md">
      <Menu.Target>
        <Tooltip label="Notifications" disabled={total > 0}>
          <Indicator
            label={total > 99 ? "99+" : total}
            size={18}
            color="red"
            offset={6}
            disabled={total === 0}
            styles={{ indicator: { fontWeight: 700, fontSize: 10 } }}
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              radius="md"
              aria-label={total ? `Notifications: ${total} need attention` : "Notifications"}
            >
              <IconBell size={20} />
            </ActionIcon>
          </Indicator>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown p={0}>
        <Group
          justify="space-between"
          px="md"
          py="sm"
          style={{ borderBottom: "1px solid var(--firmli-border-lighter)" }}
        >
          <Text fw={600} size="sm">
            Notifications
          </Text>
          {total > 0 && (
            <Badge variant="light" color="red" size="sm">
              {total}
            </Badge>
          )}
        </Group>
        {items.length ? (
          <Stack gap={0} py={4}>
            {items.map(({ code, label, count }) => {
              const to = notificationLinks[code];
              return (
                <Menu.Item key={code} onClick={() => to && navigate(to)} disabled={!to} py="sm">
                  <Group justify="space-between" wrap="nowrap" gap="sm">
                    <Text size="sm">{label}</Text>
                    <Group gap={6} wrap="nowrap">
                      <Badge variant="light" color="primary" size="sm">
                        {count}
                      </Badge>
                      {to && <IconChevronRight size={14} color="var(--mantine-color-dimmed)" />}
                    </Group>
                  </Group>
                </Menu.Item>
              );
            })}
          </Stack>
        ) : (
          <UnstyledButton component="div" w="100%" style={{ cursor: "default" }}>
            <Stack align="center" gap={6} py="lg">
              <IconChecks size={24} color="var(--mantine-color-green-6)" />
              <Text size="sm" c="dimmed">
                You&apos;re all caught up.
              </Text>
            </Stack>
          </UnstyledButton>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
