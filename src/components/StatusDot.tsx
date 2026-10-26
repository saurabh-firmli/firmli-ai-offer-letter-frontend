import { Box } from "@mantine/core";

/** Small colored dot for a status (same Mantine color as the status badge in tables). */
export default function StatusDot({ color }: { color: string }) {
  return (
    <Box w={8} h={8} bg={`var(--mantine-color-${color}-6)`} style={{ borderRadius: "50%", flexShrink: 0 }} />
  );
}
