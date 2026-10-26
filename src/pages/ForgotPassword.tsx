import { Alert, Anchor, Button, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertCircle, IconArrowLeft, IconMail, IconMailCheck } from "@tabler/icons-react";
import { Link, useSearchParams } from "react-router";
import { useForgotPassword } from "../lib/auth";
import { getErrorMessage, getFieldErrors } from "../lib/errors";
import { isEmail } from "../lib/utils";
import { RO_LOGIN } from "../routes";

/**
 * "Forgot password?": asks for a reset link by email. The API answers the same whether or not the
 * email has an account, so this page never says which.
 */
export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const forgot = useForgotPassword();
  const form = useForm({
    // ?email= comes from what was typed on the login page.
    initialValues: { email: searchParams.get("email") ?? "" },
    validate: { email: (value) => (isEmail(value.trim()) ? null : "Enter a valid email") },
  });

  const handleSubmit = form.onSubmit(({ email }) =>
    forgot.mutate(email.trim(), { onError: (error) => form.setErrors(getFieldErrors(error)) })
  );

  // e.g. too many requests from this network
  const formError =
    forgot.isError && !Object.keys(getFieldErrors(forgot.error)).length
      ? getErrorMessage(forgot.error)
      : null;

  const backToLogin = (
    <Anchor component={Link} to={RO_LOGIN} size="sm">
      <Group gap={4} justify="center">
        <IconArrowLeft size={14} />
        Back to login
      </Group>
    </Anchor>
  );

  if (forgot.isSuccess)
    return (
      <Stack gap="xl">
        <div>
          <Title order={1} fz={30}>
            Check your email
          </Title>
          <Text c="dimmed" mt={6}>
            {forgot.data}
          </Text>
        </div>
        <Alert variant="light" color="primary" icon={<IconMailCheck size={18} />}>
          The link in the email works once, for 60 minutes. Can't find it? Look in your spam folder, or ask
          again: a new link replaces the old one.
        </Alert>
        {backToLogin}
      </Stack>
    );

  return (
    <Stack gap="xl">
      <div>
        <Title order={1} fz={30}>
          Forgot your password?
        </Title>
        <Text c="dimmed" mt={6}>
          Enter your email and we'll send you a link to choose a new one.
        </Text>
      </div>

      {formError && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={18} />}>
          {formError}
        </Alert>
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
          <Button type="submit" size="md" fullWidth mt="xs" loading={forgot.isPending}>
            Send Reset Link
          </Button>
        </Stack>
      </form>

      {backToLogin}
    </Stack>
  );
}
