import { useEffect, useState } from "react";
import { Alert, Button, Card, Group, SegmentedControl, Stack, Table, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconAlertTriangle,
  IconBan,
  IconBuildingCommunity,
  IconCircleCheck,
  IconEye,
  IconPlus,
  IconSearch,
} from "@tabler/icons-react";
import { Navigate } from "react-router";
import DataState from "../components/DataState";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import ListFooter from "../components/ListFooter";
import Page from "../components/Page";
import PageHeader from "../components/PageHeader";
import RowActions, { rowClick } from "../components/RowActions";
import { canSwitch } from "../components/StaffSwitcher";
import { DateCell, EntityCell } from "../components/TableCells";
import { SerialCell, SerialHead } from "../components/TableSerial";
import { confirmDanger } from "../components/confirm";
import { useMe } from "../lib/auth";
import errorHandler from "../lib/errors";
import { ITenant, TTenantStatus, useDeleteTenant, useTenants, useUpdateTenant } from "../lib/platform";
import { RO_DASHBOARD } from "../routes";

import TenantDetail, { TenantStatusBadge } from "./TenantDetail";
import TenantForm from "./TenantForm";
import { NO_AUTOFILL } from "../lib/forms";

const PAGE_SIZE = 20;
/** Remove a tenant: the name must be typed first, since its users stop logging in at once. */
function RemoveTenantForm({ tenant, onClose }: { tenant: ITenant | null; onClose: () => void }) {
  const remove = useDeleteTenant();
  const [typed, setTyped] = useState("");
  useEffect(() => setTyped(""), [tenant]);
  const matches = Boolean(tenant) && typed.trim().toLowerCase() === tenant!.name.trim().toLowerCase();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenant || !matches) return;
    remove.mutate(tenant.id, {
      onSuccess: () => {
        notifications.show({ color: "green", title: "Tenant removed", message: tenant.name });
        onClose();
      },
      onError: (error) => errorHandler(error, `Could not remove ${tenant.name}`),
    });
  };

  return (
    <FormModal opened={Boolean(tenant)} onClose={onClose} title="Remove Tenant" description={tenant?.name}>
      <form onSubmit={handleSubmit}>
        <Stack>
          <Alert variant="light" color="red" icon={<IconAlertTriangle size={18} />}>
            {tenant?.name} and its {tenant?.userCount} users disappear and can&apos;t log in any more.
            Blocking is the safer first step: it can be undone.
          </Alert>
          <TextInput
            label={`Type "${tenant?.name}" to remove it`}
            value={typed}
            onChange={(event) => setTyped(event.currentTarget.value)}
            data-autofocus
          />
          <FormActions
            onCancel={onClose}
            submitLabel="Remove Tenant"
            loading={remove.isPending}
            disabled={!matches}
          />
        </Stack>
      </form>
    </FormModal>
  );
}

/**
 * Platform Admin, for Firmli staff only: every client tenant with its users, New Tenant, Add User,
 * Block / Unblock and Remove. The platform tenant (Firmli's own) is listed first and can't be
 * blocked or removed.
 */
export default function Platform() {
  const { data: me } = useMe();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TTenantStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const [editing, setEditing] = useState<ITenant | "new" | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<ITenant | null>(null);
  const update = useUpdateTenant();
  const { data, isLoading, error } = useTenants({
    page,
    limit: PAGE_SIZE,
    status: status === "all" ? undefined : status,
    search: debouncedSearch || undefined,
  });

  if (me && !canSwitch(me)) return <Navigate to={RO_DASHBOARD} replace />;

  const setBlocked = (tenant: ITenant, blocked: boolean) => {
    const run = () =>
      update.mutate(
        { id: tenant.id, status: blocked ? "blocked" : "active" },
        {
          onSuccess: (saved) =>
            notifications.show({
              color: blocked ? "orange" : "green",
              title: blocked ? "Tenant blocked" : "Tenant unblocked",
              message: saved.name,
            }),
          onError: (failure) =>
            errorHandler(failure, `Could not ${blocked ? "block" : "unblock"} ${tenant.name}`),
        }
      );
    if (!blocked) return run();
    confirmDanger({
      title: "Block tenant",
      message: (
        <>
          Block <b>{tenant.name}</b>? All its users are logged out at once and can&apos;t log in until it is
          unblocked. Its data stays as it is.
        </>
      ),
      confirmLabel: "Block Tenant",
      onConfirm: run,
    });
  };

  const counts = data?.counts;

  return (
    <Page>
      <PageHeader
        title="Platform Admin"
        description="Firmli staff only: the client institutions, their users and their access."
        action={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing("new")}>
            New Tenant
          </Button>
        }
      />

      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <Group gap="sm" p="md">
          <SegmentedControl
            value={status}
            onChange={(value) => {
              setStatus(value as TTenantStatus | "all");
              setPage(1);
            }}
            data={[
              { value: "all", label: counts ? `All · ${counts.active + counts.blocked}` : "All" },
              { value: "active", label: `Active${counts ? ` · ${counts.active}` : ""}` },
              { value: "blocked", label: `Blocked${counts ? ` · ${counts.blocked}` : ""}` },
            ]}
          />
          <TextInput
            placeholder="Search by name, code or contact email"
            {...NO_AUTOFILL}
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => {
              setSearch(event.currentTarget.value);
              setPage(1);
            }}
            style={{ flex: 1, minWidth: 220 }}
          />
        </Group>

        <DataState
          isLoading={isLoading}
          error={error}
          errorTitle="Could not load the tenants"
          isEmpty={!data?.items.length}
          emptyIcon={IconBuildingCommunity}
          emptyTitle={
            debouncedSearch || status !== "all" ? "No tenants match your filters" : "No tenants yet"
          }
        >
          <Table.ScrollContainer minWidth={900}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <SerialHead />
                  <Table.Th>Institution</Table.Th>
                  <Table.Th>Users</Table.Th>
                  <Table.Th>Applications</Table.Th>
                  <Table.Th>Last Login</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data?.items.map((tenant, index) => (
                  <Table.Tr key={tenant.id} {...rowClick(() => setViewing(tenant.id))}>
                    <SerialCell index={index} offset={(data.page - 1) * data.limit} />
                    <Table.Td maw={320}>
                      <EntityCell
                        icon={IconBuildingCommunity}
                        color={tenant.isPlatform ? "violet" : "primary"}
                        title={tenant.name}
                        subtitle={[tenant.code, tenant.contactEmail].filter(Boolean).join(" · ") || "—"}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {tenant.userCount}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {tenant.activeUserCount} active
                      </Text>
                    </Table.Td>
                    <Table.Td>{tenant.applicationCount}</Table.Td>
                    <Table.Td style={{ whiteSpace: "nowrap" }}>
                      <DateCell value={tenant.lastLoginAt} empty="Never" />
                    </Table.Td>
                    <Table.Td>
                      <TenantStatusBadge tenant={tenant} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="xs"
                          variant="secondary"
                          leftSection={<IconEye size={14} />}
                          onClick={() => setViewing(tenant.id)}
                        >
                          View
                        </Button>
                        <RowActions
                          name={tenant.name}
                          onEdit={() => setEditing(tenant)}
                          extra={
                            tenant.isPlatform
                              ? []
                              : [
                                  tenant.status === "blocked"
                                    ? {
                                        label: "Unblock",
                                        icon: IconCircleCheck,
                                        color: "green",
                                        onClick: () => setBlocked(tenant, false),
                                      }
                                    : {
                                        label: "Block",
                                        icon: IconBan,
                                        color: "orange",
                                        onClick: () => setBlocked(tenant, true),
                                      },
                                ]
                          }
                          onDelete={tenant.isPlatform ? undefined : () => setRemoving(tenant)}
                          deleteLabel="Remove"
                        />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </DataState>

        <ListFooter data={data} page={page} onChange={setPage} />
      </Card>

      <TenantForm
        opened={editing !== null}
        tenant={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
      />
      <TenantDetail tenantId={viewing} onClose={() => setViewing(null)} />
      <RemoveTenantForm tenant={removing} onClose={() => setRemoving(null)} />
    </Page>
  );
}
