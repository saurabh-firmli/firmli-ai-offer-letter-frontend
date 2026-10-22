import { Button, Card, Code, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconLock, IconLogout } from "@tabler/icons-react";
import { Link, useSearchParams } from "react-router";
import { RO_DASHBOARD } from "../routes";
import { DEV_TENANT_ID } from "../config";

// Where lib/session.ts signOut() lands, after logout or any 401.
// TODO(auth): replace with the real login page once backend auth lands.
export default function SignedOut() {
  const [searchParams] = useSearchParams();
  const isLogout = searchParams.get("reason") === "logout";
  const Icon = isLogout ? IconLogout : IconLock;

  return (
    <Stack align="center" justify="center" mih="100vh" p="md" bg="var(--page-background)">
      <Card withBorder radius="lg" shadow="sm" padding="xl" maw={440} w="100%">
        <Stack align="center" gap="md">
          <ThemeIcon size={64} radius="xl" variant="light" color={isLogout ? "primary" : "orange"}>
            <Icon size={30} />
          </ThemeIcon>
          <Title order={2} ta="center">
            {isLogout ? "You've signed out" : "Your session couldn't be verified"}
          </Title>
          <Text c="dimmed" ta="center">
            {isLogout
              ? "All data from your session has been cleared from this browser."
              : "We couldn't confirm which organisation you belong to, so your session was ended. Sign in again to continue."}
          </Text>

          {import.meta.env.DEV && !DEV_TENANT_ID && (
            <Text size="sm" c="orange.8" ta="center">
              Dev: set <Code>VITE_DEV_TENANT_ID</Code> in .env.development.local and restart
              the dev server.
            </Text>
          )}

          <Button component={Link} to={RO_DASHBOARD} color="dark" fullWidth mt="xs">
            Sign in again
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
