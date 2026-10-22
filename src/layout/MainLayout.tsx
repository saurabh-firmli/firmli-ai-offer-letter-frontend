import {
  ActionIcon,
  AppShell,
  Avatar,
  Burger,
  Group,
  Indicator,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import {
  IconBell,
  IconChevronDown,
  IconLogout,
  IconSearch,
  IconShieldCheck,
  IconUser,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { NavLink as RouterNavLink, Outlet, useLocation } from "react-router";
import { navSections } from "./navItems";
import { signOut } from "../lib/session";
import HealthBadge from "./HealthBadge";
import classes from "./MainLayout.module.css";

// Sample values until auth / institution APIs exist.
const sampleInstitution = { name: "Firmli University", code: "FIRMLI" };
const sampleUser = { name: "Harinder Aulakh", role: "Institution Admin", initials: "HA" };

export default function MainLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const { pathname } = useLocation();

  return (
    <AppShell
      layout="alt"
      header={{ height: 72 }}
      navbar={{ width: 300, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding={0}
    >
      <AppShell.Header className={classes.header}>
        <Group h="100%" px="xl" justify="space-between" wrap="nowrap" gap="md">
          <Group wrap="nowrap" style={{ flex: 1 }}>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <TextInput
              className={classes.search}
              placeholder="Search applications, students..."
              leftSection={<IconSearch size={18} />}
              variant="filled"
              size="md"
              visibleFrom="sm"
            />
          </Group>

          <Group gap="lg" wrap="nowrap">
            <Stack gap={0} align="flex-end" visibleFrom="md">
              <Text fw={600}>{sampleInstitution.name}</Text>
              <Text size="xs" c="dimmed">
                {sampleInstitution.code}
              </Text>
            </Stack>

            <Indicator color="primary" size={9} offset={4}>
              <ActionIcon variant="subtle" color="dark" size="lg" aria-label="Notifications">
                <IconBell size={20} />
              </ActionIcon>
            </Indicator>

            <Menu position="bottom-end" width={200}>
              <Menu.Target>
                <UnstyledButton>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar color="dark" variant="filled" radius="xl">
                      {sampleUser.initials}
                    </Avatar>
                    <Stack gap={0} visibleFrom="sm">
                      <Text fw={600}>{sampleUser.name}</Text>
                      <Text size="xs" c="dimmed">
                        {sampleUser.role}
                      </Text>
                    </Stack>
                    <IconChevronDown size={16} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconUser size={16} />}>Profile</Menu.Item>
                <Menu.Item
                  leftSection={<IconLogout size={16} />}
                  color="red"
                  onClick={() => signOut("logout")}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar className={classes.navbar}>
        <AppShell.Section>
          <Group className={classes.brand} gap="sm" wrap="nowrap">
            <div className={classes.brandLogo}>
              <IconShieldCheck size={24} />
            </div>
            <Stack gap={0}>
              <Text c="white" fw={700} size="lg">
                AdmitAI
              </Text>
              <Text c="gray.4" size="sm">
                Offer Letter Automation
              </Text>
            </Stack>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              color="white"
              ml="auto"
            />
          </Group>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} px="md" py="md">
          {navSections.map((section) => (
            <div key={section.title} className={classes.navSection}>
              <Text className={classes.navSectionTitle}>{section.title}</Text>
              {section.items.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  component={RouterNavLink}
                  to={to}
                  label={label}
                  active={pathname === to || pathname.startsWith(`${to}/`)}
                  leftSection={<Icon size={20} stroke={1.7} />}
                  classNames={{ root: classes.navLink, label: classes.navLabel }}
                  onClick={close}
                />
              ))}
            </div>
          ))}
        </AppShell.Section>

        <AppShell.Section className={classes.navFooter}>
          <Stack gap={6}>
            <HealthBadge />
            <Text c="gray.6" size="xs">
              v0.1.0 — Admissions Platform
            </Text>
          </Stack>
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
