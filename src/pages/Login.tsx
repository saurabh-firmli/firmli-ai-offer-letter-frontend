import { Alert, Anchor, Button, Group, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconLock, IconMail } from "@tabler/icons-react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useState } from "react";
import { getNextPath, useLogin } from "../lib/auth";
import { getErrorMessage, getFieldErrors } from "../lib/errors";
import { takeSignOutMessage } from "../lib/session";
import { isEmail } from "../lib/utils";
import { RO_FORGOT_PASSWORD } from "../routes";

// Shown after signOut() sends the user here.
const reasonNotices = {
  expired: { color: "orange", text: "Your session has expired. Please log in again." },
  logout: { color: "green", text: "You've been logged out on all your devices." },
  tenant_blocked: { color: "red", text: "Your institution's account is blocked; contact Firmli." },
};

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useLogin();
  // A user no longer active: the API's own words, e.g. "Your account is banned; contact your administrator".
  const [signOutMessage] = useState(takeSignOutMessage);
  const notice =
    searchParams.get("reason") === "inactive"
      ? { color: "red", text: signOutMessage ?? "Your account is not active; contact your administrator." }
      : reasonNotices[searchParams.get("reason") as keyof typeof reasonNotices];

  const form = useForm({
    // ?email= comes from the login link shared when the user was created.
    initialValues: { email: searchParams.get("email") ?? "", password: "" },
    validate: {
      email: (value) => (isEmail(value) ? null : "Enter a valid email"),
      password: (value) => (value ? null : "Enter your password"),
    },
  });

  const handleSubmit = form.onSubmit((values) =>
    login.mutate(
      { ...values, email: values.email.trim() },
      {
        onSuccess: () => navigate(getNextPath(searchParams), { replace: true }),
        onError: (error) => form.setErrors(getFieldErrors(error)),
      }
    )
  );

  // 401 (wrong email or password) and other non-field errors show above the form.
  const formError =
    login.isError && !Object.keys(getFieldErrors(login.error)).length ? getErrorMessage(login.error) : null;

  return (
    <Stack gap="xl">
      <div>
        <Title order={1} fz={30}>
          Welcome back
        </Title>
        <Text c="dimmed" mt={6}>
          Log in to manage programs, applications and offer letters.
        </Text>
      </div>

      {formError ? (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}>
          {formError}
        </Alert>
      ) : (
        notice && (
          <Alert color={notice.color} variant="light">
            {notice.text}
          </Alert>
        )
      )}

      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="md">
          <TextInput
            label="Email"
            type="email"
            placeholder="you@university.edu"
            autoComplete="email"
            leftSection={<IconMail size={16} />}
            size="md"
            autoFocus
            {...form.getInputProps("email")}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            autoComplete="current-password"
            leftSection={<IconLock size={16} />}
            size="md"
            {...form.getInputProps("password")}
          />
          {/* Takes the email typed so far along, so it needn't be typed again. */}
          <Group justify="flex-end" mt={-8}>
            <Anchor
              component={Link}
              to={`${RO_FORGOT_PASSWORD}?${new URLSearchParams(form.values.email.trim() ? { email: form.values.email.trim() } : {})}`}
              size="sm"
            >
              Forgot password?
            </Anchor>
          </Group>
          <Button type="submit" size="md" fullWidth mt="xs" loading={login.isPending}>
            Log in
          </Button>
        </Stack>
      </form>

      {/* No signup: an admin of the company adds each user. */}
      <Text size="sm" c="dimmed" ta="center">
        No account yet? Ask an admin at your company to add you.
      </Text>
    </Stack>
  );
}
