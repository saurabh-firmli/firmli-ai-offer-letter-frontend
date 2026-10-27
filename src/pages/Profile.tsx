import { ReactNode, useState } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import {
  IconBuilding,
  IconCalendar,
  IconCircleCheckFilled,
  IconCircleDashed,
  IconClock,
  IconDevices,
  IconEdit,
  IconId,
  IconInfoCircle,
  IconKey,
  IconListCheck,
  IconLock,
  IconLogout,
  IconMail,
  IconShieldLock,
  IconUser,
} from "@tabler/icons-react";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import Page from "../components/Page";
import { isStaffSwitched } from "../components/StaffSwitcher";
import PageHeader from "../components/PageHeader";
import {
  getInitials,
  logOutEverywhere,
  useChangePassword,
  useMe,
  useUpdateMyName,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
} from "../lib/auth";
import { confirmDanger } from "../components/confirm";
import { applyFormError, useResetOnOpen } from "../lib/forms";
import { formatDateTime, formatRelative } from "../lib/utils";
import { ACCESS_LEVELS, accessSummary } from "../lib/roles";
import MyAccessModal, { myModules } from "./MyAccessModal";
import classes from "./Profile.module.css";

/** A card heading: an icon tile, the title and one line under it. */
function CardHeading({
  icon: Icon,
  color = "primary",
  title,
  description,
}: {
  icon: typeof IconKey;
  color?: string;
  title: string;
  description: ReactNode;
}) {
  return (
    <Group justify="space-between" gap="md" mb="md" align="flex-start">
      <Group gap="sm" wrap="nowrap" style={{ flex: "1 1 260px" }}>
        <ThemeIcon size={36} radius="md" variant="light" color={color}>
          <Icon size={18} />
        </ThemeIcon>
        <div>
          <Title order={3} fz={16}>
            {title}
          </Title>
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        </div>
      </Group>
    </Group>
  );
}

/** One fact about the account in the profile card. */
function Fact({ icon: Icon, label, children }: { icon: typeof IconKey; label: string; children: ReactNode }) {
  return (
    <Group gap="sm" wrap="nowrap" className={classes.fact}>
      <ThemeIcon size={32} radius="md" variant="light" color="gray">
        <Icon size={16} />
      </ThemeIcon>
      <div style={{ minWidth: 0 }}>
        <Text size="xs" c="dimmed">
          {label}
        </Text>
        <Text size="sm" fw={600} lineClamp={2}>
          {children}
        </Text>
      </div>
    </Group>
  );
}

/** A rule the new password must meet, ticked as it is typed. */
function Rule({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <Group gap={6} wrap="nowrap">
      {met ? (
        <IconCircleCheckFilled size={16} color="var(--mantine-color-green-6)" />
      ) : (
        <IconCircleDashed size={16} color="var(--mantine-color-dimmed)" />
      )}
      <Text size="xs" c={met ? undefined : "dimmed"}>
        {children}
      </Text>
    </Group>
  );
}

/** Change my own password: this device stays logged in, the others are logged out. */
function ChangePasswordSection() {
  const change = useChangePassword();
  const form = useForm({
    initialValues: { currentPassword: "", newPassword: "", confirm: "" },
    validate: {
      currentPassword: (value) => (value ? null : "Enter your current password"),
      newPassword: (value, values) =>
        value.length < PASSWORD_MIN
          ? `Use at least ${PASSWORD_MIN} characters`
          : value.length > PASSWORD_MAX
            ? `Use at most ${PASSWORD_MAX} characters`
            : value === values.currentPassword
              ? "The new password must be different from the current one"
              : null,
      confirm: (value, values) => (value === values.newPassword ? null : "The passwords don't match"),
    },
  });
  const { currentPassword, newPassword, confirm } = form.values;

  const handleSubmit = form.onSubmit((values) =>
    change.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          form.reset();
          notifications.show({
            color: "green",
            title: "Password changed",
            message: "You stay logged in here; your other devices were logged out.",
          });
        },
        // Wrong current password, or a new one that is too short / the same: under their fields.
        onError: (error) => applyFormError(form, error, { toastTitle: "Could not change the password" }),
      }
    )
  );

  return (
    <div className={classes.section}>
      <CardHeading
        icon={IconKey}
        title="Change Password"
        description="You stay logged in here; your other devices are logged out and we email you."
      />
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <PasswordInput label="Current Password" withAsterisk {...form.getInputProps("currentPassword")} />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <PasswordInput
              label="New Password"
              placeholder={`At least ${PASSWORD_MIN} characters`}
              withAsterisk
              maxLength={PASSWORD_MAX}
              {...form.getInputProps("newPassword")}
            />
            <PasswordInput
              label="Confirm New Password"
              placeholder="Type it again"
              withAsterisk
              maxLength={PASSWORD_MAX}
              {...form.getInputProps("confirm")}
            />
          </SimpleGrid>
          <Group justify="space-between" align="flex-end" gap="md">
            <Stack gap={4}>
              <Rule met={newPassword.length >= PASSWORD_MIN}>At least {PASSWORD_MIN} characters</Rule>
              <Rule met={Boolean(newPassword) && newPassword !== currentPassword}>
                Different from the current one
              </Rule>
              <Rule met={Boolean(confirm) && confirm === newPassword}>Both new passwords match</Rule>
            </Stack>
            <Button type="submit" loading={change.isPending}>
              Change Password
            </Button>
          </Group>
        </Stack>
      </form>
    </div>
  );
}

/** Change my own name; email, role and status stay an admin's (Users page). */
function EditNameForm({ opened, name, onClose }: { opened: boolean; name: string; onClose: () => void }) {
  const update = useUpdateMyName();
  const form = useForm({
    initialValues: { name },
    validate: { name: (value) => (value.trim() ? null : "Enter your name") },
  });
  useResetOnOpen(form, opened, name, { name });

  const handleSubmit = form.onSubmit((values) =>
    update.mutate(values.name.trim(), {
      onSuccess: (user) => {
        notifications.show({ color: "green", title: "Name changed", message: user.name });
        onClose();
      },
      onError: (error) => applyFormError(form, error, { toastTitle: "Could not change your name" }),
    })
  );

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title="Edit Name"
      description="How your name shows across the app."
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Full Name"
            withAsterisk
            maxLength={NAME_MAX}
            leftSection={<IconUser size={16} />}
            data-autofocus
            {...form.getInputProps("name")}
          />
          <FormActions onCancel={onClose} submitLabel="Save Changes" loading={update.isPending} />
        </Stack>
      </form>
    </FormModal>
  );
}

/**
 * My Profile: who I am in the app, my name, password and sessions, and what my role lets me do.
 * Email and role are set by an admin on the Users page; nobody changes their own role.
 */
export default function Profile() {
  const { data: me } = useMe();
  const [editingName, setEditingName] = useState(false);
  const [viewingAccess, setViewingAccess] = useState(false);
  if (!me) return null;
  // Firmli staff viewing as this user leave the client's own account details alone.
  const switched = isStaffSwitched();
  const company = me.tenant?.name ?? "your company";

  // How much the role may do, per module: the counts here, the ticks in the Your Access modal.
  const modules = myModules(me);
  const counts = modules.reduce<Record<string, number>>((all, { allowed, actions }) => {
    const { label } = accessSummary(allowed, actions);
    return { ...all, [label]: (all[label] ?? 0) + 1 };
  }, {});

  const confirmLogoutEverywhere = () =>
    confirmDanger({
      title: "Log out of all devices",
      message: "You are logged out everywhere, this browser too, and need to log in again.",
      confirmLabel: "Log Out Everywhere",
      onConfirm: () => void logOutEverywhere(),
    });

  return (
    <Page>
      <PageHeader
        title="My Profile"
        description="Your account, your password, and what your role lets you do."
      />

      {/* Who I am */}
      <Card withBorder radius="lg" shadow="xs" padding={0}>
        <div className={classes.banner} />
        <Box px="lg" pb="lg">
          <Group justify="space-between" align="flex-end" gap="md">
            <Group gap="md" wrap="nowrap" align="flex-end" miw={0}>
              <Avatar size={88} radius={44} color="primary" variant="filled" className={classes.avatar}>
                <Text fz={30} fw={700} inherit>
                  {getInitials(me.name)}
                </Text>
              </Avatar>
              <div style={{ minWidth: 0 }}>
                <Group gap="xs" mt="sm">
                  <Title order={2} fz={24} lh={1.2}>
                    {me.name}
                  </Title>
                  <Badge variant="light">{me.roleName}</Badge>
                </Group>
                <Group gap={6} mt={4} wrap="nowrap">
                  <IconMail size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
                  <Text size="sm" c="dimmed" truncate>
                    {me.email}
                  </Text>
                </Group>
              </div>
            </Group>
            {!switched && (
              <Button
                variant="secondary"
                leftSection={<IconEdit size={16} />}
                onClick={() => setEditingName(true)}
              >
                Edit Name
              </Button>
            )}
          </Group>

          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm" mt="lg">
            <Fact icon={IconBuilding} label="Institution">
              {company}
            </Fact>
            <Fact icon={IconId} label="Role">
              {me.roleName}
            </Fact>
            <Fact icon={IconClock} label="Last Login">
              {me.lastLoginAt ? (
                <Tooltip label={formatDateTime(me.lastLoginAt)}>
                  <span>{formatRelative(me.lastLoginAt)}</span>
                </Tooltip>
              ) : (
                "Never"
              )}
            </Fact>
            <Fact icon={IconCalendar} label="Member Since">
              {formatDateTime(me.createdAt)}
            </Fact>
          </SimpleGrid>

          <Group gap={6} mt="md" wrap="nowrap">
            <IconLock size={14} color="var(--mantine-color-dimmed)" style={{ flexShrink: 0 }} />
            <Text size="xs" c="dimmed">
              Your email and role are changed by an admin of {company} on the Users page.
            </Text>
          </Group>
        </Box>
      </Card>

      <Grid gutter="lg" align="stretch">
        {/* Password and sessions */}
        <Grid.Col span={{ base: 12, md: 7 }}>
          {switched ? (
            // Firmli staff viewing as this user: the password and sessions are the client's own.
            <Alert
              variant="light"
              color="orange"
              icon={<IconInfoCircle size={18} />}
              title="Viewing as this user"
            >
              You opened this account from Firmli, so its name, password and sessions are left alone here. Use
              Back to Firmli at the top to return to your own account.
            </Alert>
          ) : (
            <Card withBorder radius="lg" shadow="xs" padding="lg" h="100%">
              <ChangePasswordSection />
            </Card>
          )}
        </Grid.Col>

        {/* What my role lets me do, and my sessions */}
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Stack gap="lg" h="100%">
            <Card withBorder radius="lg" shadow="xs" padding="lg">
              <CardHeading
                icon={IconShieldLock}
                color="violet"
                title="Your Access"
                description={`${modules.length} ${modules.length === 1 ? "module" : "modules"} the ${me.roleName} role can use.`}
              />
              <SimpleGrid cols={3} spacing="sm">
                {[ACCESS_LEVELS.full, ACCESS_LEVELS.partial, ACCESS_LEVELS.view].map(({ label, color }) => (
                  <div key={label} className={classes.fact}>
                    <Text fz={22} fw={700} lh={1.2}>
                      {counts[label] ?? 0}
                    </Text>
                    <Badge variant="light" color={color} size="sm" mt={4}>
                      {label}
                    </Badge>
                  </div>
                ))}
              </SimpleGrid>
              <Button
                variant="secondary"
                fullWidth
                mt="md"
                leftSection={<IconListCheck size={16} />}
                onClick={() => setViewingAccess(true)}
              >
                View Full Access
              </Button>
            </Card>

            {!switched && (
              <Card withBorder radius="lg" shadow="xs" padding="lg" style={{ flex: 1 }}>
                <CardHeading
                  icon={IconDevices}
                  color="red"
                  title="Sessions"
                  description="Logged in somewhere you shouldn't be? End every session at once."
                />
                <Button
                  variant="secondary"
                  color="red"
                  fullWidth
                  leftSection={<IconLogout size={16} />}
                  onClick={confirmLogoutEverywhere}
                >
                  Log Out Everywhere
                </Button>
              </Card>
            )}
          </Stack>
        </Grid.Col>
      </Grid>
      <MyAccessModal me={me} opened={viewingAccess} onClose={() => setViewingAccess(false)} />
      <EditNameForm opened={editingName} name={me.name} onClose={() => setEditingName(false)} />
    </Page>
  );
}
