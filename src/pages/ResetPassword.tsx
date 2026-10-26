import { Alert, Anchor, Button, Group, PasswordInput, Skeleton, Stack, Text, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconAlertCircle, IconArrowLeft, IconLock } from "@tabler/icons-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { PASSWORD_MAX, PASSWORD_MIN, useResetPassword, useVerifyResetToken } from "../lib/auth";
import { getErrorMessage, getFieldErrors } from "../lib/errors";
import { RO_DASHBOARD, RO_FORGOT_PASSWORD, RO_LOGIN } from "../routes";

/**
 * The link from the reset email (/reset-password?token=...): checks the link first, then sets the new
 * password. That logs the user in, like a login, and ends every older session.
 */
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const verify = useVerifyResetToken(token);
  const reset = useResetPassword();
  const form = useForm({
    initialValues: { password: "", confirm: "" },
    validate: {
      password: (value) =>
        value.length < PASSWORD_MIN
          ? `Use at least ${PASSWORD_MIN} characters`
          : value.length > PASSWORD_MAX
            ? `Use at most ${PASSWORD_MAX} characters`
            : null,
      confirm: (value, values) => (value === values.password ? null : "The passwords don't match"),
    },
  });

  const handleSubmit = form.onSubmit(({ password }) =>
    reset.mutate(
      { token: token!, password },
      {
        onSuccess: ({ user }) => {
          notifications.show({
            color: "green",
            title: "Password changed",
            message: `Welcome back, ${user.name}`,
          });
          navigate(RO_DASHBOARD, { replace: true });
        },
        onError: (error) => form.setErrors(getFieldErrors(error)),
      }
    )
  );

  const askAgain = (
    <Button component={Link} to={RO_FORGOT_PASSWORD} size="md" fullWidth>
      Ask for a New Link
    </Button>
  );
  const backToLogin = (
    <Anchor component={Link} to={RO_LOGIN} size="sm">
      <Group gap={4} justify="center">
        <IconArrowLeft size={14} />
        Back to login
      </Group>
    </Anchor>
  );

  // No token, or the link is unknown, used, expired or replaced by a newer one.
  if (!token || verify.isError)
    return (
      <Stack gap="xl">
        <div>
          <Title order={1} fz={30}>
            Link not valid
          </Title>
          <Text c="dimmed" mt={6}>
            {token
              ? getErrorMessage(verify.error)
              : "This page needs the link from the reset email. Ask for a new one below."}
          </Text>
        </div>
        {askAgain}
        {backToLogin}
      </Stack>
    );

  if (verify.isLoading)
    return (
      <Stack gap="md" aria-busy aria-label="Checking the link">
        <Skeleton h={34} w="70%" />
        <Skeleton h={14} w="50%" />
        <Skeleton h={42} mt="md" />
        <Skeleton h={42} />
        <Skeleton h={42} />
      </Stack>
    );

  // The link went bad between checking and saving (used in another tab, or a newer one was asked for).
  const formError =
    reset.isError && !Object.keys(getFieldErrors(reset.error)).length ? getErrorMessage(reset.error) : null;

  return (
    <Stack gap="xl">
      <div>
        <Title order={1} fz={30}>
          Choose a new password
        </Title>
        <Text c="dimmed" mt={6}>
          For {verify.data?.email}. You'll be logged in right after, and logged out everywhere else.
        </Text>
      </div>

      {formError && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}>
          {formError}{" "}
          <Anchor component={Link} to={RO_FORGOT_PASSWORD} size="sm">
            Ask for a new link
          </Anchor>
        </Alert>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          {/* The account's email, hidden, so a password manager saves the new password for it. */}
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={verify.data?.email ?? ""}
            readOnly
            hidden
          />
          <PasswordInput
            label="New Password"
            placeholder={`At least ${PASSWORD_MIN} characters`}
            autoComplete="new-password"
            leftSection={<IconLock size={16} />}
            size="md"
            maxLength={PASSWORD_MAX}
            autoFocus
            {...form.getInputProps("password")}
          />
          <PasswordInput
            label="Confirm New Password"
            placeholder="Type it again"
            autoComplete="new-password"
            leftSection={<IconLock size={16} />}
            size="md"
            maxLength={PASSWORD_MAX}
            {...form.getInputProps("confirm")}
          />
          <Button type="submit" size="md" fullWidth mt="xs" loading={reset.isPending}>
            Set New Password
          </Button>
        </Stack>
      </form>

      {backToLogin}
    </Stack>
  );
}
