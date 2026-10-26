import {
  ActionIcon,
  Button,
  AppShell,
  Avatar,
  Burger,
  Group,
  Menu,
  NavLink,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconArrowBackUp,
  IconBuilding,
  IconBuildingCommunity,
  IconChevronDown,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconShieldCheck,
  IconUser,
  IconSwitchHorizontal,
} from "@tabler/icons-react";
import { APP_NAME, APP_TAGLINE } from "../config";
import { useDisclosure, useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { Link, Navigate, NavLink as RouterNavLink, Outlet, useLocation } from "react-router";
import { navSections } from "./navItems";
import { getInitials, logOut, useCan, useMe } from "../lib/auth";
import { useLiveUpdates } from "../lib/live";
import { getToken } from "../lib/session";
import { RO_LOGIN, RO_PLATFORM, RO_PROFILE } from "../routes";
import HealthBadge from "./HealthBadge";
import AppLoader from "../components/AppLoader";
import NotificationBell from "../components/NotificationBell";
import StaffSwitcher, { backToFirmli, canSwitch, isStaffSwitched } from "../components/StaffSwitcher";
import classes from "./MainLayout.module.css";

const HEADER_HEIGHT = 56; // same as .brand in MainLayout.module.css, so their bottom lines meet
const NAVBAR_WIDTH = 248;
const RAIL_WIDTH = 72; // collapsed sidebar: icons only

// The app itself: only for a logged in user.
export default function MainLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const [switcherOpened, switcher] = useDisclosure();
  const switched = isStaffSwitched(); // Firmli staff viewing as a client's user
  // Remembered per browser; mobile always uses the full menu in its slide-in panel.
  const [collapsed, setCollapsed] = useLocalStorage({
    key: "firmli-sidebar-collapsed",
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  const isMobile = useMediaQuery("(max-width: 48em)");
  const rail = collapsed && !isMobile;
  const { pathname, search } = useLocation();
  // An expired token answers 401 here, and lib/api.ts then sends the user to login.
  const { data: user, isLoading, error, refetch } = useMe();
  useLiveUpdates(user?.id); // one live updates stream while logged in
  const can = useCan();

  if (!getToken()) {
    return <Navigate to={`${RO_LOGIN}?next=${encodeURIComponent(pathname + search)}`} replace />;
  }

  if (isLoading) return <AppLoader />;

  // The user couldn't be loaded (server down, no network): say so on the whole screen, with Try
  // Again, instead of an app shell with nobody logged in.
  if (!user && error) return <AppLoader error={error} onRetry={() => void refetch()} />;

  // Entries of a module the role can't read are hidden; sections left empty are dropped.
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.module || can(item.module, "read")),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <AppShell
      layout="alt"
      header={{ height: HEADER_HEIGHT }}
      navbar={{ width: rail ? RAIL_WIDTH : NAVBAR_WIDTH, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding={0}
    >
      <AppShell.Header className={classes.header}>
        {/* Search and notifications come back once their APIs exist; a control that does nothing misleads. */}
        <Group h="100%" px={{ base: "md", sm: "lg" }} justify="space-between" wrap="nowrap" gap="md">
          <Group gap="sm" wrap="nowrap" miw={0}>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Tooltip label={collapsed ? "Expand menu" : "Collapse menu"} withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                visibleFrom="sm"
                aria-label={collapsed ? "Expand menu" : "Collapse menu"}
                onClick={() => setCollapsed((value) => !value)}
              >
                {collapsed ? (
                  <IconLayoutSidebarLeftExpand size={20} />
                ) : (
                  <IconLayoutSidebarLeftCollapse size={20} />
                )}
              </ActionIcon>
            </Tooltip>
            {/* The user's company (tenant): everything on screen belongs to it. */}
            <ThemeIcon variant="light" size={28} radius="md">
              <IconBuilding size={16} stroke={1.7} />
            </ThemeIcon>
            <Text fw={600} truncate>
              {user?.tenant?.name}
            </Text>
          </Group>

          <Group gap="lg" wrap="nowrap">
            {/* Firmli staff seeing the app as a client's user: always one click from their own account. */}
            {switched && (
              <Tooltip label={`You are viewing as ${user?.name}. Back to your Firmli account.`}>
                <Button
                  size="xs"
                  variant="light"
                  color="orange"
                  leftSection={<IconArrowBackUp size={14} />}
                  onClick={backToFirmli}
                >
                  Back to Firmli
                </Button>
              </Tooltip>
            )}
            <NotificationBell />
            <Menu position="bottom-end" width={260} offset={6}>
              <Menu.Target>
                <UnstyledButton className={classes.userButton} aria-label="Account menu">
                  <Group gap="sm" wrap="nowrap">
                    <Avatar color="primary" variant="filled" radius="xl" size={32}>
                      {getInitials(user?.name ?? "")}
                    </Avatar>
                    <Stack gap={0} visibleFrom="sm">
                      <Text fw={600} size="sm" lh={1.3}>
                        {user?.name}
                      </Text>
                      <Text size="xs" c="dimmed" lh={1.3}>
                        {user?.roleName}
                      </Text>
                    </Stack>
                    <IconChevronDown size={16} color="var(--mantine-color-dimmed)" />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Stack gap={0} px="sm" py={8}>
                  <Text fw={600} size="sm" truncate>
                    {user?.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {user?.email}
                  </Text>
                </Stack>
                <Menu.Divider />
                <Menu.Item leftSection={<IconUser size={16} />} component={Link} to={RO_PROFILE}>
                  My Profile
                </Menu.Item>
                {canSwitch(user) && (
                  <>
                    <Menu.Item
                      leftSection={<IconBuildingCommunity size={16} />}
                      component={Link}
                      to={RO_PLATFORM}
                    >
                      Platform Admin
                    </Menu.Item>
                    <Menu.Item leftSection={<IconSwitchHorizontal size={16} />} onClick={switcher.open}>
                      Switch tenant / user
                    </Menu.Item>
                  </>
                )}
                {switched && (
                  <Menu.Item leftSection={<IconArrowBackUp size={16} />} onClick={backToFirmli}>
                    Back to Firmli
                  </Menu.Item>
                )}
                <Menu.Item leftSection={<IconLogout size={16} />} color="red" onClick={() => void logOut()}>
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            {canSwitch(user) && (
              <StaffSwitcher opened={switcherOpened} onClose={switcher.close} currentUserId={user?.id} />
            )}
          </Group>
        </Group>
      </AppShell.Header>

      {/* data-rail: collapsed to icons; labels then show as tooltips. */}
      <AppShell.Navbar className={classes.navbar} data-rail={rail || undefined}>
        <AppShell.Section>
          <Group className={classes.brand} gap="sm" wrap="nowrap">
            <div className={classes.brandLogo}>
              <IconShieldCheck size={20} />
            </div>
            {!rail && (
              <Stack gap={0} miw={0}>
                <Text c="white" fw={700} size="md" lh={1.3}>
                  {APP_NAME}
                </Text>
                <Text c="gray.4" size="xs" lh={1.3} truncate>
                  {APP_TAGLINE}
                </Text>
              </Stack>
            )}
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" color="white" ml="auto" />
          </Group>
        </AppShell.Section>

        <AppShell.Section grow component={ScrollArea} scrollbars="y" px={rail ? "xs" : "sm"} py="sm">
          {visibleSections.map((section) => (
            <div key={section.title} className={classes.navSection}>
              {rail ? (
                <div className={classes.railDivider} />
              ) : (
                <Text className={classes.navSectionTitle}>{section.title}</Text>
              )}
              {section.items.map(({ label, to, icon: Icon, soon }) => {
                const link = (
                  <NavLink
                    key={to}
                    component={RouterNavLink}
                    to={to}
                    label={rail ? undefined : label}
                    aria-label={label}
                    active={pathname === to || pathname.startsWith(`${to}/`)}
                    leftSection={<Icon size={18} stroke={1.7} />}
                    rightSection={!rail && soon && <span className={classes.soonTag}>Soon</span>}
                    data-soon={soon || undefined}
                    classNames={{
                      root: classes.navLink,
                      label: classes.navLabel,
                      section: classes.navIcon,
                      body: classes.navBody,
                    }}
                    onClick={close}
                  />
                );
                return rail ? (
                  <Tooltip key={to} label={soon ? `${label} · Soon` : label} position="right" withArrow>
                    {link}
                  </Tooltip>
                ) : (
                  link
                );
              })}
            </div>
          ))}
        </AppShell.Section>

        <AppShell.Section className={classes.navFooter}>
          {rail ? (
            <HealthBadge compact />
          ) : (
            <Stack gap={4}>
              <HealthBadge />
              <Text c="gray.6" size="xs">
                v0.1.0 — {APP_NAME}
              </Text>
            </Stack>
          )}
        </AppShell.Section>
      </AppShell.Navbar>

      <AppShell.Main className={classes.main}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
