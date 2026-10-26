import { CSSProperties, ReactNode } from "react";
import { Card, Group, Text, Title } from "@mantine/core";

/** A label / value pair in a details card; an empty value shows "—". */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} component="div" style={{ wordBreak: "break-word" }}>
        {children || "—"}
      </Text>
    </div>
  );
}

/**
 * A details card with its title, and an optional action on the right (e.g. Generate Letter).
 * style: e.g. { flex: 1 } to fill the rest of a column, { height: "100%" } to match the cards beside it.
 */
export function SectionCard({
  title,
  action,
  style,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <Card withBorder radius="lg" shadow="xs" padding="lg" style={style}>
      {/* As tall as an xs button, so titles line up whether a card has an action or not. */}
      <Group justify="space-between" mb="md" mih={30}>
        <Title order={3} fz={16}>
          {title}
        </Title>
        {action}
      </Group>
      {children}
    </Card>
  );
}
