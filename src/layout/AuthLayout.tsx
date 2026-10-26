import { Group, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconCheck, IconShieldCheck } from "@tabler/icons-react";
import { APP_NAME, APP_TAGLINE } from "../config";
import { Navigate, Outlet } from "react-router";
import { getToken } from "../lib/session";
import { RO_DASHBOARD } from "../routes";
import classes from "./AuthLayout.module.css";

const features = [
  "Review applications and eligibility in one place",
  "Generate conditional offer and rejection letters",
  "Send and track every offer email",
];

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <div className={classes.logo}>
        <IconShieldCheck size={24} />
      </div>
      <div>
        <Text fw={700} size="lg" c={dark ? undefined : "white"} lh={1.2}>
          {APP_NAME}
        </Text>
        <Text size="sm" c={dark ? "dimmed" : "gray.4"}>
          {APP_TAGLINE}
        </Text>
      </div>
    </Group>
  );
}

// The login page. A logged in user goes straight to the app.
export default function AuthLayout() {
  if (getToken()) return <Navigate to={RO_DASHBOARD} replace />;

  return (
    <div className={classes.page}>
      <aside className={classes.brand}>
        <Logo />

        <Stack gap="xl" maw={440}>
          <Title order={2} fz={36} lh={1.15} c="white">
            Offer letters, without the paperwork.
          </Title>
          <Stack gap="sm">
            {features.map((feature) => (
              <Group key={feature} gap="sm" wrap="nowrap" className={classes.feature}>
                <ThemeIcon size={24} radius="xl">
                  <IconCheck size={14} stroke={3} />
                </ThemeIcon>
                <Text>{feature}</Text>
              </Group>
            ))}
          </Stack>
        </Stack>

        <Text size="xs" c="gray.5">
          © {new Date().getFullYear()} Firmli
        </Text>
      </aside>

      <main className={classes.formSide}>
        <div className={classes.formCard}>
          <Stack hiddenFrom="md" mb={32}>
            <Logo dark />
          </Stack>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
