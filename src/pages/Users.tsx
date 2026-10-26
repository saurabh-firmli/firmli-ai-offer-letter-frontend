import { useState } from "react";
import { Avatar, Badge, Button, Card, Group, Select, Table, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useSearchParams } from "react-router";
import { IconLock, IconLockOpen, IconPlus, IconSearch, IconUsers } from "@tabler/icons-react";
import Page from "../components/Page";
import DataState from "../components/DataState";
import { SerialCell, SerialHead } from "../components/TableSerial";
import { DateCell } from "../components/TableCells";
import PageHeader from "../components/PageHeader";
import RowActions, { rowClick } from "../components/RowActions";
import { confirmDanger } from "../components/confirm";
import {
  IUser,
  TUserStatus,
  getInitials,
  useCan,
  canLogIn,
  useMe,
  userStatusColors,
  userStatusLabels,
} from "../lib/auth";
import errorHandler from "../lib/errors";
import { roleColor, useRoles } from "../lib/roles";
import { useDeleteUser, useSaveUser, useUsers } from "../lib/users";
import { toOptions } from "../lib/utils";
import UserForm from "./UserForm";
import { NO_AUTOFILL } from "../lib/forms";

export default function Users() {
  const { data: me } = useMe();
  const can = useCan();
  const [search, setSearch] = useState("");
  // In the URL, so the Roles & Permissions page can link to one role's users (?role=<id>).
  const [searchParams, setSearchParams] = useSearchParams();
  const roleId = searchParams.get("role");
  const setRoleId = (value: string | null) =>
    setSearchParams(value ? { role: value } : {}, { replace: true });
  const [status, setStatus] = useState<TUserStatus | null>(null);
  const [formOpened, formHandlers] = useDisclosure();
  const [editing, setEditing] = useState<IUser | null>(null);
  const openForm = (user: IUser | null) => {
    setEditing(user);
    formHandlers.open();
  };

  // The route already needs read permission on users (App.tsx).
  const { data: users, isLoading, error } = useUsers();
  // Only for the badge colors; the list needs Roles & Permissions read (grey badges without it).
  const roles = useRoles(can("roles", "read"));
  const deleteUser = useDeleteUser();
  const saveUser = useSaveUser();

  // Small list (one company), so search runs in the browser.
  const query = search.trim().toLowerCase();
  const shown = (users ?? []).filter(
    (user) =>
      (!query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)) &&
      (!roleId || String(user.roleId) === roleId) &&
      (!status || user.status === status)
  );
  const hasFilters = Boolean(query || roleId || status);
  // The roles the users have (no Roles & Permissions read needed).
  const roleOptions = [...new Map((users ?? []).map((user) => [user.roleId, user.roleName])).entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, name]) => ({ value: String(id), label: name }));

  const confirmDelete = (user: IUser) =>
    confirmDanger({
      title: "Remove user",
      message: (
        <>
          Remove <b>{user.name}</b> ({user.email})? They are logged out right away and can't log in again.
        </>
      ),
      confirmLabel: "Remove",
      onConfirm: () =>
        deleteUser.mutate(user.id, {
          onSuccess: () => notifications.show({ color: "green", title: "User removed", message: user.name }),
          onError: (err) => errorHandler(err, "Could not remove user"),
        }),
    });

  // Block keeps the user in the list without access; they are logged out on their next request.
  // Any other status (banned, deactivated, ...) is set on the edit form; Activate gives access back.
  const confirmBlock = (user: IUser) =>
    confirmDanger({
      title: "Block user",
      message: (
        <>
          Block <b>{user.name}</b>? They can't log in until unblocked, and are logged out right away if they
          are using the app.
        </>
      ),
      confirmLabel: "Block",
      onConfirm: () => setUserStatus(user, "blocked"),
    });

  const setUserStatus = (user: IUser, next: TUserStatus) =>
    saveUser.mutate(
      { id: user.id, status: next },
      {
        onSuccess: () =>
          notifications.show({
            color: "green",
            title: next === "active" ? "User activated" : `User ${userStatusLabels[next].toLowerCase()}`,
            message: user.name,
          }),
        onError: (err) => errorHandler(err, "Could not change the user's status"),
      }
    );

  return (
    <Page>
      <PageHeader
        title="Users"
        description={`People at ${me?.tenant?.name ?? "your company"} who can log in.`}
        action={
          // A new user needs a role, and picking one needs Roles & Permissions read.
          can("users", "create") &&
          can("roles", "read") && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => openForm(null)}>
              New User
            </Button>
          )
        }
      />

      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Group p="md">
          <TextInput
            placeholder="Search by name or email"
            {...NO_AUTOFILL}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            style={{ flex: 1, maxWidth: 420 }}
          />
          <Select
            placeholder="All roles"
            data={roleOptions}
            value={roleId}
            onChange={setRoleId}
            clearable
            w={{ base: "100%", sm: 200 }}
          />
          <Select
            placeholder="All statuses"
            data={toOptions(userStatusLabels)}
            value={status}
            onChange={(value) => setStatus(value as TUserStatus | null)}
            clearable
            w={{ base: "100%", sm: 170 }}
          />
        </Group>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load users"
          isEmpty={!shown.length}
          emptyIcon={IconUsers}
          emptyTitle={hasFilters ? "No users match your filters" : "No users yet"}
        >
          <Table.ScrollContainer minWidth={920}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>User</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last Login</Table.Th>
                  <Table.Th>Added</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {shown.map((user, index) => {
                  const isSelf = user.id === me?.id;
                  // Only a Super Admin may change or remove a Super Admin (the API refuses anyone else).
                  const locked = user.role === "super_admin" && me?.role !== "super_admin";
                  const active = canLogIn(user.status);
                  // Nobody can change their own status.
                  const canSetStatus = can("users", "update") && !locked && !isSelf;
                  return (
                    <Table.Tr
                      key={user.id}
                      {...rowClick(can("users", "update") && !locked ? () => openForm(user) : undefined)}
                    >
                      <SerialCell index={index} />
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar radius="md" size={36} color={active ? "primary" : "gray"} variant="light">
                            {getInitials(user.name)}
                          </Avatar>
                          <div>
                            <Group gap={6} wrap="nowrap">
                              <Text size="sm" fw={600}>
                                {user.name}
                              </Text>
                              {isSelf && (
                                <Badge size="xs" variant="outline" color="gray">
                                  You
                                </Badge>
                              )}
                            </Group>
                            <Text size="xs" c="dimmed">
                              {user.email}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={roleColor(roles.data?.roles, user.role)}>
                          {user.roleName}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={userStatusColors[user.status]}>
                          {userStatusLabels[user.status]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <DateCell value={user.lastLoginAt} empty="Never" />
                      </Table.Td>
                      <Table.Td>
                        <DateCell value={user.createdAt} />
                      </Table.Td>
                      <Table.Td>
                        <RowActions
                          name={user.name}
                          deleteLabel="Remove"
                          deleteDisabledReason={isSelf ? "You can't remove yourself" : undefined}
                          onEdit={can("users", "update") && !locked ? () => openForm(user) : undefined}
                          onDelete={can("users", "delete") && !locked ? () => confirmDelete(user) : undefined}
                          extra={
                            canSetStatus
                              ? [
                                  active
                                    ? { label: "Block", icon: IconLock, onClick: () => confirmBlock(user) }
                                    : {
                                        label: "Activate",
                                        icon: IconLockOpen,
                                        color: "green",
                                        onClick: () => setUserStatus(user, "active"),
                                      },
                                ]
                              : []
                          }
                        />
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </DataState>
      </Card>

      <UserForm
        opened={formOpened}
        user={editing}
        isSelf={editing?.id === me?.id}
        onClose={formHandlers.close}
      />
    </Page>
  );
}
