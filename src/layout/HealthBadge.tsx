import { Box, Group, Skeleton, Text, Tooltip } from "@mantine/core";
import { useHealth } from "../lib/useHealth";
import { IHealthStatus } from "../types";

type TPart = IHealthStatus["database"];

const partWords: Record<TPart, string> = { up: "up", down: "down", not_configured: "not set up" };

/** The worst news first: the API, then the database, then the AI queue (assessments wait without it). */
function overall(data: IHealthStatus | undefined, isError: boolean) {
  if (isError || !data) return { label: "API unreachable", color: "var(--mantine-color-red-6)" };
  if (data.database === "down") return { label: "Database down", color: "var(--mantine-color-orange-6)" };
  if (data.queue === "down") return { label: "AI queue down", color: "var(--mantine-color-orange-6)" };
  if (data.database === "not_configured")
    return { label: "API online · DB not set", color: "var(--mantine-color-primary-4)" };
  if (data.queue === "not_configured")
    return { label: "Online · AI queue not set", color: "var(--mantine-color-primary-4)" };
  return { label: "All systems online", color: "var(--mantine-color-green-6)" };
}

// Compact status line for the dark sidebar footer; `compact` (collapsed sidebar) shows only the dot.
export default function HealthBadge({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, isError } = useHealth();

  if (isLoading) return <Skeleton h={10} w={compact ? 10 : 120} radius="xl" opacity={0.25} />;

  const status = overall(data, isError);
  // Each part on its own line in the tooltip, e.g. "Database: up · AI queue: down".
  const details =
    data && !isError
      ? `Database: ${partWords[data.database]}${data.queue ? ` · AI queue: ${partWords[data.queue]}` : ""}`
      : null;

  return (
    <Tooltip
      label={details ? `${status.label}. ${details}` : `Backend health: ${status.label}`}
      withArrow
      multiline
      maw={260}
      position={compact ? "right" : "top"}
    >
      <Group gap={8} wrap="nowrap" justify={compact ? "center" : undefined}>
        <Box w={8} h={8} bg={status.color} style={{ borderRadius: "50%", flexShrink: 0 }} />
        {!compact && (
          <Text size="xs" c="gray.4">
            {status.label}
          </Text>
        )}
      </Group>
    </Tooltip>
  );
}
