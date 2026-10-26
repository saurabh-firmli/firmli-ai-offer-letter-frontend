import { useEffect, useState } from "react";
import { Badge, Button, Group, Select, SimpleGrid, Stack, Table, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconMail, IconUser, IconUserPlus } from "@tabler/icons-react";
import ErrorState from "../components/ErrorState";
import FormActions from "../components/FormActions";
import FormDrawer from "../components/FormDrawer";
import FormModal from "../components/FormModal";
import { Field } from "../components/Field";
import FormSection from "../components/FormSection";
import TempPasswordInput from "../components/TempPasswordInput";
import { FormSkeleton } from "../components/Skeletons";
import StatusDot from "../components/StatusDot";
import { DateCell, PersonCell } from "../components/TableCells";
import { NAME_MAX, PASSWORD_MAX, PASSWORD_MIN, userStatusColors, userStatusLabels } from "../lib/auth";
import { NO_AUTOFILL, applyFormError, useResetOnOpen } from "../lib/forms";
import {
  ITenant,
  tenantStatusColors,
  tenantStatusLabels,
  useAddTenantUser,
  usePlatformOptions,
  useTenant,
} from "../lib/platform";
import { formatDateTime, isEmail, toIdOptions } from "../lib/utils";
import ShareLoginDetails, { ILoginDetails } from "./ShareLoginDetails";

/** A tenant's status; Firmli's own tenant shows as Firmli (it can't be blocked). */
export function TenantStatusBadge({ tenant }: { tenant: Pick<ITenant, "isPlatform" | "status"> }) {
  return tenant.isPlatform ? (
    <Badge variant="light" color="violet">
      Firmli
    </Badge>
  ) : (
    <Badge variant="light" color={tenantStatusColors[tenant.status]}>
      {tenantStatusLabels[tenant.status]}
    </Badge>
  );
}

const empty = { name: "", email: "", roleId: "", password: "" };

/** Add a user to a client tenant, as on its own Users page; the login details are shown once after. */
function AddTenantUserForm({ tenant, onClose }: { tenant: ITenant | null; onClose: () => void }) {
  const add = useAddTenantUser();
  const options = usePlatformOptions(Boolean(tenant));
  const [created, setCreated] = useState<ILoginDetails | null>(null);
  const form = useForm({
    initialValues: empty,
    validate: {
      name: (value) => (value.trim() ? null : "Name is required"),
      email: (value) => (isEmail(value) ? null : "Enter a valid email"),
      roleId: (value) => (value ? null : "Select a role"),
      password: (value) =>
        value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX
          ? null
          : `Use ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`,
    },
  });
  // Keyed on the tenant's id, not the object: adding a user reloads the tenant (a new object), which
  // must not wipe the login details just shown.
  const tenantId = tenant?.id ?? null;
  useResetOnOpen(form, Boolean(tenant), tenantId, empty);
  useEffect(() => {
    if (tenantId) setCreated(null);
  }, [tenantId]);

  const handleSubmit = form.onSubmit((values) => {
    if (!tenant) return;
    add.mutate(
      {
        tenantId: tenant.id,
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
        roleId: Number(values.roleId),
      },
      {
        onSuccess: (user) => {
          notifications.show({
            color: "green",
            title: "User added",
            message: `${user.name} · ${tenant.name}`,
          });
          setCreated({
            tenantId: tenant.id,
            id: user.id,
            name: user.name,
            email: user.email,
            password: values.password,
            company: tenant.name,
          });
        },
        // 409 = the email belongs to a user (in any tenant).
        onError: (error) =>
          applyFormError(form, error, { conflictField: "email", toastTitle: "Could not add the user" }),
      }
    );
  });

  return (
    <FormModal
      opened={Boolean(tenant)}
      onClose={onClose}
      title={created ? "User Added" : "Add User"}
      description={created ? `Share these login details with ${created.name}.` : tenant?.name}
    >
      {created ? (
        <ShareLoginDetails details={created} onDone={onClose} />
      ) : (
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Full Name"
              placeholder="e.g. Riya Sharma"
              withAsterisk
              maxLength={NAME_MAX}
              leftSection={<IconUser size={16} />}
              data-autofocus
              {...NO_AUTOFILL}
              {...form.getInputProps("name")}
            />
            <TextInput
              label="Email"
              type="email"
              placeholder="e.g. riya@company.com"
              withAsterisk
              leftSection={<IconMail size={16} />}
              {...NO_AUTOFILL}
              {...form.getInputProps("email")}
            />
            <Select
              label="Role"
              withAsterisk
              placeholder={options.isLoading ? "Loading..." : "Select role"}
              data={toIdOptions(options.data?.roles)}
              {...form.getInputProps("roleId")}
            />
            <TempPasswordInput
              onGenerate={(password) => form.setFieldValue("password", password)}
              {...form.getInputProps("password")}
            />
            <FormActions onCancel={onClose} submitLabel="Add User" loading={add.isPending} />
          </Stack>
        </form>
      )}
    </FormModal>
  );
}

/** One tenant: its details and users (Super Admins first), with Add User. */
export default function TenantDetail({
  tenantId,
  onClose,
}: {
  tenantId: number | null;
  onClose: () => void;
}) {
  const tenant = useTenant(tenantId);
  const [adding, setAdding] = useState(false);
  const data = tenant.data;

  return (
    <>
      <FormDrawer
        opened={Boolean(tenantId)}
        onClose={onClose}
        title={data?.name ?? "Tenant"}
        description={
          data
            ? [data.code, data.contactEmail].filter(Boolean).join(" · ") || "Client institution"
            : undefined
        }
        onSubmit={(event) => event?.preventDefault()}
        submitLabel="Close"
        readOnly
        size={760}
      >
        {tenant.isLoading ? (
          <FormSkeleton />
        ) : tenant.error || !data ? (
          <ErrorState error={tenant.error} title="Could not load the tenant" />
        ) : (
          <>
            <FormSection title="Overview">
              <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
                <Field label="Status">
                  <TenantStatusBadge tenant={data} />
                </Field>
                <Field label="Users">{`${data.activeUserCount} active of ${data.userCount}`}</Field>
                <Field label="Applications">{String(data.applicationCount)}</Field>
                <Field label="Last Login">
                  {data.lastLoginAt ? formatDateTime(data.lastLoginAt) : "Never"}
                </Field>
                <Field label="Created">{formatDateTime(data.createdAt)}</Field>
                <Field label="Contact Email">{data.contactEmail}</Field>
              </SimpleGrid>
            </FormSection>

            <FormSection
              title={`Users (${data.users?.length ?? 0})`}
              action={
                <Button size="xs" leftSection={<IconUserPlus size={14} />} onClick={() => setAdding(true)}>
                  Add User
                </Button>
              }
            >
              <Table.ScrollContainer minWidth={560}>
                <Table verticalSpacing="sm" horizontalSpacing="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>User</Table.Th>
                      <Table.Th>Role</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Last Login</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(data.users ?? []).map((user) => (
                      <Table.Tr key={user.id}>
                        <Table.Td>
                          <PersonCell name={user.name} subtitle={user.email} />
                        </Table.Td>
                        <Table.Td>{user.roleName}</Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="nowrap">
                            <StatusDot color={userStatusColors[user.status]} />
                            <Text size="sm">{userStatusLabels[user.status]}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <DateCell value={user.lastLoginAt} empty="Never" />
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </FormSection>
          </>
        )}
      </FormDrawer>
      <AddTenantUserForm tenant={adding ? (data ?? null) : null} onClose={() => setAdding(false)} />
    </>
  );
}
