import { ReactNode } from "react";
import { Card, Group, Stack, Text, Title } from "@mantine/core";
import { IconShieldCheck } from "@tabler/icons-react";
import { APP_NAME } from "../config";
import classes from "./StatusScreen.module.css";

interface IStatusScreenProps {
  illustration: ReactNode; // from components/Illustrations
  eyebrow: string; // a short tag over the title, e.g. "Error 404"
  title: string;
  message: ReactNode;
  actions: ReactNode;
  children?: ReactNode; // e.g. error details under the buttons
  inline?: boolean; // inside the app (a page that can't be shown): a card, without the brand mark
}

/**
 * Every error and status screen, in one look: a drawing, a short tag, a title, what happened and
 * what to do. Full screen outside the app frame (the error page, 404, a failed start); inline in a
 * card inside it (a record that isn't there, a page the role can't open).
 */
export default function StatusScreen({
  illustration,
  eyebrow,
  title,
  message,
  actions,
  children,
  inline = false,
}: IStatusScreenProps) {
  const content = (
    <Stack align="center" gap="lg" className={classes.content} role="alert">
      <div className={classes.art}>{illustration}</div>
      <Stack align="center" gap={8}>
        <Text size="xs" fw={700} tt="uppercase" lts="0.08em" c="primary">
          {eyebrow}
        </Text>
        <Title
          order={inline ? 2 : 1}
          fz={inline ? { base: 22, sm: 26 } : { base: 26, sm: 32 }}
          ta="center"
          lh={1.2}
        >
          {title}
        </Title>
        <Text c="dimmed" ta="center" maw={460} size="md">
          {message}
        </Text>
      </Stack>
      <Group justify="center" gap="sm">
        {actions}
      </Group>
      {children}
    </Stack>
  );

  if (inline)
    return (
      <Card withBorder radius="lg" shadow="xs" padding="xl" className={classes.inline}>
        {content}
      </Card>
    );

  return (
    <div className={classes.page}>
      <Group gap="sm" className={classes.brand}>
        <div className={classes.logo}>
          <IconShieldCheck size={20} />
        </div>
        <Text fw={700}>{APP_NAME}</Text>
      </Group>
      {content}
    </div>
  );
}
