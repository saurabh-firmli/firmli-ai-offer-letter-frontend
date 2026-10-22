import { Box, Group, Loader, Text, Tooltip } from "@mantine/core";
import { useHealth } from "../lib/useHealth";

const databaseLabels = {
  up: { label: "All systems online", color: "#22c55e" },
  down: { label: "Database down", color: "#f59e0b" },
  not_configured: { label: "API online · DB not set", color: "#38bdf8" },
};

// Compact status line for the dark sidebar footer.
export default function HealthBadge() {
  const { data, isLoading, isError } = useHealth();

  if (isLoading) return <Loader size="xs" color="gray.5" />;

  const status = isError
    ? { label: "API unreachable", color: "#ef4444" }
    : databaseLabels[data?.database ?? "down"];

  return (
    <Tooltip label={`Backend health: ${status.label}`} withArrow>
      <Group gap={8} wrap="nowrap">
        <Box w={8} h={8} bg={status.color} style={{ borderRadius: "50%", flexShrink: 0 }} />
        <Text size="xs" c="gray.4">
          {status.label}
        </Text>
      </Group>
    </Tooltip>
  );
}
