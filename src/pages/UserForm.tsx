import { useEffect, useState } from "react";
import { Alert, Anchor, Group, PasswordInput, Select, Skeleton, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { IconLock, IconMail, IconUser } from "@tabler/icons-react";
import FormActions from "../components/FormActions";
import FormModal from "../components/FormModal";
import SearchableSelect from "../components/SearchableSelect";
import StatusDot from "../components/StatusDot";
import { IUser, TUserStatus, useCan, useMe, userStatusColors, userStatusLabels } from "../lib/auth";
import { NO_AUTOFILL, applyFormError, useResetOnOpen } from "../lib/forms";
import { useDropdown } from "../lib/dropdowns";
import { roleIcon, useRoles } from "../lib/roles";
import { generatePassword, useSaveUser } from "../lib/users";
import { isEmail, toOptions } from "../lib/utils";
import ShareLoginDetails, { ILoginDetails } from "./ShareLoginDetails";

// roleId is a string for the dropdown; it goes to the API as a number.
const emptyValues = { name: "", email: "", roleId: "", status: "active" as TUserStatus, password: "" };

interface IUserFormProps {
  opened: boolean;
  user: IUser | null; // null = add a new one
  isSelf: boolean;
  onClose: () => void;
}

export default function UserForm({ opened, user, isSelf, onClose }: IUserFormProps) {
  const save = useSaveUser();
  const { data: me } = useMe();
  const can = useCan();
  // The roles from the dropdown (any role may load it), Super Admin down; their descriptions only
  // come with GET /roles, when the role may read it.
  const roles = useDropdown("roles", {}, opened);
  const roleDetails = useRoles(opened && can("roles", "read"));
  const [passwordVisible, { open: showPassword, close: hidePassword, toggle: togglePassword }] =
    useDisclosure();
  const isNew = !user;

  const description = (id: number) =>
    roleDetails.data?.roles.find((role) => role.id === id)?.description ?? undefined;
  // Only a Super Admin may make someone a Super Admin (the API refuses it from anyone else).
  // A dropdown, not cards: it stays tidy however many roles there are.
  const roleOptions = (roles.data ?? []).map((role) => ({
    value: String(role.value),
    label: role.label,
    description: description(role.value),
    disabled: role.code === "super_admin" && me?.role !== "super_admin",
  }));
  // A new user starts with the least access, the last role (Read Only today); an admin gives more on purpose.
  const defaultRoleId = String(roles.data?.at(-1)?.value ?? "");

  const form = useForm({
    initialValues: emptyValues,
    validate: {
      roleId: (value) => (value ? null : "Select a role"),
      name: (value) => (value.trim() ? null : "Name is required"),
      email: (value) => (isEmail(value) ? null : "Enter a valid email"),
      // Required for a new user; on edit, empty means "keep the current password".
      password: (value) =>
        !value && !isNew ? null : value.length < 8 || value.length > 72 ? "Use 8 to 72 characters" : null,
    },
  });

  // For a new user, also reloads once the roles arrive, to preselect Viewer.
  useResetOnOpen(
    form,
    opened,
    user ?? defaultRoleId,
    user
      ? { name: user.name, email: user.email, roleId: String(user.roleId), status: user.status, password: "" }
      : { ...emptyValues, roleId: defaultRoleId }
  );
  const selectedRole = roles.data?.find(({ value }) => String(value) === form.values.roleId);
  const RoleIcon = roleIcon(roles.data, selectedRole?.code ?? "");

  // Set once a new user is saved: the modal then shows their login details instead of the form.
  const [created, setCreated] = useState<ILoginDetails | null>(null);

  // A password shown for the last user stays hidden for the next one; the form comes back.
  useEffect(() => {
    if (opened) {
      hidePassword();
      setCreated(null);
    }
  }, [opened, hidePassword]);

  const fillPassword = () => {
    form.setFieldValue("password", generatePassword());
    showPassword();
  };

  const handleSubmit = form.onSubmit(({ password, roleId, status, ...values }) =>
    save.mutate(
      {
        id: user?.id,
        ...values,
        name: values.name.trim(),
        email: values.email.trim(),
        // The backend refuses a change of your own role, so it is not sent.
        ...(isSelf ? {} : { roleId: Number(roleId) }),
        // New users start active; nobody can block themselves.
        ...(isNew || isSelf ? {} : { status }),
        ...(password ? { password } : {}),
      },
      {
        onSuccess: (saved) => {
          // A new user: show the login details to pass on (the only time the password can be seen).
          if (isNew) {
            setCreated({
              id: saved.id,
              name: saved.name,
              email: saved.email,
              password,
              company: me?.tenant?.name,
            });
            return;
          }
          notifications.show({
            color: "green",
            title: "User updated",
            message: password ? `${saved.name} can log in with the new password.` : saved.name,
          });
          onClose();
        },
        // 409 = the email belongs to a user (in any company).
        onError: (error) =>
          applyFormError(form, error, { conflictField: "email", toastTitle: "Could not save user" }),
      }
    )
  );

  if (created) {
    return (
      <FormModal
        opened={opened}
        onClose={onClose}
        title="User Created"
        description={`Share these login details with ${created.name}.`}
      >
        <ShareLoginDetails details={created} onDone={onClose} />
      </FormModal>
    );
  }

  return (
    <FormModal
      opened={opened}
      onClose={onClose}
      title={isNew ? "New User" : "Edit User"}
      description={isNew ? "They log in with this email and password." : user.email}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Full Name"
            placeholder="e.g. Riya Sharma"
            withAsterisk
            maxLength={150}
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

          {roles.isLoading ? (
            <Stack gap={6}>
              <Skeleton h={10} w={60} />
              <Skeleton h={36} radius="md" />
            </Stack>
          ) : (
            <SearchableSelect
              label="Role"
              withAsterisk
              placeholder="Select role"
              searchPlaceholder="Search roles..."
              nothingFoundMessage="No role found"
              leftSection={<RoleIcon size={16} />}
              data={roleOptions}
              value={form.values.roleId || null}
              onChange={(value) => form.setFieldValue("roleId", value ?? "")}
              description={
                isSelf ? "You can't change your own role." : selectedRole && description(selectedRole.value)
              }
              error={form.errors.roleId}
              disabled={isSelf}
            />
          )}

          {!isNew && (
            // Six fixed statuses: a plain dropdown, each with its color dot.
            <Select
              label="Status"
              data={toOptions(userStatusLabels)}
              value={form.values.status}
              onChange={(value) => value && form.setFieldValue("status", value as TUserStatus)}
              allowDeselect={false}
              leftSection={<StatusDot color={userStatusColors[form.values.status]} />}
              renderOption={({ option }) => (
                <Group gap="xs" wrap="nowrap">
                  <StatusDot color={userStatusColors[option.value as TUserStatus]} />
                  {option.label}
                </Group>
              )}
              description={
                isSelf
                  ? "You can't change your own status."
                  : form.values.status === "active"
                    ? "They can log in and work."
                    : form.values.status === "inactive"
                      ? "Not logged in yet; their first login makes them active. Setting it only makes them log in again."
                      : "They can't log in, and are logged out on their next action. They stay in the list."
              }
              error={form.errors.status}
              disabled={isSelf}
            />
          )}

          {/* Your own password goes through Change Password, which keeps you logged in; a reset here
              would log you out everywhere. */}
          {isSelf && !isNew ? (
            <Alert variant="light" color="gray" icon={<IconLock size={18} />}>
              To change your own password, use My Profile in the menu at the top right.
            </Alert>
          ) : (
            <PasswordInput
              label={isNew ? "Temporary Password" : "Reset Password"}
              placeholder={isNew ? "At least 8 characters" : "Leave empty to keep it"}
              withAsterisk={isNew}
              maxLength={72}
              leftSection={<IconLock size={16} />}
              visible={passwordVisible}
              onVisibilityChange={togglePassword}
              description={
                <>
                  {isNew
                    ? "Share it with the user; they can change it after logging in."
                    : "A new password logs them out on all their devices."}{" "}
                  <Anchor component="button" type="button" size="xs" onClick={fillPassword}>
                    Generate one
                  </Anchor>
                </>
              }
              {...form.getInputProps("password")}
            />
          )}

          <FormActions
            onCancel={onClose}
            submitLabel={isNew ? "Create User" : "Save Changes"}
            loading={save.isPending}
          />
        </Stack>
      </form>
    </FormModal>
  );
}
