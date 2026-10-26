import { useEffect, useState } from "react";
import {
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Stack,
  Switch,
  Table,
  Text,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconEdit, IconLock, IconRestore, IconShieldLock, IconUsers } from "@tabler/icons-react";
import { Link } from "react-router";
import Page from "../components/Page";
import PermissionTick from "../components/PermissionTick";
import DataState from "../components/DataState";
import PageHeader from "../components/PageHeader";
import { SidePanel, SidePanelItem, SidePanelList } from "../components/SidePanel";
import { CardSkeleton, ListSkeleton } from "../components/Skeletons";
import { confirmDanger } from "../components/confirm";
import { TAction, TModule, TPermissions, useCan, useMe } from "../lib/auth";
import errorHandler from "../lib/errors";
import {
  IRole,
  IRoleModule,
  IRolesData,
  roleColor,
  roleIcon,
  useRoles,
  useResetRolePermissions,
  useSaveRolePermissions,
  PERMISSION_ACTIONS,
  accessSummary,
} from "../lib/roles";
import { navItems } from "../layout/navItems";
import { RO_USERS } from "../routes";

const ACTIONS = PERMISSION_ACTIONS;

type TSwitches = Record<TAction, boolean>;
type TDraft = Partial<Record<TModule, TSwitches>>;

const NONE: TSwitches = { create: false, read: false, update: false, delete: false };

/** Every module's four switches (a module missing from the role = all off), for editing. */
const toDraft = (role: IRole, modules: IRoleModule[]): TDraft =>
  Object.fromEntries(modules.map(({ code }) => [code, { ...NONE, ...role.permissions[code] }]));

const sameSwitches = (a: TSwitches, b: TSwitches) => ACTIONS.every(({ action }) => a[action] === b[action]);

// The sidebar's icon for each module, so a module looks the same everywhere.
const moduleIcon = (module: TModule) =>
  navItems.find((item) => item.module === module)?.icon ?? IconShieldLock;

interface IRoleDetailProps {
  role: IRole;
  data: IRolesData;
  userCount?: number; // from GET /roles
  canSeeUsers: boolean; // Users read: the count links to the Users list, filtered by the role
  onDirtyChange: (dirty: boolean) => void;
}

/** The chosen role: who it is for, its users, and what it may do in each module (editable in place). */
function RoleDetail({ role, data, userCount, canSeeUsers, onDirtyChange }: IRoleDetailProps) {
  const can = useCan();
  const save = useSaveRolePermissions();
  const reset = useResetRolePermissions();
  const Icon = roleIcon(data.roles, role.code);
  const { data: me } = useMe();
  const isSuperAdmin = me?.role === "super_admin";
  // Anyone but a Super Admin: not their own role, and only what they may do themselves (the API
  // answers 403 to the rest). Turning a switch off is always fine.
  const ownRole = !isSuperAdmin && me?.roleId === role.id;
  const canEdit = can("roles", "update") && role.editable && !ownRole;
  const mayGive = (module: TModule, action: TAction) => isSuperAdmin || can(module, action);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TDraft>(() => toDraft(role, data.modules));
  const saved = toDraft(role, data.modules);
  const changed = data.modules.filter(({ code }) => !sameSwitches(draft[code] ?? NONE, saved[code] ?? NONE));

  useEffect(() => onDirtyChange(editing && changed.length > 0), [editing, changed.length, onDirtyChange]);

  const startEditing = () => {
    setDraft(toDraft(role, data.modules));
    setEditing(true);
  };

  // Off with View turns everything off; any other switch on needs View on (else the API answers 422).
  const toggle = (module: TModule, action: TAction, on: boolean) =>
    setDraft((current) => {
      const switches = { ...(current[module] ?? NONE), [action]: on };
      if (action === "read" && !on) Object.assign(switches, NONE);
      if (action !== "read" && on) switches.read = true;
      return { ...current, [module]: switches };
    });

  // Drops your company's changes to this role (only a customized one has any).
  const confirmReset = () =>
    confirmDanger({
      title: "Reset to defaults",
      message: (
        <>
          Reset <b>{role.name}</b> to the default permissions? Your company&apos;s changes to this role are
          removed, for every {role.name} user at once.
        </>
      ),
      confirmLabel: "Reset",
      onConfirm: () =>
        reset.mutate(role.id, {
          onSuccess: (updated) =>
            notifications.show({ color: "green", title: "Permissions reset", message: updated.name }),
          onError: (error) => errorHandler(error, "Could not reset the permissions"),
        }),
    });

  const handleSave = () => {
    if (!changed.length) {
      setEditing(false);
      return;
    }
    // Only the changed modules, each with all four switches; the others stay as they are.
    const permissions: TPermissions = Object.fromEntries(changed.map(({ code }) => [code, draft[code]]));
    save.mutate(
      { id: role.id, permissions },
      {
        onSuccess: (updated) => {
          notifications.show({ color: "green", title: "Permissions updated", message: updated.name });
          setEditing(false);
        },
        onError: (error) => errorHandler(error, "Could not save permissions"),
      }
    );
  };

  return (
    <Stack gap="lg">
      {/* One card: the role in a compact header, its permissions right under it. */}
      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Group
          justify="space-between"
          align="center"
          wrap="nowrap"
          gap="md"
          p="lg"
          style={{ borderBottom: "1px solid var(--firmli-divider)" }}
        >
          <Group gap="md" wrap="nowrap" miw={0}>
            <ThemeIcon size={44} radius="md" variant="light" color={roleColor(data.roles, role.code)}>
              <Icon size={24} />
            </ThemeIcon>
            <div style={{ minWidth: 0 }}>
              <Group gap="xs">
                <Title order={3} fz={18}>
                  {role.name}
                </Title>
                {role.customized && (
                  <Badge variant="light" color="orange" size="sm">
                    Custom
                  </Badge>
                )}
                {!role.editable && (
                  <Badge variant="light" color="gray" size="sm" leftSection={<IconLock size={12} />}>
                    Locked
                  </Badge>
                )}
              </Group>
              {/* What it is for and who has it, on one line. */}
              <Group gap={6} mt={2} wrap="wrap">
                {role.description && (
                  <Text size="sm" c="dimmed">
                    {role.description}
                  </Text>
                )}
                {userCount !== undefined && (
                  <>
                    {role.description && (
                      <Text size="sm" c="dimmed">
                        ·
                      </Text>
                    )}
                    <IconUsers size={14} color="var(--mantine-color-dimmed)" />
                    {userCount > 0 && canSeeUsers ? (
                      <Anchor component={Link} to={`${RO_USERS}?role=${role.id}`} size="sm">
                        {userCount} {userCount === 1 ? "user" : "users"}
                      </Anchor>
                    ) : userCount > 0 ? (
                      <Text size="sm" c="dimmed">
                        {userCount} {userCount === 1 ? "user" : "users"}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        No users yet
                      </Text>
                    )}
                  </>
                )}
              </Group>
              {editing && (
                <Text size="xs" c="dimmed" mt={6}>
                  Turning off View also turns off Add, Edit and Delete. Changes apply to {role.name} users at
                  once, in your company only.
                </Text>
              )}
            </div>
          </Group>
          {canEdit && !editing && (
            <Group gap="xs" wrap="nowrap">
              {role.customized && (
                <Button
                  variant="tertiary"
                  leftSection={<IconRestore size={16} />}
                  onClick={confirmReset}
                  loading={reset.isPending}
                >
                  Reset to Defaults
                </Button>
              )}
              <Button variant="secondary" leftSection={<IconEdit size={16} />} onClick={startEditing}>
                Edit Permissions
              </Button>
            </Group>
          )}
          {editing && (
            <Badge variant="light" color="primary" size="lg" radius="sm">
              Editing
            </Badge>
          )}
          {ownRole && can("roles", "update") && role.editable && (
            <Text size="sm" c="dimmed" ta="right" maw={260}>
              This is your own role: a Super Admin changes its permissions.
            </Text>
          )}
        </Group>
        <Table.ScrollContainer minWidth={620}>
          <Table verticalSpacing="sm" horizontalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Module</Table.Th>
                <Table.Th w={130}>Access</Table.Th>
                {ACTIONS.map(({ action, label }) => (
                  <Table.Th key={action} w={80} ta="center">
                    {label}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.modules.map((module) => {
                const ModuleIcon = moduleIcon(module.code);
                const switches = (editing ? draft : saved)[module.code] ?? NONE;
                const allowed = ACTIONS.filter(({ action }) => switches[action]).map(({ action }) => action);
                const summary = accessSummary(allowed, module.actions);
                return (
                  <Table.Tr key={module.code}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <ModuleIcon size={18} color="var(--mantine-color-dimmed)" />
                        <div>
                          <Text fw={600} size="sm" c={allowed.length ? undefined : "dimmed"}>
                            {module.name}
                          </Text>
                          {/* The API decides whose logs a role sees. */}
                          {module.code === "audit_logs" && allowed.length > 0 && (
                            <Text size="xs" c="dimmed">
                              {role.code === "super_admin" ? "Everyone's changes" : "Only their own changes"}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={summary.color}>
                        {summary.label}
                      </Badge>
                    </Table.Td>
                    {ACTIONS.map(({ action, label }) => {
                      // An action the module doesn't have (e.g. Add on Audit Logs).
                      const exists = module.actions.includes(action);
                      // Off and not yours to give: it can't be turned on.
                      const notYours = exists && !switches[action] && !mayGive(module.code, action);
                      return (
                        <Table.Td key={action} ta="center">
                          {editing ? (
                            <Group justify="center">
                              <Tooltip
                                label="You can only give permissions your own role has"
                                disabled={!notYours}
                                withArrow
                              >
                                <span>
                                  <Switch
                                    checked={switches[action]}
                                    disabled={!exists || notYours}
                                    onChange={(event) =>
                                      toggle(module.code, action, event.currentTarget.checked)
                                    }
                                    aria-label={`${module.name}: ${label}`}
                                  />
                                </span>
                              </Tooltip>
                            </Group>
                          ) : (
                            exists && <PermissionTick allowed={switches[action]} label={label} />
                          )}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Group
          justify="space-between"
          gap="sm"
          p="md"
          style={{ borderTop: "1px solid var(--firmli-divider)" }}
        >
          <Group gap={6} wrap="nowrap">
            <IconLock size={14} color="var(--mantine-color-dimmed)" />
            <Text size="sm" c="dimmed">
              {role.editable
                ? "Each company can change these for itself; every change is in the Audit Log."
                : "The Super Admin always has full access, so a company can't lock itself out."}
            </Text>
          </Group>
          {editing && (
            <Group gap="sm" wrap="nowrap">
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={save.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSave} loading={save.isPending}>
                Save Changes
              </Button>
            </Group>
          )}
        </Group>
      </Card>
    </Stack>
  );
}

/** Roles on the left, the chosen role's permissions on the right (GET /roles). */
export default function Roles() {
  const can = useCan();
  const { data, isLoading, error } = useRoles();
  // User counts only with Users read.
  const canSeeUsers = can("users", "read");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  const query = search.trim().toLowerCase();
  const shown = (data?.roles ?? []).filter(
    (role) =>
      !query || role.name.toLowerCase().includes(query) || role.description?.toLowerCase().includes(query)
  );
  const selected = data?.roles.find(({ id }) => id === selectedId);
  const userCount = (role: IRole) => role.userCount;

  // Open the first role once they load.
  useEffect(() => {
    if (!selectedId && data?.roles.length) setSelectedId(data.roles[0].id);
  }, [data, selectedId]);

  // Unsaved switches are lost when another role opens, so ask first.
  const select = (id: number) => {
    if (id === selectedId) return;
    if (!dirty) return setSelectedId(id);
    confirmDanger({
      title: "Discard changes",
      message: `Your permission changes for ${selected?.name} are not saved.`,
      confirmLabel: "Discard",
      onConfirm: () => {
        setDirty(false);
        setSelectedId(id);
      },
    });
  };

  return (
    <Page>
      <PageHeader
        title="Roles & Permissions"
        description="What each role can do in the app. Pick a role to see its access."
      />

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 4, xl: 3 }}>
          <SidePanel search={search} onSearch={setSearch} searchPlaceholder="Search roles">
            <DataState
              isLoading={isLoading}
              skeleton={<ListSkeleton rows={5} />}
              error={error}
              errorTitle="Could not load roles"
              isEmpty={!shown.length}
              emptyIcon={IconShieldLock}
              emptyTitle={query ? "No roles match your search" : "No roles yet"}
            >
              <SidePanelList>
                {shown.map((role) => {
                  const Icon = roleIcon(data?.roles, role.code);
                  const count = userCount(role);
                  return (
                    <SidePanelItem
                      key={role.id}
                      active={role.id === selectedId}
                      onClick={() => select(role.id)}
                    >
                      <Group gap="sm" wrap="nowrap">
                        <ThemeIcon
                          size={34}
                          radius="md"
                          variant="light"
                          color={roleColor(data?.roles, role.code)}
                        >
                          <Icon size={18} />
                        </ThemeIcon>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <Text fw={600} truncate>
                            {role.name}
                          </Text>
                          {/* The badge sits under the name, so long names aren't cut short. */}
                          <Group gap={6} wrap="nowrap">
                            {count !== undefined && (
                              <Text size="xs" c="dimmed">
                                {count} {count === 1 ? "user" : "users"}
                              </Text>
                            )}
                            {role.customized && (
                              <Badge variant="light" color="orange" size="xs">
                                Custom
                              </Badge>
                            )}
                          </Group>
                        </div>
                        {!role.editable && <IconLock size={14} color="var(--mantine-color-dimmed)" />}
                      </Group>
                    </SidePanelItem>
                  );
                })}
              </SidePanelList>
            </DataState>
          </SidePanel>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 8, xl: 9 }}>
          {isLoading ? (
            <Card withBorder radius="lg" shadow="xs">
              <CardSkeleton />
            </Card>
          ) : (
            selected &&
            data && (
              <RoleDetail
                key={selected.id}
                role={selected}
                data={data}
                userCount={userCount(selected)}
                canSeeUsers={canSeeUsers}
                onDirtyChange={setDirty}
              />
            )
          )}
        </Grid.Col>
      </Grid>
    </Page>
  );
}
